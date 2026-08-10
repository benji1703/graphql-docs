import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, FileCode2, Globe2, Link2, LoaderCircle, X } from 'lucide-react';
import { useSchema } from '../context/SchemaContext';
import { parseHeaders } from '../lib/loadSchema';

type Mode = 'endpoint' | 'url' | 'sdl';

interface ConfigureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigureModal({ isOpen, onClose }: ConfigureModalProps) {
  const { source, explorerEndpoint, isLoading, error, loadEndpoint, loadURL, loadSDL, useDemo, clearError } =
    useSchema();
  const [mode, setMode] = useState<Mode>('endpoint');
  const [endpoint, setEndpoint] = useState(explorerEndpoint);
  const [headers, setHeaders] = useState('{}');
  const [schemaURL, setSchemaURL] = useState('');
  const [sdl, setSDL] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEndpoint(explorerEndpoint);
    setHeaders(JSON.stringify(source.headers ?? {}, null, 2));
    setLocalError(null);
    clearError();
  }, [isOpen, explorerEndpoint, source.headers, clearError]);

  if (!isOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    try {
      if (mode === 'endpoint') await loadEndpoint(endpoint, parseHeaders(headers));
      if (mode === 'url') await loadURL(schemaURL);
      if (mode === 'sdl') loadSDL(sdl);
      onClose();
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : 'Could not load the schema.');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section className="config-modal" role="dialog" aria-modal="true" aria-labelledby="config-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="config-modal__header">
          <div>
            <div className="eyebrow">Schema source</div>
            <h2 id="config-title">Connect your graph</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close configuration"><X size={18} /></button>
        </div>

        <div className="config-tabs" role="tablist">
          <Tab active={mode === 'endpoint'} icon={<Globe2 size={16} />} onClick={() => setMode('endpoint')}>Endpoint</Tab>
          <Tab active={mode === 'url'} icon={<Link2 size={16} />} onClick={() => setMode('url')}>SDL URL</Tab>
          <Tab active={mode === 'sdl'} icon={<FileCode2 size={16} />} onClick={() => setMode('sdl')}>SDL / file</Tab>
        </div>

        <form onSubmit={submit} className="config-form">
          {mode === 'endpoint' && (
            <>
              <label>
                <span>GraphQL endpoint</span>
                <input type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} required placeholder="https://api.example.com/graphql" />
              </label>
              <label>
                <span>Introspection headers <small>JSON</small></span>
                <textarea className="config-form__headers" value={headers} onChange={(event) => setHeaders(event.target.value)} spellCheck={false} />
              </label>
              <p className="form-hint">Requests run in your browser. The endpoint must allow this site’s origin through CORS. Never place private long-lived credentials in a public deployment.</p>
            </>
          )}

          {mode === 'url' && (
            <label>
              <span>Public schema URL</span>
              <input type="url" value={schemaURL} onChange={(event) => setSchemaURL(event.target.value)} required placeholder="https://example.com/schema.graphql" />
              <small>Loads a GraphQL SDL file. The URL must allow cross-origin GET requests.</small>
            </label>
          )}

          {mode === 'sdl' && (
            <label>
              <span>GraphQL SDL</span>
              <textarea className="config-form__sdl" value={sdl} onChange={(event) => setSDL(event.target.value)} required spellCheck={false} placeholder={'type Query {\n  viewer: User\n}'} />
              <input
                ref={fileRef}
                hidden
                type="file"
                accept=".graphql,.graphqls,.gql,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then(setSDL);
                }}
              />
              <button type="button" className="text-button" onClick={() => fileRef.current?.click()}>Choose a .graphql file</button>
            </label>
          )}

          {(localError || error) && <div className="form-error" role="alert">{localError || error}</div>}

          <div className="config-modal__footer">
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                useDemo();
                onClose();
              }}
            >
              Use demo
            </button>
            <button className="button button--primary" type="submit" disabled={isLoading}>
              {isLoading ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
              {isLoading ? 'Loading schema…' : 'Use this schema'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Tab({ active, icon, onClick, children }: { active: boolean; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={onClick}>{icon}{children}</button>;
}
