import projectConfig from '../graphql-docs.config.mjs';

export const siteConfig = {
  title: import.meta.env.VITE_SITE_NAME ?? projectConfig.site.title,
  explorerEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT ?? projectConfig.site.explorerEndpoint,
  allowConfiguration:
    import.meta.env.VITE_ALLOW_CONFIGURATION === undefined
      ? projectConfig.site.allowConfiguration
      : import.meta.env.VITE_ALLOW_CONFIGURATION !== 'false',
};
