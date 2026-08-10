import {
  Braces,
  CheckCircle2,
  CircleX,
  Play,
  Search,
  Settings2,
} from 'lucide-react';
import { parse, validate } from 'graphql';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSchema } from '../context/SchemaContext';
import { humanizeGraphQLName } from '../lib/descriptions';
import { generateOperation, generateOperationVariables } from '../lib/operation';

type OperationKind = 'query' | 'mutation';
type EditorTab = 'operation' | 'variables' | 'headers';

export function ExplorerPage() {
  const { explorerEndpoint, schema, source } = useSchema();
  const [searchParams] = useSearchParams();
  const initial = useMemo(() => getInitialOperation(schema), [schema]);
  const [kind, setKind] = useState<OperationKind>('query');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [activeTab, setActiveTab] = useState<EditorTab>('operation');
  const [document, setDocument] = useState(searchParams.get('document') ?? initial.document);
  const [variables, setVariables] = useState(searchParams.get('variables') ?? initial.variables);
  const [headers, setHeaders] = useState(JSON.stringify(source.headers ?? {}, null, 2));
  const [result, setResult] = useState('Run an operation to see its response.');
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const rootType = kind === 'query' ? schema.getQueryType() : schema.getMutationType();
  const operations = useMemo(() => {
    if (!rootType) return [];
    return Object.values(rootType.getFields())
      .filter((field) => {
        if (!deferredSearch) return true;
        const label = humanizeGraphQLName(field.name).toLowerCase();
        return field.name.toLowerCase().includes(deferredSearch) || label.includes(deferredSearch);
      })
      .slice(0, 120);
  }, [rootType, deferredSearch]);

  const selectOperation = (fieldName: string) => {
    if (!rootType) return;
    setDocument(generateOperation(schema, rootType.name, fieldName));
    setVariables(JSON.stringify(generateOperationVariables(schema, rootType.name, fieldName), null, 2));
    setActiveTab('operation');
    setResult('Run the selected operation to see its response.');
    setStatus('idle');
  };

  const runOperation = async () => {
    setIsRunning(true);
    setStatus('idle');
    try {
      const parsedDocument = parse(document);
      const validationErrors = validate(schema, parsedDocument);
      if (validationErrors.length) throw new Error(validationErrors.map((error) => error.message).join('\n'));
      const parsedVariables = parseJSONObject(variables, 'Variables');
      const parsedHeaders = parseStringRecord(headers, 'Headers');
      const response = await fetch(explorerEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...parsedHeaders },
        body: JSON.stringify({ query: document, variables: parsedVariables }),
      });
      const payload = await response.json() as unknown;
      setResult(JSON.stringify(payload, null, 2));
      setStatus(response.ok ? 'success' : 'error');
    } catch (reason) {
      const message = reason instanceof TypeError
        ? `Live execution was blocked by the API's CORS policy. Allow ${window.location.origin} on ${new URL(explorerEndpoint).origin} to enable browser execution.`
        : reason instanceof Error ? reason.message : 'The operation could not be executed.';
      setResult(JSON.stringify({ errors: [{ message }] }, null, 2));
      setStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="native-explorer">
      <header className="native-explorer__toolbar">
        <div><span className="status-dot" /><strong>Embedded GraphQL Explorer</strong><code>{explorerEndpoint}</code></div>
        <div className="native-explorer__schema-status"><CheckCircle2 size={14} /> Schema loaded locally</div>
        <button className="native-explorer__run" type="button" onClick={() => void runOperation()} disabled={isRunning}>
          <Play size={13} fill="currentColor" /> {isRunning ? 'Running…' : 'Run operation'}
        </button>
      </header>

      <div className="native-explorer__workspace">
        <aside className="native-explorer__operations">
          <div className="native-explorer__panel-title"><Braces size={16} /><div><strong>Operations</strong><span>Choose a starting point</span></div></div>
          <div className="native-explorer__kind-tabs">
            <button className={kind === 'query' ? 'is-active' : ''} onClick={() => setKind('query')}>Queries <span>{schema.getQueryType() ? Object.keys(schema.getQueryType()!.getFields()).length.toLocaleString() : 0}</span></button>
            <button className={kind === 'mutation' ? 'is-active' : ''} onClick={() => setKind('mutation')}>Mutations <span>{schema.getMutationType() ? Object.keys(schema.getMutationType()!.getFields()).length.toLocaleString() : 0}</span></button>
          </div>
          <label className="native-explorer__search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind === 'query' ? 'queries' : 'mutations'}`} /></label>
          <div className="native-explorer__operation-list">
            {operations.map((field) => (
              <button type="button" key={field.name} onClick={() => selectOperation(field.name)} title={field.name}>
                <strong>{humanizeGraphQLName(field.name)}</strong><code>{field.name}</code>
              </button>
            ))}
            {!operations.length && <p>No matching operations.</p>}
          </div>
        </aside>

        <section className="native-explorer__editor">
          <div className="native-explorer__tabs" role="tablist">
            <button className={activeTab === 'operation' ? 'is-active' : ''} onClick={() => setActiveTab('operation')}>Operation</button>
            <button className={activeTab === 'variables' ? 'is-active' : ''} onClick={() => setActiveTab('variables')}>Variables</button>
            <button className={activeTab === 'headers' ? 'is-active' : ''} onClick={() => setActiveTab('headers')}><Settings2 size={13} /> Headers</button>
          </div>
          {activeTab === 'operation' && <textarea aria-label="GraphQL operation" spellCheck={false} value={document} onChange={(event) => setDocument(event.target.value)} />}
          {activeTab === 'variables' && <textarea aria-label="GraphQL variables" spellCheck={false} value={variables} onChange={(event) => setVariables(event.target.value)} />}
          {activeTab === 'headers' && <textarea aria-label="GraphQL headers" spellCheck={false} value={headers} onChange={(event) => setHeaders(event.target.value)} />}
          <footer><span>GraphQL schema validation runs before every request.</span><code>{document.length.toLocaleString()} chars</code></footer>
        </section>

        <section className="native-explorer__response">
          <div className="native-explorer__response-heading">
            <div><strong>Response</strong><span>JSON</span></div>
            {status === 'success' && <span className="is-success"><CheckCircle2 size={14} /> Success</span>}
            {status === 'error' && <span className="is-error"><CircleX size={14} /> Error</span>}
          </div>
          <pre><code>{result}</code></pre>
        </section>
      </div>
    </div>
  );
}

function getInitialOperation(schema: ReturnType<typeof useSchema>['schema']) {
  const root = schema.getQueryType();
  const field = root && Object.values(root.getFields())[0];
  if (!root || !field) return { document: 'query Example {\n  __typename\n}', variables: '{}' };
  return {
    document: generateOperation(schema, root.name, field.name),
    variables: JSON.stringify(generateOperationVariables(schema, root.name, field.name), null, 2),
  };
}

function parseJSONObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || '{}') as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

function parseStringRecord(value: string, label: string): Record<string, string> {
  const parsed = parseJSONObject(value, label);
  if (Object.values(parsed).some((entry) => typeof entry !== 'string')) throw new Error(`${label} values must be strings.`);
  return parsed as Record<string, string>;
}
