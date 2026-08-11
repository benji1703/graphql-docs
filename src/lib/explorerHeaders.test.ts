import { describe, expect, it } from 'vitest';
import { createExplorerHeaders } from './explorerHeaders';

describe('Explorer request headers', () => {
  it('creates the required Silverfort headers', () => {
    expect(createExplorerHeaders('customer-org', 'secret-token')).toEqual({
      Organization: 'customer-org',
      Authorization: 'Bearer secret-token',
    });
  });

  it('does not duplicate an existing Bearer prefix', () => {
    expect(createExplorerHeaders('customer-org', 'Bearer secret-token').Authorization).toBe('Bearer secret-token');
  });

  it('requires both customer-supplied values', () => {
    expect(() => createExplorerHeaders('', 'secret-token')).toThrow('Organization is required');
    expect(() => createExplorerHeaders('customer-org', '')).toThrow('Authorization token is required');
  });
});
