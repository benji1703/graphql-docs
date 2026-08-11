import {
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Filter,
  GripHorizontal,
  ListTree,
  Play,
  Plus,
  Search,
  Settings2,
} from 'lucide-react';
import { isObjectType, parse, validate } from 'graphql';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { siteConfig } from '../config';
import { useSchema } from '../context/SchemaContext';
import { humanizeGraphQLName } from '../lib/descriptions';
import { getExplorerCatalog } from '../lib/explorerCatalog';
import { createExplorerHeaders } from '../lib/explorerHeaders';
import { generateOperation, generateOperationVariables, getOperationBuilderDefaults } from '../lib/operation';
import { typePath } from '../lib/schema';

type OperationKind = 'query' | 'mutation';
type RequestOption = 'variables' | 'headers';
type SidePanel = 'operations' | 'schema';

const explorerCredentialMemory = { organization: '', authorization: '' };

export function ExplorerPage() {
  const { explorerEndpoint, schema } = useSchema();
  const [searchParams] = useSearchParams();
  const initial = useMemo(() => getInitialOperation(schema), [schema]);
  const [kind, setKind] = useState<OperationKind>('query');
  const [search, setSearch] = useState('');
  const [sidePanel, setSidePanel] = useState<SidePanel>('operations');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [requestOption, setRequestOption] = useState<RequestOption>('variables');
  const [document, setDocument] = useState(searchParams.get('document') ?? initial.document);
  const [variables, setVariables] = useState(searchParams.get('variables') ?? initial.variables);
  const [selectedOperation, setSelectedOperation] = useState({ rootName: initial.rootName, fieldName: initial.fieldName });
  const [selectedArgumentNames, setSelectedArgumentNames] = useState(initial.argumentNames);
  const [selectedFieldNames, setSelectedFieldNames] = useState(initial.fieldNames);
  const [selectedFilterNames, setSelectedFilterNames] = useState<string[]>([]);
  const [organization, setOrganization] = useState(explorerCredentialMemory.organization);
  const [authorization, setAuthorization] = useState(explorerCredentialMemory.authorization);
  const [result, setResult] = useState('Run an operation to see its response.');
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false);
  const [operationHeight, setOperationHeight] = useState<number | null>(null);
  const requestScrollRef = useRef<HTMLDivElement>(null);
  const operationSectionRef = useRef<HTMLElement>(null);
  const requestOptionsRef = useRef<HTMLElement>(null);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const organizationInputRef = useRef<HTMLInputElement>(null);
  const authorizationInputRef = useRef<HTMLInputElement>(null);
  const headerCount = Number(Boolean(organization.trim())) + Number(Boolean(authorization.trim()));
  const requestEndpoint = siteConfig.explorerProxyEndpoint || explorerEndpoint;
  const catalog = useMemo(
    () => getExplorerCatalog(schema, selectedOperation.rootName, selectedOperation.fieldName),
    [schema, selectedOperation],
  );
  const builderArguments = useMemo(() => {
    const root = schema.getType(selectedOperation.rootName);
    if (!isObjectType(root)) return [];
    return root.getFields()[selectedOperation.fieldName]?.args ?? [];
  }, [schema, selectedOperation]);

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
    const operation = { rootName: rootType.name, fieldName };
    const defaults = getOperationBuilderDefaults(schema, operation.rootName, operation.fieldName);
    applyBuilderSelection(operation, defaults.argumentNames, defaults.fieldNames, []);
    setSidePanel('schema');
    setResult('Run the selected operation to see its response.');
    setStatus('idle');
  };

  const applyBuilderSelection = (
    operation: { rootName: string; fieldName: string },
    argumentNames: string[],
    fieldNames: string[],
    filterFieldNames: string[],
  ) => {
    const options = { argumentNames, fieldNames, filterFieldNames };
    setDocument(generateOperation(schema, operation.rootName, operation.fieldName, options));
    setVariables(JSON.stringify(generateOperationVariables(schema, operation.rootName, operation.fieldName, options), null, 2));
    setSelectedOperation(operation);
    setSelectedArgumentNames(argumentNames);
    setSelectedFieldNames(fieldNames);
    setSelectedFilterNames(filterFieldNames);
  };

  const toggleArgument = (name: string) => {
    const nextArguments = selectedArgumentNames.includes(name)
      ? selectedArgumentNames.filter((entry) => entry !== name)
      : [...selectedArgumentNames, name];
    const requiredArguments = getOperationBuilderDefaults(schema, selectedOperation.rootName, selectedOperation.fieldName).argumentNames;
    const safeArguments = [...new Set([...requiredArguments, ...nextArguments])];
    const nextFilters = name === 'filter' && !safeArguments.includes('filter') ? [] : selectedFilterNames;
    applyBuilderSelection(selectedOperation, safeArguments, selectedFieldNames, nextFilters);
  };

  const toggleFilter = (name: string) => {
    const nextFilters = selectedFilterNames.includes(name)
      ? selectedFilterNames.filter((entry) => entry !== name)
      : [...selectedFilterNames, name];
    const requiredArguments = getOperationBuilderDefaults(schema, selectedOperation.rootName, selectedOperation.fieldName).argumentNames;
    const retainedArguments = nextFilters.length
      ? [...selectedArgumentNames, 'filter']
      : selectedArgumentNames.filter((entry) => entry !== 'filter');
    const nextArguments = [...new Set([...requiredArguments, ...retainedArguments])];
    applyBuilderSelection(selectedOperation, nextArguments, selectedFieldNames, nextFilters);
  };

  const toggleField = (name: string) => {
    const nextFields = selectedFieldNames.includes(name)
      ? selectedFieldNames.filter((entry) => entry !== name)
      : [...selectedFieldNames, name];
    applyBuilderSelection(selectedOperation, selectedArgumentNames, nextFields, selectedFilterNames);
  };

  const runOperation = async () => {
    setIsRunning(true);
    setStatus('idle');
    try {
      const parsedDocument = parse(document);
      const validationErrors = validate(schema, parsedDocument);
      if (validationErrors.length) throw new Error(validationErrors.map((error) => error.message).join('\n'));
      const parsedVariables = parseJSONObject(variables, 'Variables');
      const requestHeaders = createExplorerHeaders(organization, authorization);
      const response = await fetch(requestEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...requestHeaders },
        body: JSON.stringify({ query: document, variables: parsedVariables }),
      });
      const payload = await response.json() as unknown;
      setResult(JSON.stringify(payload, null, 2));
      setStatus(response.ok ? 'success' : 'error');
    } catch (reason) {
      if (reason instanceof Error && /Organization|Authorization token/.test(reason.message)) {
        setRequestOption('headers');
        setShowCredentialPrompt(true);
      }
      const message = reason instanceof TypeError
        ? `Live execution was blocked by CORS. Allow ${window.location.origin}, POST, and the Authorization and Organization headers on ${new URL(requestEndpoint, window.location.href).origin}.`
        : reason instanceof Error ? reason.message : 'The operation could not be executed.';
      setResult(JSON.stringify({ errors: [{ message }] }, null, 2));
      setStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const focusMissingCredential = () => {
    setShowCredentialPrompt(false);
    setRequestOption('headers');
    window.setTimeout(() => {
      (organization.trim() ? authorizationInputRef : organizationInputRef).current?.focus();
    }, 0);
  };

  const resizeOperation = (clientY: number) => {
    const start = resizeStartRef.current;
    const viewportHeight = requestScrollRef.current?.clientHeight ?? 720;
    if (!start) return;
    const minimum = Math.max(420, viewportHeight * 0.52);
    const maximum = Math.max(minimum, viewportHeight * 1.25);
    setOperationHeight(Math.min(maximum, Math.max(minimum, start.height + clientY - start.y)));
  };

  return (
    <div className="native-explorer">
      <header className="native-explorer__toolbar">
        <div><span className="status-dot" /><strong>Embedded GraphQL Explorer</strong><code>{explorerEndpoint}</code>{siteConfig.explorerProxyEndpoint && <span className="native-explorer__relay-status">Secure relay</span>}</div>
        <div className="native-explorer__schema-status"><CheckCircle2 size={14} /> Schema loaded locally</div>
        <button className="native-explorer__run" type="button" onClick={() => void runOperation()} disabled={isRunning}>
          <Play size={13} fill="currentColor" /> {isRunning ? 'Running…' : 'Run operation'}
        </button>
      </header>

      <div className="native-explorer__workspace">
        <aside className="native-explorer__operations">
          <div className="native-explorer__panel-title"><Braces size={16} /><div><strong>{sidePanel === 'operations' ? 'Operations' : 'Schema inspector'}</strong><span>{sidePanel === 'operations' ? 'Choose a starting point' : humanizeGraphQLName(selectedOperation.fieldName)}</span></div></div>
          <div className="native-explorer__side-tabs">
            <button className={sidePanel === 'operations' ? 'is-active' : ''} onClick={() => setSidePanel('operations')}><Braces size={13} /> Operations</button>
            <button className={sidePanel === 'schema' ? 'is-active' : ''} onClick={() => setSidePanel('schema')}><ListTree size={13} /> Schema</button>
          </div>
          {sidePanel === 'operations' ? (
            <>
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
            </>
          ) : (
            <div className="native-explorer__schema-catalog">
              <CatalogGroup
                icon={<Filter size={14} />}
                title={catalog.filterType ? 'Available filters' : 'Available arguments'}
                typeName={catalog.filterType}
                items={catalog.filters}
                selectedNames={catalog.filterType ? selectedFilterNames : selectedArgumentNames}
                onToggle={catalog.filterType ? toggleFilter : toggleArgument}
              />
              <CatalogGroup
                icon={<ListTree size={14} />}
                title="Available fields"
                typeName={catalog.responseType}
                items={catalog.fields}
                selectedNames={selectedFieldNames}
                onToggle={toggleField}
              />
            </div>
          )}
        </aside>

        <section className="native-explorer__editor">
          <div className="native-explorer__request-scroll" ref={requestScrollRef}>
            <section
              className="native-explorer__request-section native-explorer__request-section--operation"
              aria-labelledby="explorer-operation-heading"
              ref={operationSectionRef}
              style={operationHeight ? { height: operationHeight } : undefined}
            >
              <header className="native-explorer__section-heading">
                <div><Braces size={14} /><strong id="explorer-operation-heading">Operation</strong></div>
                <span>GraphQL</span>
              </header>
              <textarea aria-label="GraphQL operation" spellCheck={false} value={document} onChange={(event) => setDocument(event.target.value)} />
            </section>

            <div className="native-explorer__resize-rail">
              <span aria-hidden="true" />
              <button
                className="native-explorer__resize-handle"
                type="button"
                aria-label="Drag to resize the Operation editor"
                onDoubleClick={() => setOperationHeight(null)}
                onPointerDown={(event) => {
                  resizeStartRef.current = { y: event.clientY, height: operationSectionRef.current?.getBoundingClientRect().height ?? 480 };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => resizeOperation(event.clientY)}
                onPointerUp={(event) => {
                  resizeStartRef.current = null;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
              >
                <GripHorizontal size={16} /> <span>Drag to resize</span>
              </button>
              <button className="native-explorer__jump-options" type="button" onClick={() => requestOptionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Variables <ChevronDown size={13} />
              </button>
            </div>

            <section className="native-explorer__request-options" ref={requestOptionsRef}>
              <div className="native-explorer__tabs" role="tablist" aria-label="Request options">
                <button role="tab" aria-selected={requestOption === 'variables'} className={requestOption === 'variables' ? 'is-active' : ''} onClick={() => setRequestOption('variables')}>
                  <Braces size={13} /> Variables
                </button>
                <button role="tab" aria-selected={requestOption === 'headers'} className={requestOption === 'headers' ? 'is-active' : ''} onClick={() => setRequestOption('headers')}>
                  <Settings2 size={13} /> Headers
                  <span className={headerCount === 2 ? 'native-explorer__ready-count' : 'native-explorer__required-count'}>{headerCount === 2 ? 'Ready' : `${headerCount}/2 required`}</span>
                </button>
              </div>

              {requestOption === 'variables' && (
                <div className="native-explorer__variables-panel">
                  <div className="native-explorer__variable-suggestions">
                    <div>
                      <strong>Variables for {humanizeGraphQLName(selectedOperation.fieldName)}</strong>
                      <span>Only arguments declared by this query are shown. Optional values stay omitted until selected.</span>
                    </div>
                    <div>
                      {builderArguments.map((argument) => {
                        const selected = selectedArgumentNames.includes(argument.name);
                        return (
                          <button type="button" key={argument.name} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => toggleArgument(argument.name)} title={String(argument.type)}>
                            {selected ? <CheckCircle2 size={12} /> : <Plus size={12} />} {argument.name}
                          </button>
                        );
                      })}
                      {!builderArguments.length && <span className="native-explorer__no-variables">This query has no variables.</span>}
                    </div>
                  </div>
                  <textarea className="native-explorer__variables-editor" aria-label="GraphQL variables" spellCheck={false} value={variables} onChange={(event) => setVariables(event.target.value)} />
                </div>
              )}

              {requestOption === 'headers' && (
                <div className="native-explorer__headers-form">
                  <p className="native-explorer__headers-copy">Configure once for this tab. Both values are required to run an operation.</p>
                  <div className="native-explorer__headers-grid">
                    <label>
                      <span>Organization <em>Required</em></span>
                      <input
                        ref={organizationInputRef}
                        aria-label="Organization header"
                        autoComplete="off"
                        placeholder="Customer organization ID"
                        spellCheck={false}
                        value={organization}
                        onChange={(event) => {
                          explorerCredentialMemory.organization = event.target.value;
                          setOrganization(event.target.value);
                        }}
                      />
                    </label>
                    <label>
                      <span>Authorization <em>Required</em></span>
                      <div className="native-explorer__token-input">
                        <b>Bearer</b>
                        <input
                          ref={authorizationInputRef}
                          aria-label="Authorization bearer token"
                          autoComplete="off"
                          placeholder="Paste access token"
                          spellCheck={false}
                          type="password"
                          value={authorization}
                          onChange={(event) => {
                            explorerCredentialMemory.authorization = event.target.value;
                            setAuthorization(event.target.value);
                          }}
                        />
                      </div>
                    </label>
                  </div>
                  <p className="native-explorer__credential-note">Held only in this browser tab—never saved or added to the URL.</p>
                </div>
              )}
            </section>
          </div>
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

      {showCredentialPrompt && (
        <div className="native-explorer__prompt-backdrop" role="presentation" onMouseDown={() => setShowCredentialPrompt(false)}>
          <div className="native-explorer__prompt" role="dialog" aria-modal="true" aria-labelledby="credential-prompt-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="native-explorer__prompt-icon"><Settings2 size={22} /></span>
            <div className="eyebrow">Action required</div>
            <h2 id="credential-prompt-title">Configure request headers</h2>
            <p>Silverfort requires an <strong>Organization</strong> and an <strong>Authorization Bearer token</strong> before this operation can run.</p>
            <button type="button" onClick={focusMissingCredential}>Configure headers</button>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitialOperation(schema: ReturnType<typeof useSchema>['schema']) {
  const root = schema.getQueryType();
  const field = root && Object.values(root.getFields())[0];
  if (!root || !field) return { document: 'query Example {\n  __typename\n}', variables: '{}', rootName: 'Query', fieldName: '__typename', argumentNames: [], fieldNames: [] };
  const defaults = getOperationBuilderDefaults(schema, root.name, field.name);
  const options = { argumentNames: defaults.argumentNames, fieldNames: defaults.fieldNames };
  return {
    document: generateOperation(schema, root.name, field.name, options),
    variables: JSON.stringify(generateOperationVariables(schema, root.name, field.name, options), null, 2),
    rootName: root.name,
    fieldName: field.name,
    ...defaults,
  };
}

function CatalogGroup({ icon, title, typeName, items, selectedNames, onToggle }: {
  icon: React.ReactNode;
  title: string;
  typeName?: string;
  items: Array<{ name: string; type: string }>;
  selectedNames: string[];
  onToggle: (name: string) => void;
}) {
  const visibleItems = items.slice(0, 100);
  return (
    <div className="native-explorer__catalog-group">
      <header>
        <div>{icon}<strong>{title}</strong><span>{items.length.toLocaleString()}</span></div>
        {typeName && <Link to={typePath(typeName)}>{typeName}</Link>}
      </header>
      <div className="native-explorer__catalog-items">
        {visibleItems.map((item) => {
          const selected = selectedNames.includes(item.name);
          return (
            <div className={selected ? 'is-selected' : ''} key={item.name}>
              <button type="button" aria-label={`${selected ? 'Remove' : 'Add'} ${item.name}`} aria-pressed={selected} onClick={() => onToggle(item.name)}>
                {selected ? <CheckCircle2 size={13} /> : <Plus size={13} />}
              </button>
              {typeName ? (
                <Link to={typePath(typeName, item.name)} title={`Open ${item.name}: ${item.type}`}>
                  <code>{item.name}</code><span>{item.type}</span>
                </Link>
              ) : (
                <span className="native-explorer__catalog-copy"><code>{item.name}</code><span>{item.type}</span></span>
              )}
            </div>
          );
        })}
        {!items.length && <p>No schema fields are available.</p>}
      </div>
      {items.length > visibleItems.length && <footer>+ {(items.length - visibleItems.length).toLocaleString()} more in the full type reference</footer>}
    </div>
  );
}

function parseJSONObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || '{}') as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}
