import projectConfig from '../graphql-docs.config.mjs';

export const siteConfig = {
  title: import.meta.env.VITE_SITE_NAME ?? projectConfig.site.title,
  explorerEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT ?? projectConfig.site.explorerEndpoint,
  explorerProxyEndpoint: import.meta.env.VITE_GRAPHQL_PROXY_ENDPOINT ?? projectConfig.site.explorerProxyEndpoint,
  allowConfiguration:
    import.meta.env.VITE_ALLOW_CONFIGURATION === undefined
      ? projectConfig.site.allowConfiguration
      : import.meta.env.VITE_ALLOW_CONFIGURATION !== 'false',
};
