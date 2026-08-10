import { describe, expect, it } from 'vitest';
import { schemaFromSDL } from './loadSchema';
import { getSimilarOperations } from './similarOperations';

describe('similar operations', () => {
  it('prioritizes operations with related names, arguments, and return types', () => {
    const schema = schemaFromSDL(`
      type Entity { id: ID! }
      type EntityConnection { nodes: [Entity!]! }
      type Query {
        abstractApplicationEntities(filter: String, paging: Int): EntityConnection!
        abstractApplicationEntity(id: ID!): Entity
        abstractIdentityEntities(filter: String, paging: Int): EntityConnection!
        userPreferences: String
      }
    `);

    const results = getSimilarOperations(schema, 'Query', 'abstractApplicationEntities');
    expect(results.map(({ field }) => field.name).slice(0, 2)).toEqual([
      'abstractIdentityEntities',
      'abstractApplicationEntity',
    ]);
    expect(results.map(({ field }) => field.name)).not.toContain('userPreferences');
  });
});
