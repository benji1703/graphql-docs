/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_NAME?: string;
  readonly VITE_GRAPHQL_ENDPOINT?: string;
  readonly VITE_SCHEMA_URL?: string;
  readonly VITE_INTROSPECTION_HEADERS?: string;
  readonly VITE_ALLOW_CONFIGURATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
