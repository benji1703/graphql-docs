import { ArrowRight, Command, FileInput, Layers3 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSchema } from '../context/SchemaContext';
import { formatFieldSignature, getTypeGroups, typePath } from '../lib/schema';

export function OverviewPage() {
  const { schema } = useSchema();
  const groups = useMemo(() => getTypeGroups(schema), [schema]);
  const roots = [
    { label: 'Queries', type: schema.getQueryType(), accent: 'query' },
    { label: 'Mutations', type: schema.getMutationType(), accent: 'mutation' },
    { label: 'Subscriptions', type: schema.getSubscriptionType(), accent: 'subscription' },
  ].filter((entry) => entry.type);

  return (
    <div className="page overview-page">
      <section className="page-section">
        <div className="section-heading">
          <div><div className="eyebrow">Entry points</div><h2>Root operations</h2></div>
          <span>Start where every GraphQL request begins.</span>
        </div>
        <div className="operation-columns">
          {roots.map(({ label, type, accent }) => {
            const fields = Object.values(type!.getFields());
            return (
              <article className={`operation-panel operation-panel--${accent}`} key={type!.name}>
                <div className="operation-panel__header">
                  <div><span className="operation-panel__icon"><Layers3 size={17} /></span><h3>{label}</h3></div>
                  <span>{fields.length.toLocaleString()}</span>
                </div>
                <div className="operation-panel__list">
                  {fields.slice(0, 6).map((field) => (
                    <Link to={typePath(type!.name, field.name)} key={field.name}>
                      <code>{field.name}</code>
                      <span>{field.description ? field.description.split('\n')[0] : formatFieldSignature(field)}</span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
                <Link className="operation-panel__all" to={typePath(type!.name)}>
                  View all {fields.length.toLocaleString()} {label.toLowerCase()} <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <div><div className="eyebrow">Schema map</div><h2>Types at a glance</h2></div>
          <span>Explore the building blocks behind every response.</span>
        </div>
        <div className="type-grid">
          {groups.map((group) => (
            <article className="type-group-card" key={group.category}>
              <div className="type-group-card__header">
                <span className={`schema-icon schema-icon--${group.category}`}><FileInput size={17} /></span>
                <div><h3>{group.label}</h3><span>{group.types.length.toLocaleString()} types</span></div>
              </div>
              <div className="type-group-card__links">
                {group.types.slice(0, 5).map((type) => <Link to={typePath(type.name)} key={type.name}>{type.name}</Link>)}
                {group.types.length > 5 && <span>+ {Math.max(0, group.types.length - 5).toLocaleString()} more</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="search-callout">
        <div className="search-callout__icon"><Command size={24} /></div>
        <div>
          <div className="eyebrow">Built for large schemas</div>
          <h2>Jump straight to what you need.</h2>
          <p>Fuzzy-find types, root operations, nested fields, and arguments without clicking through a tree.</p>
        </div>
        <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
          <span>Search anything…</span><kbd>⌘ K</kbd>
        </button>
      </section>

      {schema.description && <p className="schema-description">{schema.description}</p>}
    </div>
  );
}
