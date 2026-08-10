import { ApolloSandbox } from '@apollo/sandbox/react';

interface EmbeddedExplorerProps {
  endpoint: string;
  headers?: Record<string, string>;
  document?: string;
}

export function EmbeddedExplorer({ endpoint, headers, document }: EmbeddedExplorerProps) {
  return (
    <div className="sandbox-frame">
      <ApolloSandbox
        key={`${endpoint}:${document ?? ''}`}
        className="sandbox"
        initialEndpoint={endpoint}
        endpointIsEditable
        runTelemetry={false}
        initialState={{
          pollForSchemaUpdates: true,
          sharedHeaders: headers,
          document,
        }}
      />
    </div>
  );
}
