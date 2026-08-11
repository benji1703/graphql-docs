import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSchema } from '../context/SchemaContext';
import { getOperationProviderBuckets } from '../lib/operationProviders';
import { getTypeGroups, typePath } from '../lib/schema';

const MAX_VISIBLE_PER_GROUP = 80;

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { schema } = useSchema();
  const groups = useMemo(() => getTypeGroups(schema), [schema]);
  const [filter, setFilter] = useState('');
  const providerCount = useMemo(() => {
    const operations = [
      ...Object.values(schema.getQueryType()?.getFields() ?? {}),
      ...Object.values(schema.getMutationType()?.getFields() ?? {}),
    ];
    return getOperationProviderBuckets(operations).filter((bucket) => bucket.id !== 'all' && bucket.id !== 'other').length;
  }, [schema]);
  const roots = [
    { label: 'Queries', type: schema.getQueryType() },
    { label: 'Mutations', type: schema.getMutationType() },
    { label: 'Subscriptions', type: schema.getSubscriptionType() },
  ].filter((entry) => entry.type);

  const normalizedFilter = filter.trim().toLowerCase();

  return (
    <aside className="sidebar" aria-label="Schema navigation">
      <div className="sidebar__scroll">
        <NavLink className="sidebar__overview" to="/" end onClick={onNavigate}>
          Overview
        </NavLink>

        <div className="sidebar__section">
          <div className="sidebar__heading">API reference</div>
          <NavLink className="sidebar__root-link" to="/providers" onClick={onNavigate}>
            <span>Providers</span>
            <span className="sidebar__count">{providerCount}</span>
          </NavLink>
          {roots.map(({ label, type }) => (
            <NavLink
              className="sidebar__root-link"
              to={typePath(type!.name)}
              key={type!.name}
              onClick={onNavigate}
            >
              <span>{label}</span>
              <span className="sidebar__count">{Object.keys(type!.getFields()).length}</span>
            </NavLink>
          ))}
        </div>

        <label className="sidebar__filter">
          <Search size={14} aria-hidden="true" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter types"
            aria-label="Filter schema types"
          />
        </label>

        {groups.map((group) => {
          const matches = normalizedFilter
            ? group.types.filter((type) => type.name.toLowerCase().includes(normalizedFilter))
            : group.types;
          if (!matches.length && normalizedFilter) return null;
          const visible = matches.slice(0, MAX_VISIBLE_PER_GROUP);
          const hiddenCount = matches.length - visible.length;

          return (
            <details className="sidebar__group" key={group.category} open={normalizedFilter.length > 0}>
              <summary>
                <ChevronDown size={14} aria-hidden="true" />
                <span>{group.label}</span>
                <span className="sidebar__count">{group.types.length}</span>
              </summary>
              <div className="sidebar__items">
                {visible.map((type) => (
                  <NavLink to={typePath(type.name)} key={type.name} onClick={onNavigate}>
                    {type.name}
                  </NavLink>
                ))}
                {hiddenCount > 0 && (
                  <div className="sidebar__more">
                    {hiddenCount.toLocaleString()} more — filter or press <kbd>⌘ K</kbd>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </aside>
  );
}
