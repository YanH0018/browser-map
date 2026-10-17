import { describe, expect, it } from 'vitest';
import { isOwnExtensionTab } from '../lib/browserAdapter';

describe('isOwnExtensionTab', () => {
  const ownOrigin = 'chrome-extension://abcdefghijklmnop/';

  it('matches the extension workspace page', () => {
    expect(isOwnExtensionTab(`${ownOrigin}workspace.html`, ownOrigin)).toBe(true);
  });

  it('matches any page under the extension origin', () => {
    expect(isOwnExtensionTab(`${ownOrigin}other.html`, ownOrigin)).toBe(true);
  });

  it('rejects regular web pages', () => {
    expect(isOwnExtensionTab('https://example.com/', ownOrigin)).toBe(false);
  });

  it('rejects undefined urls', () => {
    expect(isOwnExtensionTab(undefined, ownOrigin)).toBe(false);
  });

  it('rejects a different extension origin', () => {
    expect(isOwnExtensionTab('chrome-extension://zzzzzzzzzzzzzzzzzzzz/workspace.html', ownOrigin)).toBe(false);
  });
});
