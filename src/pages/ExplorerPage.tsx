import { lazy, Suspense, useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { siteConfig } from '../config';
import { useSchema } from '../context/SchemaContext';

const EmbeddedExplorer = lazy(() =>
  import('../components/EmbeddedExplorer').then((module) => ({ default: module.EmbeddedExplorer })),
);

export function ExplorerPage() {
  const { explorerEndpoint, source } = useSchema();
  const [searchParams] = useSearchParams();
  const operationDocument = searchParams.get('document') ?? undefined;
  const [copied, setCopied] = useState<'endpoint' | 'operation' | null>(null);

  const copyText = async (value: string, target: 'endpoint' | 'operation') => {
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

  if (siteConfig.explorerMode === 'embedded') {
    return (
      <div className="explorer-page">
        <div className="explorer-toolbar">
          <div>
            <span className="status-dot" />
            <strong>Apollo Sandbox</strong>
            <span className="explorer-toolbar__endpoint">{explorerEndpoint}</span>
          </div>
          <div className="explorer-toolbar__note"><ShieldCheck size={15} /> Requests go directly to your GraphQL API</div>
        </div>
        <Suspense fallback={<div className="route-loader">Loading Apollo Sandbox…</div>}>
          <EmbeddedExplorer endpoint={explorerEndpoint} headers={source.headers} document={operationDocument} />
        </Suspense>
      </div>
    );
  }

  const studioURL = `https://studio.apollographql.com/sandbox/explorer?endpoint=${encodeURIComponent(explorerEndpoint)}`;

  return (
    <div className="explorer-page">
      <div className="explorer-toolbar">
        <div>
          <span className="status-dot" />
          <strong>Apollo Studio</strong>
          <span className="explorer-toolbar__endpoint">{explorerEndpoint}</span>
        </div>
        <div className="explorer-toolbar__note"><ShieldCheck size={15} /> Compatible with Silverfort's API security policy</div>
      </div>
      <main className="external-explorer">
        <section className="external-explorer__hero">
          <span className="eyebrow">Live GraphQL explorer</span>
          <h1>Explore the Silverfort API in Apollo Sandbox</h1>
          <p>
            Silverfort permits browser requests from Apollo Studio, while its CORS policy blocks requests sent
            from GitHub Pages. Opening the explorer in Studio keeps schema introspection and live execution working.
          </p>
          <a className="button button--primary" href={studioURL} target="_blank" rel="noreferrer">
            Open Apollo Sandbox <ExternalLink size={15} />
          </a>
        </section>

        <section className="external-explorer__panel" aria-labelledby="endpoint-heading">
          <div>
            <span className="external-explorer__step">1</span>
            <div>
              <h2 id="endpoint-heading">Connected endpoint</h2>
              <p>Apollo Sandbox opens with this endpoint ready for introspection.</p>
            </div>
          </div>
          <div className="external-explorer__code-row">
            <code>{explorerEndpoint}</code>
            <button className="button button--secondary" type="button" onClick={() => void copyText(explorerEndpoint, 'endpoint')}>
              {copied === 'endpoint' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'endpoint' ? 'Copied' : 'Copy endpoint'}
            </button>
          </div>
        </section>

        {operationDocument && (
          <section className="external-explorer__panel" aria-labelledby="operation-heading">
            <div>
              <span className="external-explorer__step">2</span>
              <div>
                <h2 id="operation-heading">Generated operation</h2>
                <p>Copy this ready-to-run operation, then paste it into Apollo Sandbox.</p>
              </div>
            </div>
            <pre className="external-explorer__operation"><code>{operationDocument}</code></pre>
            <div className="external-explorer__actions">
              <button className="button button--secondary" type="button" onClick={() => void copyText(operationDocument, 'operation')}>
                {copied === 'operation' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'operation' ? 'Operation copied' : 'Copy operation'}
              </button>
              <a className="button button--primary" href={studioURL} target="_blank" rel="noreferrer">
                Open Apollo Sandbox <ExternalLink size={14} />
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
