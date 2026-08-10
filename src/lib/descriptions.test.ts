import { describe, expect, it } from 'vitest';
import { schemaFromSDL } from './loadSchema';
import { describeUndocumentedField, humanizeGraphQLName } from './descriptions';

describe('generated schema descriptions', () => {
  it('humanizes camel case and preserves common acronyms', () => {
    expect(humanizeGraphQLName('abstractApplicationEntities')).toBe('Abstract Application Entities');
    expect(humanizeGraphQLName('awsIdentityById')).toBe('AWS Identity By ID');
    expect(humanizeGraphQLName('AccessLevelGcp')).toBe('Access Level GCP');
    expect(humanizeGraphQLName('i18n_dataSource')).toBe('Translated Data Source');
  });

  it('explains collection and identifier queries', () => {
    const schema = schemaFromSDL(`
      input EntityFilter { name: String }
      type Entity { id: ID! }
      type Query {
        abstractApplicationEntities(filter: EntityFilter, paging: Int): [Entity!]!
        abstractApplicationEntity(id: ID!): Entity
      }
    `);
    const fields = schema.getQueryType()!.getFields();
    expect(describeUndocumentedField(schema, 'Query', fields.abstractApplicationEntities)).toContain(
      'Returns a collection of Abstract Application Entities',
    );
    expect(describeUndocumentedField(schema, 'Query', fields.abstractApplicationEntity)).toBe(
      'Returns Abstract Application Entity for the supplied ID.',
    );
  });
});
