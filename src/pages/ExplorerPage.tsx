import { ApolloSandbox } from '@apollo/sandbox/react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useSchema } from '../context/SchemaContext';

export function ExplorerPage() {
  const { explorerEndpoint, source } = useSchema();
  const [searchParams] = useSearchParams();
  const document = searchParams.get('document') ?? undefined;

  return (
    <div className="explorer-page">
      <div className="explorer-toolbar">
        <div>
          <span className="status-dot" />
          <strong>Apollo Sandbox</strong>
          <span className="explorer-toolbar__endpoint">{explorerEndpoint}</span>
        </div>
        <div className="explorer-toolbar__note"><ShieldCheck size={15} /> Requests go directly to your GraphQL API <ExternalLink size={13} /></div>
      </div>
      <div className="sandbox-frame">
        <ApolloSandbox
          key={`${explorerEndpoint}:${document ?? ''}`}
          className="sandbox"
          initialEndpoint={explorerEndpoint}
          endpointIsEditable
          runTelemetry={false}
          initialState={{
            pollForSchemaUpdates: true,
            sharedHeaders: source.headers,
            document,
          }}
        />
      </div>
    </div>
  );
}
