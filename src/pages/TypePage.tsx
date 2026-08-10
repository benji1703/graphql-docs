import {
  AlertTriangle,
  ArrowRight,
  Box,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Play,
  Search,
  X,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLField,
  type GraphQLInputField,
  type GraphQLNamedType,
} from 'graphql';
import { Markdown } from '../components/Markdown';
import { TypeBadge } from '../components/TypeBadge';
import { useSchema } from '../context/SchemaContext';
import { formatFieldSignature, getTypeCategory, typePath } from '../lib/schema';
import { generateOperation } from '../lib/operation';
import { NotFoundPage } from './NotFoundPage';

const PAGE_SIZE = 100;

export function TypePage() {
  const { typeName = '', fieldName } = useParams();
  const { schema } = useSchema();
  const type = schema.getType(decodeURIComponent(typeName));
  const selectedField = fieldName ? decodeURIComponent(fieldName) : undefined;
  const [filter, setFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredFilter = useDeferredValue(filter);

  useEffect(() => {
    setFilter('');
    setVisibleCount(PAGE_SIZE);
  }, [typeName]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [deferredFilter]);

  useEffect(() => {
    if (!selectedField) return;
    requestAnimationFrame(() => document.getElementById(`definition-${CSS.escape(selectedField)}`)?.scrollIntoView({ block: 'center' }));
  }, [selectedField, type]);

  if (!type || type.name.startsWith('__')) return <NotFoundPage />;

  const category = getTypeCategory(type);
  const filterValue = deferredFilter.trim();
  const definitionTitle = getDefinitionTitle(type, schema);

  return (
    <div className="page reference-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Reference</Link><ChevronRight size={14} /><span>{category}</span><ChevronRight size={14} /><strong>{type.name}</strong>
      </nav>

      <header className="type-header">
        <div className="type-header__icon"><Box size={22} /></div>
        <div className="type-header__copy">
          <div><TypeBadge kind={category} />{isRootType(schema, type) && <span className="root-label">Root operation</span>}</div>
          <h1>{type.name}</h1>
          {type.description ? <Markdown>{type.description}</Markdown> : <p className="type-summary">{getGeneratedTypeSummary(type, schema)}</p>}
        </div>
        {isRootType(schema, type) && <Link className="button button--secondary type-header__try" to="/explorer"><Play size={14} fill="currentColor" /> Try in Explorer</Link>}
      </header>

      <TypeRelationships type={type} schema={schema} />

      {(isObjectType(type) || isInterfaceType(type)) && (
        <DefinitionList
          title={definitionTitle}
          count={Object.keys(type.getFields()).length}
          filter={filter}
          isFiltering={filter !== deferredFilter}
          setFilter={setFilter}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          selectedName={selectedField}
          items={Object.values(type.getFields()).filter((field) => matchesDefinitionFilter(field, filterValue))}
          render={(field) => <OutputFieldCard schema={schema} parentName={type.name} field={field} selected={field.name === selectedField} isOperation={isRootType(schema, type)} />}
        />
      )}

      {isInputObjectType(type) && (
        <DefinitionList
          title="Input fields"
          count={Object.keys(type.getFields()).length}
          filter={filter}
          isFiltering={filter !== deferredFilter}
          setFilter={setFilter}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          selectedName={selectedField}
          items={Object.values(type.getFields()).filter((field) => matchesDefinitionFilter(field, filterValue))}
          render={(field) => <InputFieldCard field={field} selected={field.name === selectedField} />}
        />
      )}

      {isEnumType(type) && (
        <DefinitionList
          title="Values"
          count={type.getValues().length}
          filter={filter}
          isFiltering={filter !== deferredFilter}
          setFilter={setFilter}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          selectedName={selectedField}
          items={type.getValues().filter((value) => matchesDefinitionFilter(value, filterValue))}
          render={(value) => (
            <article id={`definition-${value.name}`} className={`definition-card definition-card--compact ${value.name === selectedField ? 'is-selected' : ''}`}>
              <div className="definition-card__main"><CircleDot size={16} /><code>{value.name}</code>{value.deprecationReason && <TypeBadge kind="deprecated" />}</div>
              {value.description && <Markdown>{value.description}</Markdown>}
              {value.deprecationReason && <div className="deprecation"><AlertTriangle size={15} />{value.deprecationReason}</div>}
            </article>
          )}
        />
      )}

      {isUnionType(type) && (
        <section className="definition-section">
          <SectionTitle title="Possible types" count={type.getTypes().length} />
          <div className="member-grid">{type.getTypes().map((member) => <Link to={typePath(member.name)} key={member.name}><Box size={17} /><span>{member.name}</span><ArrowRight size={14} /></Link>)}</div>
        </section>
      )}

      {isScalarType(type) && (
        <section className="scalar-note">
          <div className="scalar-note__icon"><CircleDot size={20} /></div>
          <div><h2>Custom scalar</h2><p>Clients and servers must agree on the serialization format for <code>{type.name}</code>.</p>
          {type.specifiedByURL && <a href={type.specifiedByURL} target="_blank" rel="noreferrer">Scalar specification <ExternalLink size={13} /></a>}</div>
        </section>
      )}
    </div>
  );
}

function DefinitionList<T extends { name: string }>({ title, count, filter, isFiltering, setFilter, visibleCount, onLoadMore, selectedName, items, render }: {
  title: string;
  count: number;
  filter: string;
  isFiltering: boolean;
  setFilter: (value: string) => void;
  visibleCount: number;
  onLoadMore: () => void;
  selectedName?: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  const visibleItems = useMemo(() => {
    const page = items.slice(0, visibleCount);
    const selected = selectedName ? items.find((item) => item.name === selectedName) : undefined;
    return selected && !page.includes(selected) ? [...page, selected] : page;
  }, [items, visibleCount, selectedName]);

  return (
    <section className="definition-section">
      <div className="definition-section__toolbar">
        <SectionTitle title={title} count={count} />
        {count > 12 && (
          <label className="field-filter">
            <Search size={16} />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={`Search ${count.toLocaleString()} ${title.toLowerCase()}`}
              aria-label={`Search ${title.toLowerCase()}`}
            />
            {filter && <button type="button" onClick={() => setFilter('')} aria-label="Clear field search"><X size={14} /></button>}
          </label>
        )}
      </div>
      {filter && <div className="filter-summary">{isFiltering ? 'Searching the full type…' : `${items.length.toLocaleString()} ${items.length === 1 ? 'match' : 'matches'} for “${filter}”`}</div>}
      <div className="definition-list">
        {visibleItems.map((item) => <div key={item.name}>{render(item)}</div>)}
        {!items.length && <div className="no-results">No definitions match “{filter}”.</div>}
      </div>
      {items.length > visibleCount && <button className="load-more" onClick={onLoadMore}>Load {Math.min(PAGE_SIZE, items.length - visibleCount).toLocaleString()} more <span>{(items.length - visibleCount).toLocaleString()} remaining</span></button>}
    </section>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <div className="section-title"><h2>{title}</h2><span>{count.toLocaleString()}</span></div>;
}

function OutputFieldCard({ schema, parentName, field, selected, isOperation }: { schema: ReturnType<typeof useSchema>['schema']; parentName: string; field: GraphQLField<unknown, unknown>; selected: boolean; isOperation: boolean }) {
  const namedType = getNamedType(field.type);
  return (
    <article id={`definition-${field.name}`} className={`definition-card ${selected ? 'is-selected' : ''}`}>
      <div className="definition-card__signature"><code>{formatFieldSignature(field)}</code>{field.deprecationReason && <TypeBadge kind="deprecated" />}</div>
      {field.description && <Markdown>{field.description}</Markdown>}
      {field.deprecationReason && <div className="deprecation"><AlertTriangle size={15} />{field.deprecationReason}</div>}
      {field.args.length > 0 && (
        <div className="argument-table">
          <div className="argument-table__title">Arguments</div>
          {field.args.map((argument) => (
            <div className="argument-row" key={argument.name}>
              <code className="argument-signature">
                <span>{argument.name}: </span>
                <Link to={typePath(getNamedType(argument.type).name)}>{String(argument.type)}</Link>
                {argument.defaultValue !== undefined && <span> = {JSON.stringify(argument.defaultValue)}</span>}
              </code>
              <span>{argument.description || formatArgumentFallback(argument.name)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="definition-card__footer">
        <span>Returns</span><Link to={typePath(namedType.name)}><code>{String(field.type)}</code><ArrowRight size={13} /></Link>
        {isOperation && <Link className="definition-card__try" to={`/explorer?document=${encodeURIComponent(generateOperation(schema, parentName, field.name))}`}><Play size={11} fill="currentColor" /> Try operation</Link>}
        <Link className="definition-card__permalink" to={typePath(parentName, field.name)}>Permalink</Link>
      </div>
    </article>
  );
}

function InputFieldCard({ field, selected }: { field: GraphQLInputField; selected: boolean }) {
  const namedType = getNamedType(field.type);
  return (
    <article id={`definition-${field.name}`} className={`definition-card ${selected ? 'is-selected' : ''}`}>
      <div className="definition-card__signature"><code>{field.name}: {String(field.type)}{field.defaultValue === undefined ? '' : ` = ${JSON.stringify(field.defaultValue)}`}</code>{field.deprecationReason && <TypeBadge kind="deprecated" />}</div>
      {field.description && <Markdown>{field.description}</Markdown>}
      <div className="definition-card__footer"><span>Type</span><Link to={typePath(namedType.name)}><code>{String(field.type)}</code><ArrowRight size={13} /></Link></div>
    </article>
  );
}

function TypeRelationships({ type, schema }: { type: GraphQLNamedType; schema: ReturnType<typeof useSchema>['schema'] }) {
  const relations: Array<{ label: string; values: readonly GraphQLNamedType[] }> = [];
  if (isObjectType(type) && type.getInterfaces().length) relations.push({ label: 'Implements', values: type.getInterfaces() });
  if (isInterfaceType(type)) {
    const possible = schema.getPossibleTypes(type);
    if (possible.length) relations.push({ label: 'Implemented by', values: possible });
  }
  if (!relations.length) return null;
  return <div className="relationships">{relations.map((relation) => <div key={relation.label}><span>{relation.label}</span><div>{relation.values.map((value) => <Link to={typePath(value.name)} key={value.name}>{value.name}</Link>)}</div></div>)}</div>;
}

function matchesDefinitionFilter(
  definition: { name: string; description?: string | null; type?: { toString(): string }; args?: readonly { name: string; type: { toString(): string }; description?: string | null }[] },
  query: string,
) {
  if (!query) return true;
  const searchable = normalizeForSearch([
    definition.name,
    definition.description,
    definition.type?.toString(),
    ...(definition.args?.flatMap((argument) => [argument.name, argument.type.toString(), argument.description]) ?? []),
  ].filter(Boolean).join(' '));
  const words = searchable.split(' ');

  return normalizeForSearch(query)
    .split(' ')
    .filter(Boolean)
    .every((token) => searchable.includes(token) || words.some((word) => isSubsequence(token, word)));
}

function normalizeForSearch(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSubsequence(query: string, candidate: string) {
  if (query.length < 3) return false;
  let queryIndex = 0;
  for (const character of candidate) {
    if (character === query[queryIndex]) queryIndex++;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function isRootType(schema: ReturnType<typeof useSchema>['schema'], type: GraphQLNamedType) {
  return [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()].some((root) => root?.name === type.name);
}

function getDefinitionTitle(type: GraphQLNamedType, schema: ReturnType<typeof useSchema>['schema']) {
  if (schema.getQueryType()?.name === type.name) return 'Queries';
  if (schema.getMutationType()?.name === type.name) return 'Mutations';
  if (schema.getSubscriptionType()?.name === type.name) return 'Subscriptions';
  return 'Fields';
}

function getGeneratedTypeSummary(type: GraphQLNamedType, schema: ReturnType<typeof useSchema>['schema']) {
  if (isEnumType(type)) return `Enum with ${type.getValues().length.toLocaleString()} allowed values.`;
  if (isInputObjectType(type)) return `Input object with ${Object.keys(type.getFields()).length.toLocaleString()} configurable fields.`;
  if (isUnionType(type)) return `Union of ${type.getTypes().length.toLocaleString()} possible object types.`;
  if (isInterfaceType(type)) return `Interface implemented by ${schema.getPossibleTypes(type).length.toLocaleString()} object types.`;
  if (isScalarType(type)) return 'Custom scalar value used by the Silverfort Cloud Platform API.';
  if (isObjectType(type)) {
    const fieldCount = Object.keys(type.getFields()).length;
    if (schema.getQueryType()?.name === type.name) return `Entry point for ${fieldCount.toLocaleString()} available query operations.`;
    if (schema.getMutationType()?.name === type.name) return `Entry point for ${fieldCount.toLocaleString()} available mutation operations.`;
    if (schema.getSubscriptionType()?.name === type.name) return `Entry point for ${fieldCount.toLocaleString()} available subscriptions.`;
    return `Object type exposing ${fieldCount.toLocaleString()} fields.`;
  }
  return 'GraphQL type in the Silverfort Cloud Platform API.';
}

function formatArgumentFallback(name: string) {
  return `Value for the ${name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()} argument.`;
}
