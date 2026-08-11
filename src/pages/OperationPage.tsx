import {
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  Copy,
  Layers3,
  Play,
} from 'lucide-react';
import { getNamedType, isInterfaceType, isObjectType, type GraphQLObjectType, type GraphQLSchema } from 'graphql';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { TypeBadge } from '../components/TypeBadge';
import { describeUndocumentedArgument, describeUndocumentedField, humanizeGraphQLName } from '../lib/descriptions';
import { generateOperation, generateOperationVariables } from '../lib/operation';
import { getOperationProviders, providerPath } from '../lib/operationProviders';
import { formatFieldSignature, typePath } from '../lib/schema';
import { getSimilarOperations } from '../lib/similarOperations';
import { NotFoundPage } from './NotFoundPage';

interface OperationPageProps {
  schema: GraphQLSchema;
  parentType: GraphQLObjectType;
  fieldName: string;
}

export function OperationPage({ schema, parentType, fieldName }: OperationPageProps) {
  const field = parentType.getFields()[fieldName];
  const [copied, setCopied] = useState<'operation' | 'variables' | null>(null);
  const similarOperations = useMemo(
    () => getSimilarOperations(schema, parentType.name, fieldName),
    [schema, parentType, fieldName],
  );

  if (!field) return <NotFoundPage />;

  const operation = generateOperation(schema, parentType.name, field.name);
  const variables = JSON.stringify(generateOperationVariables(schema, parentType.name, field.name), null, 2);
  const returnType = getNamedType(field.type);
  const returnFields = isObjectType(returnType) || isInterfaceType(returnType)
    ? Object.values(returnType.getFields()).slice(0, 12)
    : [];
  const kind = getOperationKind(schema, parentType);
  const title = humanizeGraphQLName(field.name);
  const providers = getOperationProviders(field);

  const copyText = async (value: string, target: 'operation' | 'variables') => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="page operation-detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Reference</Link><ChevronRight size={14} />
        <Link to={typePath(parentType.name)}>{kind === 'query' ? 'Queries' : kind === 'mutation' ? 'Mutations' : 'Subscriptions'}</Link>
        <ChevronRight size={14} /><strong>{title}</strong>
      </nav>

      <header className="operation-detail__header">
        <div className="operation-detail__icon"><Box size={23} /></div>
        <div className="operation-detail__heading">
          <div className="operation-detail__badges">
            <TypeBadge kind={kind} />
            {providers.map((provider) => <Link className="operation-provider-badge" to={providerPath(provider.id)} key={provider.id}><Layers3 size={11} />{provider.label}</Link>)}
          </div>
          <h1>{title}</h1>
          <code>{formatFieldSignature(field)}</code>
          {field.description
            ? <Markdown>{field.description}</Markdown>
            : <p>{describeUndocumentedField(schema, parentType.name, field)}</p>}
        </div>
        <Link className="button button--primary" to={`/explorer?document=${encodeURIComponent(operation)}&variables=${encodeURIComponent(variables)}`}>
          <Play size={14} fill="currentColor" /> Try operation
        </Link>
      </header>

      <div className="operation-detail__layout">
        <div className="operation-detail__main">
          <section className="operation-detail__section">
            <div className="operation-detail__section-heading">
              <div><span className="eyebrow">Request</span><h2>Arguments</h2></div>
              <span>{field.args.length} {field.args.length === 1 ? 'argument' : 'arguments'}</span>
            </div>
            {field.args.length ? (
              <div className="operation-detail__arguments">
                {field.args.map((argument) => (
                  <article key={argument.name}>
                    <div><code>{argument.name}</code><Link to={typePath(getNamedType(argument.type).name)}>{String(argument.type)}</Link></div>
                    <p>{argument.description || describeUndocumentedArgument(argument.name)}</p>
                    {argument.defaultValue !== undefined && <span>Default: <code>{JSON.stringify(argument.defaultValue)}</code></span>}
                  </article>
                ))}
              </div>
            ) : <p className="operation-detail__empty">This operation does not require arguments.</p>}
          </section>

          <section className="operation-detail__section">
            <div className="operation-detail__section-heading">
              <div><span className="eyebrow">Response</span><h2>Return type</h2></div>
              <Link to={typePath(returnType.name)}>Open type <ArrowRight size={14} /></Link>
            </div>
            <div className="operation-detail__return-summary">
              <div><TypeBadge kind="type" /><div><strong>{returnType.name}</strong><code>{String(field.type)}</code></div></div>
              <p>{returnType.description || `${returnType.name} is the response shape returned by this operation.`}</p>
            </div>
            {returnFields.length > 0 && (
              <div className="operation-detail__return-fields">
                {returnFields.map((returnField) => (
                  <Link to={typePath(returnType.name, returnField.name)} key={returnField.name}>
                    <span><code>{returnField.name}</code><small>{returnField.description || humanizeGraphQLName(returnField.name)}</small></span>
                    <code>{String(returnField.type)}</code>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="operation-detail__section">
            <div className="operation-detail__section-heading">
              <div><span className="eyebrow">Ready to run</span><h2>Generated operation</h2></div>
            </div>
            <div className="operation-detail__code-block">
              <div><span>Operation</span><button type="button" onClick={() => void copyText(operation, 'operation')}>
                {copied === 'operation' ? <Check size={14} /> : <Copy size={14} />}{copied === 'operation' ? 'Copied' : 'Copy'}
              </button></div>
              <pre className="operation-detail__code"><code>{operation}</code></pre>
            </div>
            <div className="operation-detail__code-block operation-detail__code-block--variables">
              <div><span>Variables</span><button type="button" onClick={() => void copyText(variables, 'variables')}>
                {copied === 'variables' ? <Check size={14} /> : <Copy size={14} />}{copied === 'variables' ? 'Copied' : 'Copy'}
              </button></div>
              <pre className="operation-detail__code operation-detail__code--variables"><code>{variables}</code></pre>
            </div>
          </section>
        </div>

        <aside className="operation-detail__aside">
          <span className="eyebrow">At a glance</span>
          <dl>
            <div><dt>Operation</dt><dd>{kind}</dd></div>
            {providers.length > 0 && <div><dt>Provider</dt><dd className="operation-detail__provider-value">{providers.map((provider, index) => <span key={provider.id}>{index > 0 && ', '}<Link to={providerPath(provider.id)}>{provider.label}</Link></span>)}</dd></div>}
            <div><dt>GraphQL field</dt><dd><code>{field.name}</code></dd></div>
            <div><dt>Arguments</dt><dd>{field.args.length}</dd></div>
            <div><dt>Returns</dt><dd><Link to={typePath(returnType.name)}>{returnType.name}</Link></dd></div>
          </dl>
        </aside>
      </div>

      <section className="similar-operations">
        <div className="section-heading">
          <div><div className="eyebrow">Keep exploring</div><h2>Similar {kind === 'query' ? 'queries' : `${kind}s`}</h2></div>
          <span>Related by operation name, arguments, and return type.</span>
        </div>
        {similarOperations.length ? (
          <div className="similar-operations__grid">
            {similarOperations.map(({ field: similar }) => (
              <Link to={typePath(parentType.name, similar.name)} key={similar.name}>
                <div><TypeBadge kind={kind} /><ArrowRight size={15} /></div>
                <h3>{humanizeGraphQLName(similar.name)}</h3>
                <code>{similar.name}</code>
                <p>{similar.description || describeUndocumentedField(schema, parentType.name, similar)}</p>
                <span>Returns <strong>{getNamedType(similar.type).name}</strong></span>
              </Link>
            ))}
          </div>
        ) : <p className="operation-detail__empty">No closely related operations were found.</p>}
      </section>
    </div>
  );
}

function getOperationKind(schema: GraphQLSchema, parentType: GraphQLObjectType): 'query' | 'mutation' | 'subscription' {
  if (schema.getMutationType()?.name === parentType.name) return 'mutation';
  if (schema.getSubscriptionType()?.name === parentType.name) return 'subscription';
  return 'query';
}
