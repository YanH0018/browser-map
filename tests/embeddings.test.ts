import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMBEDDINGS_ENDPOINT,
  EMBEDDINGS_MODEL,
  embedTabs,
  embeddingTextForTab,
  deserializeEmbeddingCache,
  fetchEmbeddings,
} from '../lib/embeddings';
import type { WorkspaceTab } from '../lib/types';

const tab = (over: Partial<WorkspaceTab>): WorkspaceTab => ({
  tabId: 1,
  windowId: 1,
  title: 'T',
  url: 'https://a.example.com',
  domain: 'a.example.com',
  pinned: false,
  active: false,
  position: { x: 0, y: 0 },
  ...over,
});

/** Minimal Response stand-in for the mocked fetch. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** OpenAI-shaped embeddings response for the given vectors. */
function embeddingBody(vectors: number[][]): unknown {
  return { object: 'list', data: vectors.map((embedding, index) => ({ object: 'embedding', index, embedding })) };
}

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('embeddingTextForTab', () => {
  it('is the title plus hostname, trimmed (D18)', () => {
    expect(embeddingTextForTab({ title: 'PyTorch docs', domain: 'pytorch.org' })).toBe(
      'PyTorch docs pytorch.org',
    );
  });

  it('handles empty titles and domains without stray spaces', () => {
    expect(embeddingTextForTab({ title: '', domain: 'example.com' })).toBe('example.com');
    expect(embeddingTextForTab({ title: 'Only title', domain: '' })).toBe('Only title');
    expect(embeddingTextForTab({ title: '', domain: '' })).toBe('');
  });
});

describe('fetchEmbeddings', () => {
  it('POSTs the model + texts to the local endpoint and returns vectors in order', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(embeddingBody([[1, 0], [0, 1]])));

    const vectors = await fetchEmbeddings(['one', 'two']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(EMBEDDINGS_ENDPOINT);
    const body = JSON.parse(init!.body as string) as { model: string; input: string[] };
    expect(body.model).toBe(EMBEDDINGS_MODEL);
    expect(body.input).toEqual(['one', 'two']);
    expect(vectors).toEqual([[1, 0], [0, 1]]); // order preserved
  });

  it('chunks large batches (32 per request) and concatenates results in order', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const texts = Array.from({ length: 35 }, (_, i) => `text-${i}`);
    // Each request echoes its inputs back as distinct vectors.
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const input = (JSON.parse(init!.body as string) as { input: string[] }).input;
      return jsonResponse(embeddingBody(input.map((t) => [Number(t.split('-')[1])] )));
    });

    const vectors = await fetchEmbeddings(texts);

    expect(fetchMock).toHaveBeenCalledTimes(2); // 32 + 3
    const firstInput = (JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { input: string[] }).input;
    const secondInput = (JSON.parse(fetchMock.mock.calls[1]![1]!.body as string) as { input: string[] }).input;
    expect(firstInput).toHaveLength(32);
    expect(secondInput).toHaveLength(3);

    expect(vectors).toHaveLength(35);
    for (let i = 0; i < 35; i++) expect(vectors[i]).toEqual([i]); // order intact across chunks
  });

  it('throws a plain Error when the endpoint is unreachable (never partial results)', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(fetchEmbeddings(['one'])).rejects.toThrow(/unreachable/);
  });

  it('throws on non-2xx responses', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'model not loaded' }, false, 503));

    await expect(fetchEmbeddings(['one'])).rejects.toThrow(/HTTP 503/);
  });

  it('throws on invalid JSON', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    } as unknown as Response);

    await expect(fetchEmbeddings(['one'])).rejects.toThrow(/invalid JSON/);
  });

  it('throws when the response is missing vectors for some inputs', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(embeddingBody([[1, 0]]))); // only 1 of 2

    await expect(fetchEmbeddings(['one', 'two'])).rejects.toThrow(/missing vectors/);
  });

  it('throws on empty or non-numeric vector entries', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(embeddingBody([[]])));
    await expect(fetchEmbeddings(['one'])).rejects.toThrow(/no vector/);

    fetchMock.mockResolvedValueOnce(jsonResponse(embeddingBody([[1, Number.NaN]])));
    await expect(fetchEmbeddings(['one'])).rejects.toThrow(/non-numeric/);
  });
});

describe('embedTabs', () => {
  it('serves fully cached tabs without any fetch (reloads never re-embed)', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const tabs = [tab({ tabId: 1, url: 'https://a.example.com' })];
    const cache = new Map<string, number[]>([['https://a.example.com', [1, 0]]]);

    const { vectorsByTabId, cache: out } = await embedTabs(tabs, cache);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(vectorsByTabId.get(1)).toEqual([1, 0]);
    expect(out).toBe(cache); // same reference: nothing new was embedded
  });

  it('fetches only the missing URLs and returns an updated cache', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const tabs = [
      tab({ tabId: 1, url: 'https://a.example.com', title: 'Cached' }),
      tab({ tabId: 2, url: 'https://b.example.com', domain: 'b.example.com', title: 'Fresh one' }),
      tab({ tabId: 3, url: 'https://c.example.com', domain: 'c.example.com', title: 'Fresh two' }),
    ];
    const cache = new Map<string, number[]>([['https://a.example.com', [1, 0]]]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(embeddingBody([[2, 0], [3, 0]])),
    );

    const { vectorsByTabId, cache: out } = await embedTabs(tabs, cache);

    // Only the two missing texts were sent (in tab order).
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { input: string[] };
    expect(body.input).toEqual(['Fresh one b.example.com', 'Fresh two c.example.com']);

    expect(vectorsByTabId.get(1)).toEqual([1, 0]); // from cache
    expect(vectorsByTabId.get(2)).toEqual([2, 0]); // fresh
    expect(vectorsByTabId.get(3)).toEqual([3, 0]); // fresh
    expect(out).not.toBe(cache); // new map…
    expect(out.get('https://a.example.com')).toEqual([1, 0]); // …old entries kept
    expect(out.get('https://b.example.com')).toEqual([2, 0]); // …new entries added
    expect(cache.get('https://b.example.com')).toBeUndefined(); // input cache untouched
  });

  it('propagates endpoint failures (cache left for the next run)', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const tabs = [tab({ tabId: 1, url: 'https://a.example.com' })];
    const cache = new Map<string, number[]>();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(embedTabs(tabs, cache)).rejects.toThrow(/unreachable/);
    expect(cache.size).toBe(0); // nothing half-written
  });
});

describe('deserializeEmbeddingCache', () => {
  it('keeps valid URL → vector entries and drops malformed ones', () => {
    const raw = {
      'https://ok.example.com': [1, 2, 3],
      'https://empty.example.com': [], // empty vector: dropped
      'https://junk.example.com': [1, 'x'], // non-numeric: dropped
      'https://nan.example.com': [Number.NaN], // non-finite: dropped
      'https://obj.example.com': { embedding: [1] }, // not an array: dropped
    };
    const out = deserializeEmbeddingCache(raw);
    expect([...out.keys()]).toEqual(['https://ok.example.com']);
    expect(out.get('https://ok.example.com')).toEqual([1, 2, 3]);
  });

  it('returns an empty map for non-object input (never throws)', () => {
    expect(deserializeEmbeddingCache(undefined).size).toBe(0);
    expect(deserializeEmbeddingCache(null).size).toBe(0);
    expect(deserializeEmbeddingCache('nope').size).toBe(0);
    expect(deserializeEmbeddingCache([1, 2]).size).toBe(0);
  });
});
