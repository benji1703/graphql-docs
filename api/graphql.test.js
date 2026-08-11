import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './graphql';

describe('GraphQL relay origin policy', () => {
  it('allows the published documentation and local development', () => {
    expect(isAllowedOrigin('https://benji1703.github.io')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:4173')).toBe(true);
  });

  it('rejects unrelated origins', () => {
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
});
