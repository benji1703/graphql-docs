import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { GraphQLSchema } from 'graphql';
import { siteConfig } from '../config';
import { introspectEndpoint, parseHeaders, schemaFromSDL, schemaFromURL } from '../lib/loadSchema';
import { SAMPLE_ENDPOINT, SAMPLE_SCHEMA } from '../schema/sample';

export interface SchemaSource {
  kind: 'demo' | 'endpoint' | 'url' | 'sdl';
  label: string;
  endpoint?: string;
  headers?: Record<string, string>;
}

interface SchemaContextValue {
  schema: GraphQLSchema;
  source: SchemaSource;
  explorerEndpoint: string;
  isLoading: boolean;
  error: string | null;
  loadEndpoint: (endpoint: string, headers?: Record<string, string>) => Promise<void>;
  loadURL: (url: string, label?: string) => Promise<void>;
  loadSDL: (sdl: string, label?: string) => void;
  useDemo: () => void;
  clearError: () => void;
}

const SchemaContext = createContext<SchemaContextValue | null>(null);
const demoSchema = schemaFromSDL(SAMPLE_SCHEMA);

export function SchemaProvider({ children }: PropsWithChildren) {
  const [schema, setSchema] = useState(demoSchema);
  const [source, setSource] = useState<SchemaSource>({ kind: 'demo', label: 'Countries demo' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const loadEndpoint = useCallback(async (endpoint: string, headers: Record<string, string> = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextSchema = await introspectEndpoint(endpoint, headers);
      setSchema(nextSchema);
      setSource({ kind: 'endpoint', label: endpoint, endpoint, headers });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not introspect that endpoint.';
      setError(message);
      throw reason;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadURL = useCallback(async (url: string, label?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { schema: nextSchema } = await schemaFromURL(url);
      setSchema(nextSchema);
      setSource({ kind: 'url', label: label ?? url });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not load that schema URL.';
      setError(message);
      throw reason;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSDL = useCallback((sdl: string, label = 'Pasted SDL') => {
    setError(null);
    try {
      setSchema(schemaFromSDL(sdl));
      setSource({ kind: 'sdl', label });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not parse that schema.';
      setError(message);
      throw reason;
    }
  }, []);

  const useDemo = useCallback(() => {
    setSchema(demoSchema);
    setSource({ kind: 'demo', label: 'Countries demo' });
    setError(null);
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const schemaURL = import.meta.env.VITE_SCHEMA_URL ?? `${import.meta.env.BASE_URL}schema.graphql`;
    const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;

    if (schemaURL) {
      void loadURL(schemaURL, import.meta.env.VITE_SCHEMA_URL ? undefined : 'Silverfort Cloud Platform').catch(() => undefined);
      return;
    }

    if (endpoint) {
      let headers: Record<string, string> = {};
      try {
        headers = parseHeaders(import.meta.env.VITE_INTROSPECTION_HEADERS ?? '');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Invalid VITE_INTROSPECTION_HEADERS.');
        return;
      }
      void loadEndpoint(endpoint, headers).catch(() => undefined);
    }
  }, [loadEndpoint, loadURL]);

  const explorerEndpoint =
    source.endpoint ?? siteConfig.explorerEndpoint ?? SAMPLE_ENDPOINT;

  const value = useMemo<SchemaContextValue>(
    () => ({
      schema,
      source,
      explorerEndpoint,
      isLoading,
      error,
      loadEndpoint,
      loadURL,
      loadSDL,
      useDemo,
      clearError: () => setError(null),
    }),
    [schema, source, explorerEndpoint, isLoading, error, loadEndpoint, loadURL, loadSDL, useDemo],
  );

  return <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>;
}

export function useSchema() {
  const value = useContext(SchemaContext);
  if (!value) throw new Error('useSchema must be used within SchemaProvider.');
  return value;
}
