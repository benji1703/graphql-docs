import {
  buildClientSchema,
  buildSchema,
  getIntrospectionQuery,
  lexicographicSortSchema,
  type GraphQLSchema,
  type IntrospectionQuery,
} from 'graphql';

export function schemaFromSDL(sdl: string): GraphQLSchema {
  if (!sdl.trim()) throw new Error('The schema is empty. Paste GraphQL SDL and try again.');
  return lexicographicSortSchema(buildSchema(sdl));
}

export async function schemaFromURL(url: string): Promise<{ schema: GraphQLSchema; sdl: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load schema (${response.status} ${response.statusText}).`);
  const sdl = await response.text();
  return { schema: schemaFromSDL(sdl), sdl };
}

export async function introspectEndpoint(
  endpoint: string,
  headers: Record<string, string> = {},
): Promise<GraphQLSchema> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      operationName: 'IntrospectionQuery',
      query: getIntrospectionQuery({ descriptions: true, specifiedByUrl: true, directiveIsRepeatable: true }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Introspection failed (${response.status} ${response.statusText}).`);
  }

  const payload = (await response.json()) as {
    data?: IntrospectionQuery;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message ?? 'Unknown GraphQL error').join('\n'));
  }
  if (!payload.data) throw new Error('The endpoint returned no introspection data.');

  return lexicographicSortSchema(buildClientSchema(payload.data));
}

export function parseHeaders(value: string): Record<string, string> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Headers must be a JSON object.');
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, headerValue]) => {
      if (typeof headerValue !== 'string') throw new Error(`Header “${key}” must be a string.`);
      return [key, headerValue];
    }),
  );
}
