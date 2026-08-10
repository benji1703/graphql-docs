# GraphQL Docs

A fast, searchable GraphQL API reference with an Apollo Sandbox workflow. It turns an introspectable endpoint or SDL file into a Swagger-like documentation site with type-safe navigation, field-level deep links, readable generated explanations, Markdown descriptions, and fuzzy search.

**[Open the live demo](https://benji1703.github.io/graphql-docs/)**

The checked-in demo is generated from `https://api.cloudplatform.app.silverfort.com/graphql`. Its schema contains more than 23,000 types and 145,000 fields, so the UI deliberately paginates large definitions and bounds sidebar rendering.

## Highlights

- GraphQL queries, mutations, subscriptions, objects, inputs, enums, interfaces, unions, and scalars
- `⌘ K` / `Ctrl K` fuzzy finder across types, operations, and fields (plus arguments and enum values on smaller schemas)
- Field signatures, descriptions, arguments, defaults, deprecations, return-type links, and permalinks
- Apollo Sandbox launch flow with generated operations, endpoint copying, and optional embedding
- Runtime schema switching through endpoint introspection, public SDL URLs, pasted SDL, or local files
- Markdown and GFM in schema descriptions
- Static deployment with no application server
- Responsive UI and bounded rendering for very large schemas

## Run locally

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

The app loads `public/schema.graphql` on startup. If that snapshot cannot be loaded or parsed, it falls back to a small bundled demo schema. Project defaults live in `graphql-docs.config.mjs`, following a config → schema acquisition → normalized snapshot → static site pipeline.

## Generate docs from another endpoint

Pull a public schema:

```bash
npm run schema:pull -- https://api.example.com/graphql
```

For authenticated introspection, pass headers through the process environment. Do not commit credentials:

```bash
GRAPHQL_HEADERS='{"authorization":"Bearer …"}' \
  npm run schema:pull -- https://api.example.com/graphql
```

The command writes a deterministic, alphabetically sorted snapshot to `public/schema.graphql`. To choose another output path, pass it as the second argument:

```bash
npm run schema:pull -- https://api.example.com/graphql public/acme.graphql
```

The project config also accepts local SDL files or raw SDL:

```js
export default {
  schema: { type: 'sdl', paths: ['./schema/base.graphql', './schema/admin.graphql'] },
  output: { schema: 'public/schema.graphql' },
  site: {
    title: 'Acme API',
    explorerEndpoint: 'https://api.example.com/graphql',
    explorerMode: 'embedded',
    allowConfiguration: true,
  },
}
```

## Configuration

Copy `.env.example` to `.env.local` when you need deployment-specific settings:

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_NAME` | Product name shown in the header |
| `VITE_GRAPHQL_ENDPOINT` | Apollo Sandbox endpoint and optional browser introspection target |
| `VITE_EXPLORER_MODE` | `external` for an Apollo Studio launcher or `embedded` for an in-page Sandbox |
| `VITE_SCHEMA_URL` | Public SDL URL loaded instead of `public/schema.graphql` |
| `VITE_INTROSPECTION_HEADERS` | Public-only headers used for browser introspection |
| `VITE_ALLOW_CONFIGURATION` | Set to `false` to lock schema switching in a published portal |

Browser introspection and an embedded Sandbox require the GraphQL server to allow the documentation site's origin through CORS. Build-time generation with `schema:pull` avoids the first requirement. Use `explorerMode: 'external'` when an API permits Apollo Studio but does not allow the static documentation origin, as the Silverfort demo does.

## Commands

```bash
npm run dev          # development server
npm run schema:pull  # refresh public/schema.graphql
npm run typecheck    # TypeScript validation
npm test             # test suite
npm run build        # production bundle in dist/
npm run preview      # serve the production bundle locally
```

## Deployment

The included GitHub Actions workflow tests, builds, and deploys the site to GitHub Pages on every push to `main`. Hash-based routes and relative assets make the same build work on a project Pages URL without custom rewrites.

For another static host, publish `dist/` after running `npm run build`.

## Architecture

- React + TypeScript + Vite
- GraphQL.js for SDL parsing and introspection
- A bounded, schema-specific fuzzy scorer for low-latency lookup on huge graphs
- Apollo Sandbox launcher or optional embedded explorer for live operations
- React Router hash routing for portable static hosting
- Vitest for schema-model and loader tests

## License

MIT
