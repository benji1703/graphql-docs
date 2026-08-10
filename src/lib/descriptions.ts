import type { GraphQLField, GraphQLSchema } from 'graphql';

const ACRONYMS = new Set([
  'ad', 'ai', 'api', 'aws', 'csv', 'gcp', 'graphql', 'http', 'https', 'id', 'idp', 'ip', 'json', 'mfa',
  'nhi', 'oauth', 'okta', 'otp', 'pam', 'saml', 'sso', 'tls', 'url', 'uuid',
]);

export function humanizeGraphQLName(value: string): string {
  return value
    .replace(/^i18n[_-]?/i, 'translated_')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      return lower ? lower[0].toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

export function describeUndocumentedArgument(name: string) {
  return `Value for the ${humanizeGraphQLName(name).toLowerCase()} argument.`;
}

export function describeUndocumentedField(
  schema: GraphQLSchema,
  parentName: string,
  field: GraphQLField<unknown, unknown>,
): string {
  const label = humanizeGraphQLName(field.name);
  const argumentNames = new Set(field.args.map((argument) => argument.name.toLowerCase()));

  if (schema.getQueryType()?.name === parentName) {
    if (argumentNames.has('filter') || argumentNames.has('paging') || argumentNames.has('sorting')) {
      const actions = [
        argumentNames.has('filter') && 'filter',
        argumentNames.has('sorting') && 'sort',
        argumentNames.has('paging') && 'paginate',
      ].filter((action): action is string => Boolean(action));
      const actionText = actions.length > 1
        ? `${actions.slice(0, -1).join(', ')} and ${actions.at(-1)}`
        : actions[0];
      return `Returns a collection of ${label}. Use the arguments below to ${actionText} the results.`;
    }
    if (argumentNames.has('id')) return `Returns ${label} for the supplied ID.`;
    if (argumentNames.has('code')) return `Returns ${label} for the supplied code.`;
    return `Returns ${label} from the Silverfort Cloud Platform.`;
  }

  if (schema.getMutationType()?.name === parentName) {
    const lowerName = field.name.toLowerCase();
    if (lowerName.endsWith('delete')) return `Deletes the selected ${humanizeGraphQLName(field.name.slice(0, -6))}.`;
    if (lowerName.endsWith('save')) return `Creates or updates ${humanizeGraphQLName(field.name.slice(0, -4))}.`;
    if (lowerName.endsWith('clone')) return `Creates a copy of ${humanizeGraphQLName(field.name.slice(0, -5))}.`;
    if (lowerName.endsWith('update')) return `Updates ${humanizeGraphQLName(field.name.slice(0, -6))}.`;
    if (lowerName.endsWith('create')) return `Creates ${humanizeGraphQLName(field.name.slice(0, -6))}.`;
    return `Executes the ${label} mutation.`;
  }

  if (schema.getSubscriptionType()?.name === parentName) return `Streams ${label} updates.`;
  return `The ${label.toLowerCase()} value exposed by ${humanizeGraphQLName(parentName)}.`;
}
