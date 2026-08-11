import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { getOperationProviderBuckets, getOperationProviderIds, operationMatchesProvider } from './operationProviders';

describe('operation provider buckets', () => {
  const schema = buildSchema(`
    type AwsEntity { id: ID! }
    type CloudflareEntity { id: ID! }
    type Query {
      accessKeyAwsIamEntities: [AwsEntity!]!
      accessApplicationCloudflareEntities: [CloudflareEntity!]!
      apiTokenOktaIdpEntities: [String!]!
      abstractApplicationEntities: [String!]!
    }
  `);
  const fields = Object.values(schema.getQueryType()!.getFields());

  it('detects providers from operation and return type names', () => {
    expect(getOperationProviderIds(fields[0])).toEqual(['aws']);
    expect(operationMatchesProvider(fields[1], 'cloudflare')).toBe(true);
    expect(operationMatchesProvider(fields[3], 'other')).toBe(true);
  });

  it('returns only detected buckets with accurate counts', () => {
    expect(getOperationProviderBuckets(fields)).toEqual([
      { id: 'all', label: 'All providers', count: 4 },
      { id: 'aws', label: 'AWS', count: 1 },
      { id: 'cloudflare', label: 'Cloudflare', count: 1 },
      { id: 'okta', label: 'Okta', count: 1 },
      { id: 'other', label: 'Core / Other', count: 1 },
    ]);
  });
});
