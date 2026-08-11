import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { getExplorerCatalog } from './explorerCatalog';

describe('Explorer introspection catalog', () => {
  it('finds connection filters and entity fields', () => {
    const schema = buildSchema(`
      input EntityFilter { name: String, active: Boolean }
      type Entity { id: ID!, name: String!, active: Boolean! }
      type EntityEdge { node: Entity! }
      type EntityConnection { totalCount: Int!, edges: [EntityEdge!]! }
      type Query { entities(filter: EntityFilter): EntityConnection! }
    `);

    const catalog = getExplorerCatalog(schema, 'Query', 'entities');
    expect(catalog.filterType).toBe('EntityFilter');
    expect(catalog.filters.map((field) => field.name)).toEqual(['name', 'active']);
    expect(catalog.responseType).toBe('Entity');
    expect(catalog.fields.map((field) => field.name)).toEqual(['id', 'name', 'active']);
  });
});
