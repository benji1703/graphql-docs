import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildClientSchema, getIntrospectionQuery, lexicographicSortSchema, printSchema } from 'graphql';
import projectConfig from '../graphql-docs.config.mjs';

const customConfigPath = process.env.GRAPHQL_DOCS_CONFIG;
const config = customConfigPath
  ? (await import(pathToFileURL(resolve(customConfigPath)).href)).default
  : projectConfig;
const endpointOverride = process.argv[2] || process.env.GRAPHQL_ENDPOINT;
const outputPath = resolve(process.argv[3] || config.output.schema);

const schemaSource = endpointOverride ? { type: 'url', url: endpointOverride, headersEnv: 'GRAPHQL_HEADERS' } : config.schema;
let schema;
let sourceLabel;

if (schemaSource.type === 'url') {
  const headersValue = process.env[schemaSource.headersEnv || 'GRAPHQL_HEADERS'];
  const headers = headersValue ? JSON.parse(headersValue) : {};
  sourceLabel = schemaSource.url;
  console.log(`Introspecting ${schemaSource.url}`);
  const response = await fetch(schemaSource.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      operationName: 'IntrospectionQuery',
      query: getIntrospectionQuery({ descriptions: true, specifiedByUrl: true, directiveIsRepeatable: true }),
    }),
  });

  if (!response.ok) throw new Error(`Introspection failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join('\n'));
  if (!payload.data) throw new Error('The endpoint returned no introspection data.');
  schema = buildClientSchema(payload.data);
} else if (schemaSource.type === 'sdl') {
  if (!schemaSource.paths?.length) throw new Error('An SDL source requires at least one path.');
  sourceLabel = schemaSource.paths.join(', ');
  console.log(`Reading ${schemaSource.paths.length} SDL file(s)`);
  const { buildSchema } = await import('graphql');
  const documents = await Promise.all(schemaSource.paths.map((path) => readFile(resolve(path), 'utf8')));
  schema = buildSchema(documents.join('\n'));
} else if (schemaSource.type === 'raw') {
  const { buildSchema } = await import('graphql');
  sourceLabel = 'raw configuration';
  schema = buildSchema(schemaSource.content);
} else {
  throw new Error(`Unsupported schema source: ${schemaSource.type}`);
}

schema = lexicographicSortSchema(schema);
const output = [
  `# Generated from ${sourceLabel}`,
  '# Run `npm run schema:pull` to refresh.',
  '',
  printSchema(schema),
  '',
].join('\n');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, 'utf8');

const typeCount = Object.keys(schema.getTypeMap()).filter((name) => !name.startsWith('__')).length;
console.log(`Wrote ${outputPath} (${typeCount.toLocaleString()} types, ${(Buffer.byteLength(output) / 1024 / 1024).toFixed(1)} MiB)`);
