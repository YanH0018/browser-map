import type { WorkspaceTab } from './types';

/**
 * Embedding pipeline (M7 item 2). Talks to the LOCAL LM Studio server's
 * OpenAI-compatible embeddings endpoint. Everything here is side-effect
 * free except the fetch itself; vectors are cached by URL in workspace
 * storage (see lib/workspaceStorage.ts) so reloads never re-embed.
 *
 * Failure contract (D18): any unreachable endpoint, HTTP error or malformed
 * response throws a plain Error. The store catches it and surfaces a notice;
 * the canvas is never blocked or crashed by embeddings.
 */

/** LM Studio's OpenAI-compatible server (local only; no manifest host permission — D18). */
export const EMBEDDINGS_ENDPOINT = 'http://localhost:1234/v1/embeddings';

/** The local embedding model served by LM Studio. */
export const EMBEDDINGS_MODEL = 'text-embedding-nomic-embed-text-v1.5';

/** Texts per request; keeps payloads small and responses fast to stream. */
const EMBED_BATCH_SIZE = 32;

/** Cold model loads can take a while; generous but bounded so the UI never hangs. */
const EMBED_TIMEOUT_MS = 120_000;

/** The text embedded for a tab: its title plus hostname (D18). */
export function embeddingTextForTab(tab: Pick<WorkspaceTab, 'title' | 'domain'>): string {
  return `${tab.title} ${tab.domain}`.trim();
}

/**
 * Embed a batch of texts via the local endpoint (chunked at EMBED_BATCH_SIZE).
 * Returns one vector per input text, in order. Throws on network failure,
 * non-2xx status or a malformed/incomplete response — never returns partial
 * results.
 */
export async function fetchEmbeddings(
  texts: readonly string[],
  endpoint: string = EMBEDDINGS_ENDPOINT,
  model: string = EMBEDDINGS_MODEL,
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const chunk = [...texts.slice(i, i + EMBED_BATCH_SIZE)];
    out.push(...(await requestEmbeddings(chunk, endpoint, model)));
  }
  return out;
}

async function requestEmbeddings(
  chunk: string[],
  endpoint: string,
  model: string,
): Promise<number[][]> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: chunk }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(
      `embeddings endpoint unreachable (${endpoint}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    throw new Error(`embeddings endpoint returned HTTP ${res.status} (${endpoint})`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('embeddings endpoint returned invalid JSON');
  }

  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data) || data.length !== chunk.length) {
    throw new Error('embeddings response is missing vectors for some inputs');
  }

  return data.map((entry, i) => {
    const vector = (entry as { embedding?: unknown })?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`embeddings response has no vector for input ${i}`);
    }
    if (!vector.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error(`embeddings response has a non-numeric vector for input ${i}`);
    }
    return vector as number[];
  });
}

export interface EmbedTabsResult {
  /** tabId → vector for every input tab that has a vector (cached or fresh). */
  vectorsByTabId: Map<number, number[]>;
  /** Updated URL → vector cache; same reference as the input when nothing new was embedded. */
  cache: Map<string, number[]>;
}

/**
 * Embed the given tabs, reusing cached vectors by URL. Only URLs missing from
 * `cache` are sent to the endpoint (one chunked request for all of them).
 * On success returns vectors for every tab plus the updated cache; on any
 * endpoint failure the error propagates and `cache` is left untouched.
 */
export async function embedTabs(
  tabs: readonly WorkspaceTab[],
  cache: Map<string, number[]>,
): Promise<EmbedTabsResult> {
  const vectorsByTabId = new Map<number, number[]>();
  const missing: { tab: WorkspaceTab; text: string }[] = [];

  for (const t of tabs) {
    const cached = cache.get(t.url);
    if (cached) vectorsByTabId.set(t.tabId, cached);
    else missing.push({ tab: t, text: embeddingTextForTab(t) });
  }

  if (missing.length === 0) return { vectorsByTabId, cache };

  const vectors = await fetchEmbeddings(missing.map((m) => m.text));
  const updated = new Map(cache);
  missing.forEach(({ tab }, i) => {
    const vector = vectors[i]!;
    updated.set(tab.url, vector);
    vectorsByTabId.set(tab.tabId, vector);
  });

  return { vectorsByTabId, cache: updated };
}

/**
 * Sanitize a raw persisted embedding cache (browser.storage.local) into a
 * URL → vector map. Anything malformed is dropped, never thrown on — the
 * cache is an optimization, not a source of truth.
 */
export function deserializeEmbeddingCache(raw: unknown): Map<string, number[]> {
  const out = new Map<string, number[]>();
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [url, value] of Object.entries(raw)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    if (!value.every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    out.set(url, value as number[]);
  }
  return out;
}
