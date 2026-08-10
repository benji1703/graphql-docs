import { getNamedType, type GraphQLField, type GraphQLSchema } from 'graphql';

export interface SimilarOperation {
  field: GraphQLField<unknown, unknown>;
  score: number;
}

export function getSimilarOperations(
  schema: GraphQLSchema,
  parentName: string,
  fieldName: string,
  limit = 6,
): SimilarOperation[] {
  const parent = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()]
    .find((type) => type?.name === parentName);
  const source = parent?.getFields()[fieldName];
  if (!parent || !source) return [];

  const sourceTokens = tokenizeOperationName(source.name);
  const sourceReturn = getNamedType(source.type).name;
  const sourceArguments = new Set(source.args.map((argument) => getNamedType(argument.type).name));

  return Object.values(parent.getFields())
    .filter((candidate) => candidate.name !== source.name)
    .map((candidate) => {
      const candidateTokens = tokenizeOperationName(candidate.name);
      const sharedTokens = [...candidateTokens].filter((token) => sourceTokens.has(token)).length;
      const sameReturn = getNamedType(candidate.type).name === sourceReturn ? 7 : 0;
      const sharedArguments = candidate.args.filter((argument) => sourceArguments.has(getNamedType(argument.type).name)).length;
      const commonStart = commonPrefixLength(source.name.toLowerCase(), candidate.name.toLowerCase()) / 12;
      return { field: candidate, score: sharedTokens * 4 + sameReturn + sharedArguments * 2 + commonStart };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.field.name.localeCompare(right.field.name))
    .slice(0, limit);
}

function tokenizeOperationName(value: string) {
  return new Set(value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singularize));
}

function singularize(word: string) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

function commonPrefixLength(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let index = 0;
  while (index < length && left[index] === right[index]) index++;
  return index;
}
