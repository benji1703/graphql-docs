import { describe, expect, it } from 'vitest';
import { schemaFromSDL } from './loadSchema';
import { generateOperation, generateOperationVariables, getOperationBuilderDefaults } from './operation';
import { SAMPLE_SCHEMA } from '../schema/sample';

describe('generateOperation', () => {
  const schema = schemaFromSDL(SAMPLE_SCHEMA);

  it('generates variables and useful nested selections', () => {
    const document = generateOperation(schema, 'Query', 'country');
    expect(document).toContain('query Country($code: ID!)');
    expect(document).toContain('country(code: $code)');
    expect(document).toContain('code');
    expect(document).toContain('continent {');
  });

  it('rejects non-root fields', () => {
    expect(() => generateOperation(schema, 'Country', 'name')).toThrow('not a root operation');
  });

  it('generates starter variables from argument input types', () => {
    expect(generateOperationVariables(schema, 'Query', 'country')).toEqual({ code: 'replace-with-id' });
  });

  it('omits defaulted variables until the user selects them', () => {
    const collectionSchema = schemaFromSDL(`
      input NameComparison { eq: String, in: [String!] }
      input EntityFilter { name: NameComparison, freeText: String }
      input Paging { first: Int }
      type EntityMetadata { active: Boolean!, label: String }
      type Entity { id: ID!, name: String!, description: String, metadata: EntityMetadata }
      type EntityEdge { node: Entity! }
      type EntityConnection { totalCount: Int!, edges: [EntityEdge!]! }
      type Query { entities(filter: EntityFilter! = {}, paging: Paging! = { first: 10 }): EntityConnection! }
    `);

    expect(generateOperationVariables(collectionSchema, 'Query', 'entities')).toEqual({});
    expect(generateOperation(collectionSchema, 'Query', 'entities')).not.toContain('$filter');

    const defaults = getOperationBuilderDefaults(collectionSchema, 'Query', 'entities');
    expect(defaults.argumentNames).toEqual([]);
    expect(defaults.fieldNames).toEqual(['id', 'name', 'description']);

    const options = { argumentNames: ['filter'], filterFieldNames: ['name'], fieldNames: ['id', 'description'] };
    expect(generateOperation(collectionSchema, 'Query', 'entities', options)).toContain('entities(filter: $filter)');
    expect(generateOperation(collectionSchema, 'Query', 'entities', options)).toContain('description');
    expect(generateOperationVariables(collectionSchema, 'Query', 'entities', options)).toEqual({
      filter: { name: { eq: 'value' } },
    });

    const objectFieldDocument = generateOperation(collectionSchema, 'Query', 'entities', {
      fieldNames: ['id', 'metadata'],
    });
    expect(objectFieldDocument).toContain('metadata {');
    expect(objectFieldDocument).toContain('active');
    expect(objectFieldDocument).toContain('label');
    expect(objectFieldDocument).not.toContain('metadata {\n          __typename');
  });
});
