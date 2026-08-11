import { ArrowRight, ChevronRight, Layers3, Search, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchema } from '../context/SchemaContext';
import { getOperationProviderIds, operationMatchesProvider, PROVIDER_CATEGORIES, providerPath } from '../lib/operationProviders';

export function ProvidersPage() {
  const { schema } = useSchema();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const queryFields = useMemo(() => schema.getQueryType() ? Object.values(schema.getQueryType()!.getFields()) : [], [schema]);
  const mutationFields = useMemo(() => schema.getMutationType() ? Object.values(schema.getMutationType()!.getFields()) : [], [schema]);
  const providers = useMemo(() => PROVIDER_CATEGORIES.map((provider) => {
    const queryCount = queryFields.filter((field) => operationMatchesProvider(field, provider.id)).length;
    const mutationCount = mutationFields.filter((field) => operationMatchesProvider(field, provider.id)).length;
    return { ...provider, queryCount, mutationCount, total: queryCount + mutationCount };
  }).filter((provider) => provider.total > 0), [mutationFields, queryFields]);
  const visibleProviders = providers.filter((provider) => (
    !deferredSearch
    || provider.label.toLowerCase().includes(deferredSearch)
    || provider.id.includes(deferredSearch)
  ));
  const categorizedQueries = useMemo(() => queryFields.filter((field) => getOperationProviderIds(field).length > 0).length, [queryFields]);
  const categorizedMutations = useMemo(() => mutationFields.filter((field) => getOperationProviderIds(field).length > 0).length, [mutationFields]);

  return (
    <div className="page providers-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Reference</Link><ChevronRight size={14} /><strong>Providers</strong>
      </nav>

      <header className="providers-hero">
        <span className="providers-hero__icon"><Layers3 size={26} /></span>
        <div>
          <div className="eyebrow">Integration catalog</div>
          <h1>Providers</h1>
          <p>Browse the complete provider hierarchy behind the Silverfort Cloud Platform GraphQL schema.</p>
        </div>
      </header>

      <div className="provider-stats" aria-label="Provider catalog counts">
        <div><strong>{providers.length.toLocaleString()}</strong><span>Providers</span></div>
        <div><strong>{categorizedQueries.toLocaleString()}</strong><span>Categorized queries</span></div>
        <div><strong>{categorizedMutations.toLocaleString()}</strong><span>Categorized mutations</span></div>
      </div>

      <section className="providers-catalog">
        <div className="providers-catalog__toolbar">
          <div><div className="eyebrow">Provider stacks</div><h2>All providers</h2></div>
          <label className="provider-operations__search">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search providers" aria-label="Search providers" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear provider search"><X size={15} /></button>}
          </label>
        </div>

        {search && <p className="provider-operations__summary">{visibleProviders.length.toLocaleString()} matching {visibleProviders.length === 1 ? 'provider' : 'providers'}</p>}
        <div className="providers-grid">
          {visibleProviders.map((provider) => (
            <Link to={providerPath(provider.id)} key={provider.id}>
              <div className="providers-grid__top"><span><Layers3 size={19} /></span><ArrowRight size={16} /></div>
              <h3>{provider.label}</h3>
              <strong>{provider.total.toLocaleString()} operations</strong>
              <div className="providers-grid__counts">
                <span><b>{provider.queryCount.toLocaleString()}</b> Queries</span>
                <span><b>{provider.mutationCount.toLocaleString()}</b> Mutations</span>
              </div>
            </Link>
          ))}
          {!visibleProviders.length && <div className="no-results">No providers match “{search}”.</div>}
        </div>
      </section>
    </div>
  );
}
