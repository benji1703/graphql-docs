import { describe, expect, it } from 'vitest';
import { schemaFromSDL } from './loadSchema';
import { buildSearchIndex, formatFieldSignature, getSchemaStats, getTypeGroups, typePath } from './schema';
import { SAMPLE_SCHEMA } from '../schema/sample';

describe('schema documentation model', () => {
  const schema = schemaFromSDL(SAMPLE_SCHEMA);

  it('groups schema types and excludes built-in scalars', () => {
    const groups = getTypeGroups(schema);
    expect(groups.find((group) => group.category === 'object')?.types.map((type) => type.name)).toContain('Country');
    expect(groups.flatMap((group) => group.types.map((type) => type.name))).not.toContain('String');
  });

  it('counts operations, fields, and types', () => {
    expect(getSchemaStats(schema)).toEqual({
      operationCount: 6,
      typeCount: 5,
      fieldCount: 31,
    });
  });

  it('creates navigable search records for fields and arguments', () => {
    const index = buildSearchIndex(schema);
    expect(index).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'field:Query.country', path: '/docs/Query/country' }),
        expect.objectContaining({ id: 'argument:Query.country.code', title: 'code' }),
        expect.objectContaining({ id: 'field:Country.languages', path: '/docs/Country/languages' }),
      ]),
    );
  });

  it('formats GraphQL signatures and URL-safe paths', () => {
    const field = schema.getQueryType()!.getFields().country;
    expect(formatFieldSignature(field)).toBe('country(code: ID!): Country');
    expect(typePath('User Profile', 'display name')).toBe('/docs/User%20Profile/display%20name');
  });
});
