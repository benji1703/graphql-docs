/** @type {import('./graphql-docs.config.d.mts').GraphQLDocsConfig} */
const config = {
  schema: {
    type: 'url',
    url: 'https://api.cloudplatform.app.silverfort.com/graphql',
    headersEnv: 'GRAPHQL_HEADERS',
  },
  output: {
    schema: 'public/schema.graphql',
  },
  site: {
    title: 'Silverfort API',
    explorerEndpoint: 'https://api.cloudplatform.app.silverfort.com/graphql',
    allowConfiguration: true,
  },
};

export default config;
