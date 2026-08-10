import { describe, expect, it } from 'vitest';
import { schemaFromSDL } from './loadSchema';
import { generateOperation } from './operation';
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
});
