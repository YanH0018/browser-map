import { describe, expect, it } from 'vitest';
import { filterTabs } from '../lib/search';
import { domainFromUrl, normalizeTab } from '../lib/browserAdapter';
import type { WorkspaceCluster, WorkspaceTab } from '../lib/types';

const tab = (over: Partial<WorkspaceTab>): WorkspaceTab => ({
  tabId: 1,
  windowId: 1,
  title: '',
  url: '',
  domain: '',
  pinned: false,
  active: false,
  position: { x: 0, y: 0 },
  ...over,
});

const cluster = (over: Partial<WorkspaceCluster>): WorkspaceCluster => ({
  id: 'c1',
  name: 'Machine Learning',
  position: { x: 0, y: 0 },
  size: { width: 300, height: 200 },
  ...over,
});

describe('domainFromUrl', () => {
  it('extracts hostname', () => {
    expect(domainFromUrl('https://docs.pytorch.org/en/stable/')).toBe('docs.pytorch.org');
  });

  it('returns empty string for invalid URLs', () => {
    expect(domainFromUrl('not a url')).toBe('');
  });
});

describe('normalizeTab', () => {
  it('fills defaults for missing fields', () => {
    const t = normalizeTab({ id: 7, windowId: 2, url: 'https://example.com/x' }, { x: 1, y: 2 });
    expect(t.tabId).toBe(7);
    expect(t.domain).toBe('example.com');
    expect(t.title).toBe('https://example.com/x');
    expect(t.position).toEqual({ x: 1, y: 2 });
    expect(t.pinned).toBe(false);
  });
});

describe('filterTabs', () => {
  const tabs = [
    tab({ tabId: 1, title: 'PyTorch docs', url: 'https://docs.pytorch.org', domain: 'docs.pytorch.org', clusterId: 'c1' }),
    tab({ tabId: 2, title: 'SSD deals', url: 'https://shop.example.com/ssd', domain: 'shop.example.com' }),
  ];
  const clusters = [cluster({ id: 'c1' })];

  it('returns all tabs for an empty query', () => {
    expect(filterTabs(tabs, clusters, '  ')).toHaveLength(2);
  });

  it('matches by title', () => {
    expect(filterTabs(tabs, clusters, 'pytorch')).toHaveLength(1);
  });

  it('matches by domain', () => {
    expect(filterTabs(tabs, clusters, 'shop.example')).toHaveLength(1);
  });

  it('matches by cluster name', () => {
    expect(filterTabs(tabs, clusters, 'machine')).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    expect(filterTabs(tabs, clusters, 'SSD')).toHaveLength(1);
  });
});
