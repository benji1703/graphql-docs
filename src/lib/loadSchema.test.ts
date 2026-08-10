import { getIntrospectionQuery, graphql } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { introspectEndpoint, parseHeaders, schemaFromSDL } from './loadSchema';

describe('schema loading', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses SDL and reports invalid documents', () => {
    expect(schemaFromSDL('type Query { ping: String! }').getQueryType()?.name).toBe('Query');
    expect(() => schemaFromSDL('not graphql')).toThrow();
    expect(() => schemaFromSDL('  ')).toThrow('schema is empty');
  });

  it('validates headers as string-valued JSON', () => {
    expect(parseHeaders('{"authorization":"Bearer demo"}')).toEqual({ authorization: 'Bearer demo' });
    expect(() => parseHeaders('["bad"]')).toThrow('JSON object');
    expect(() => parseHeaders('{"x-retry":3}')).toThrow('must be a string');
  });

  it('builds a schema from an introspection response', async () => {
    const sourceSchema = schemaFromSDL('type Query { status: String! }');
    const result = await graphql({ schema: sourceSchema, source: getIntrospectionQuery() });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const loaded = await introspectEndpoint('https://example.test/graphql');
    expect(loaded.getQueryType()?.getFields().status.type.toString()).toBe('String!');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.test/graphql',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces GraphQL and HTTP failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ message: 'Introspection is disabled' }] }), { status: 200 }),
    );
    await expect(introspectEndpoint('https://example.test/graphql')).rejects.toThrow('Introspection is disabled');

    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 403, statusText: 'Forbidden' }));
    await expect(introspectEndpoint('https://example.test/graphql')).rejects.toThrow('403 Forbidden');
  });
});
