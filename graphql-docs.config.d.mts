export type SchemaSource =
  | { type: 'url'; url: string; headersEnv?: string }
  | { type: 'sdl'; paths: string[] }
  | { type: 'raw'; content: string };

export interface GraphQLDocsConfig {
  schema: SchemaSource;
  output: { schema: string };
  site: {
    title: string;
    explorerEndpoint: string;
    explorerProxyEndpoint?: string;
    allowConfiguration: boolean;
  };
}

declare const config: GraphQLDocsConfig;
export default config;
