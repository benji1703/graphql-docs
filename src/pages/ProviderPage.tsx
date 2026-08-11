import { ArrowRight, ChevronRight, Layers3, Search, X } from 'lucide-react';
import { getNamedType, type GraphQLField } from 'graphql';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TypeBadge } from '../components/TypeBadge';
import { useSchema } from '../context/SchemaContext';
import { describeUndocumentedField, humanizeGraphQLName } from '../lib/descriptions';
import { getOperationProvider, operationMatchesProvider } from '../lib/operationProviders';
import { typePath } from '../lib/schema';
import { NotFoundPage } from './NotFoundPage';

const PAGE_SIZE = 100;
type ProviderOperationKind = 'all' | 'query' | 'mutation';
type ProviderOperation = {
  field: GraphQLField<unknown, unknown>;
  kind: Exclude<ProviderOperationKind, 'all'>;
  parentName: string;
};

export function ProviderPage() {
  const { providerId = '' } = useParams();
  const { schema } = useSchema();
  const provider = getOperationProvider(decodeURIComponent(providerId));
  const [kind, setKind] = useState<ProviderOperationKind>('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredSearch = useDeferredValue(search.trim());

  const queryOperations = useMemo(
    () => provider && schema.getQueryType()
      ? Object.values(schema.getQueryType()!.getFields()).filter((field) => operationMatchesProvider(field, provider.id))
      : [],
    [provider, schema],
  );
  const mutationOperations = useMemo(
    () => provider && schema.getMutationType()
      ? Object.values(schema.getMutationType()!.getFields()).filter((field) => operationMatchesProvider(field, provider.id))
      : [],
    [provider, schema],
  );
  const operations = useMemo<ProviderOperation[]>(() => {
    const queries = kind === 'mutation' ? [] : queryOperations.map((field) => ({ field, kind: 'query' as const, parentName: schema.getQueryType()!.name }));
    const mutations = kind === 'query' ? [] : mutationOperations.map((field) => ({ field, kind: 'mutation' as const, parentName: schema.getMutationType()!.name }));
    const normalizedSearch = normalizeSearch(deferredSearch);
    return [...queries, ...mutations].filter((operation) => matchesOperationSearch(operation.field, normalizedSearch));
  }, [deferredSearch, kind, mutationOperations, queryOperations, schema]);

  useEffect(() => {
    setKind('all');
    setSearch('');
    setVisibleCount(PAGE_SIZE);
  }, [providerId]);
  useEffect(() => setVisibleCount(PAGE_SIZE), [deferredSearch, kind]);

  if (!provider) return <NotFoundPage />;
  const total = queryOperations.length + mutationOperations.length;
  const visibleOperations = operations.slice(0, visibleCount);

  return (
    <div className="page provider-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Reference</Link><ChevronRight size={14} /><Link to="/providers">Providers</Link><ChevronRight size={14} /><strong>{provider.label}</strong>
      </nav>

      <header className="provider-hero">
        <span className="provider-hero__icon"><Layers3 size={25} /></span>
        <div>
          <div className="eyebrow">Provider stack</div>
          <h1>{provider.label}</h1>
          <p>Explore every {provider.label} query and mutation exposed by the Silverfort Cloud Platform schema.</p>
        </div>
      </header>

      <div className="provider-stats" aria-label={`${provider.label} operation counts`}>
        <div><strong>{total.toLocaleString()}</strong><span>Total operations</span></div>
        <div><strong>{queryOperations.length.toLocaleString()}</strong><span>Queries</span></div>
        <div><strong>{mutationOperations.length.toLocaleString()}</strong><span>Mutations</span></div>
      </div>

      <section className="provider-operations">
        <div className="provider-operations__toolbar">
          <div>
            <div className="eyebrow">API catalog</div>
            <h2>{provider.label} operations</h2>
          </div>
          <label className="provider-operations__search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${provider.label} operations`} aria-label={`Search ${provider.label} operations`} />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear provider operation search"><X size={15} /></button>}
          </label>
        </div>

        <div className="provider-kind-tabs" role="tablist" aria-label="Operation kind">
          <ProviderKindTab active={kind === 'all'} onClick={() => setKind('all')} label="All" count={total} />
          <ProviderKindTab active={kind === 'query'} onClick={() => setKind('query')} label="Queries" count={queryOperations.length} />
          <ProviderKindTab active={kind === 'mutation'} onClick={() => setKind('mutation')} label="Mutations" count={mutationOperations.length} />
        </div>

        {(search || kind !== 'all') && <p className="provider-operations__summary">{operations.length.toLocaleString()} matching {operations.length === 1 ? 'operation' : 'operations'}</p>}
        <div className="provider-operation-grid">
          {visibleOperations.map(({ field, kind: operationKind, parentName }) => (
            <Link to={typePath(parentName, field.name)} key={`${parentName}.${field.name}`}>
              <div><TypeBadge kind={operationKind} /><ArrowRight size={15} /></div>
              <h3>{humanizeGraphQLName(field.name)}</h3>
              <code>{field.name}</code>
              <p>{field.description || describeUndocumentedField(schema, parentName, field)}</p>
              <span>Returns <strong>{getNamedType(field.type).name}</strong></span>
            </Link>
          ))}
          {!operations.length && <div className="no-results">No {provider.label} operations match this search.</div>}
        </div>
        {operations.length > visibleCount && (
          <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Load {Math.min(PAGE_SIZE, operations.length - visibleCount).toLocaleString()} more
            <span>{(operations.length - visibleCount).toLocaleString()} remaining</span>
          </button>
        )}
      </section>
    </div>
  );
}

function ProviderKindTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <button type="button" role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick}><span>{label}</span><strong>{count.toLocaleString()}</strong></button>;
}

function matchesOperationSearch(field: GraphQLField<unknown, unknown>, normalizedSearch: string) {
  if (!normalizedSearch) return true;
  const searchable = normalizeSearch(`${field.name} ${humanizeGraphQLName(field.name)} ${field.description ?? ''} ${getNamedType(field.type).name}`);
  return normalizedSearch.split(' ').filter(Boolean).every((token) => searchable.includes(token));
}

function normalizeSearch(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}
