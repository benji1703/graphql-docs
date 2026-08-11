import { getNamedType, type GraphQLField, type GraphQLOutputType } from 'graphql';

export type OperationProviderId = 'all' | 'other' | (typeof PROVIDER_CATEGORIES)[number]['id'];

export interface OperationProviderBucket {
  id: OperationProviderId;
  label: string;
  count: number;
}

export const PROVIDER_CATEGORIES = [
  { id: 'aws', label: 'AWS', patterns: ['aws'] },
  { id: 'azure', label: 'Azure', patterns: ['azure'] },
  { id: 'gcp', label: 'GCP', patterns: ['gcp'] },
  { id: 'cloudflare', label: 'Cloudflare', patterns: ['cloudflare'] },
  { id: 'okta', label: 'Okta', patterns: ['okta'] },
  { id: 'github', label: 'GitHub', patterns: ['github'] },
  { id: 'gitlab', label: 'GitLab', patterns: ['gitlab'] },
  { id: 'google-workspace', label: 'Google Workspace', patterns: ['google workspace', 'gsuite'] },
  { id: 'microsoft-365', label: 'Microsoft 365', patterns: ['microsoft', 'm365', 'office 365'] },
  { id: 'salesforce', label: 'Salesforce', patterns: ['salesforce'] },
  { id: 'mongo-atlas', label: 'MongoDB Atlas', patterns: ['mongo atlas', 'mongodb atlas'] },
  { id: 'snowflake', label: 'Snowflake', patterns: ['snowflake'] },
  { id: 'atlassian', label: 'Atlassian', patterns: ['atlassian'] },
  { id: 'docusign', label: 'DocuSign', patterns: ['docusign'] },
  { id: 'jamf', label: 'Jamf', patterns: ['jamf'] },
  { id: 'circleci', label: 'CircleCI', patterns: ['circle ci', 'circleci'] },
  { id: 'openai', label: 'OpenAI', patterns: ['open ai', 'openai'] },
  { id: 'anthropic', label: 'Anthropic', patterns: ['anthropic'] },
  { id: 'slack', label: 'Slack', patterns: ['slack'] },
  { id: 'zendesk', label: 'Zendesk', patterns: ['zendesk'] },
  { id: 'hashicorp', label: 'HashiCorp', patterns: ['hashi corp', 'hashicorp'] },
  { id: 'auth0', label: 'Auth0', patterns: ['auth0'] },
  { id: 'zoom', label: 'Zoom', patterns: ['zoom'] },
  { id: 'crowdstrike', label: 'CrowdStrike', patterns: ['crowdstrike'] },
  { id: 'workday', label: 'Workday', patterns: ['workday'] },
  { id: 'netsuite', label: 'NetSuite', patterns: ['netsuite'] },
] as const;

type OperationField = Pick<GraphQLField<unknown, unknown>, 'name'> & { type: GraphQLOutputType };

export function getOperationProviderIds(field: OperationField) {
  const searchable = normalizeProviderText(`${field.name} ${getNamedType(field.type).name}`);
  return PROVIDER_CATEGORIES
    .filter((category) => category.patterns.some((pattern) => searchable.includes(` ${pattern} `)))
    .map((category) => category.id);
}

export function operationMatchesProvider(field: OperationField, provider: OperationProviderId) {
  if (provider === 'all') return true;
  const providers = getOperationProviderIds(field);
  return provider === 'other' ? providers.length === 0 : providers.includes(provider);
}

export function getOperationProviderBuckets(fields: readonly OperationField[]): OperationProviderBucket[] {
  const counts = new Map<string, number>();
  let otherCount = 0;

  for (const field of fields) {
    const providers = getOperationProviderIds(field);
    if (!providers.length) otherCount++;
    for (const provider of providers) counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }

  const detected = PROVIDER_CATEGORIES
    .map((category) => ({ id: category.id, label: category.label, count: counts.get(category.id) ?? 0 }))
    .filter((bucket) => bucket.count > 0);

  return [
    { id: 'all', label: 'All providers', count: fields.length },
    ...detected,
    ...(otherCount ? [{ id: 'other' as const, label: 'Core / Other', count: otherCount }] : []),
  ];
}

function normalizeProviderText(value: string) {
  return ` ${value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()} `;
}
