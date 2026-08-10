import {
  getNamedType,
  isEnumType,
  isInterfaceType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql';

export function generateOperation(schema: GraphQLSchema, parentName: string, fieldName: string): string {
  const roots = [
    { kind: 'query', type: schema.getQueryType() },
    { kind: 'mutation', type: schema.getMutationType() },
    { kind: 'subscription', type: schema.getSubscriptionType() },
  ] as const;
  const root = roots.find((entry) => entry.type?.name === parentName);
  const field = root?.type?.getFields()[fieldName];
  if (!root || !field) throw new Error(`${parentName}.${fieldName} is not a root operation.`);

  const operationName = toOperationName(field.name);
  const variableDefinitions = field.args.map((argument) => `$${argument.name}: ${String(argument.type)}`).join(', ');
  const argumentUsage = field.args.map((argument) => `${argument.name}: $${argument.name}`).join(', ');
  const selection = buildSelection(schema, field.type, 0, new Set());
  const definition = variableDefinitions ? `(${variableDefinitions})` : '';
  const invocation = argumentUsage ? `${field.name}(${argumentUsage})` : field.name;
  const body = selection ? `${invocation} {\n${indent(selection, 2)}\n  }` : invocation;

  return `${root.kind} ${operationName}${definition} {\n  ${body}\n}`;
}

function buildSelection(
  schema: GraphQLSchema,
  outputType: GraphQLOutputType,
  depth: number,
  ancestors: Set<string>,
): string {
  const namedType = getNamedType(outputType);
  if (isScalarType(namedType) || isEnumType(namedType)) return '';
  if (depth >= 3 || ancestors.has(namedType.name)) return '__typename';

  const nextAncestors = new Set(ancestors).add(namedType.name);

  if (isUnionType(namedType)) {
    const fragments = namedType.getTypes().slice(0, 3).map((member) => {
      const memberSelection = buildObjectSelection(schema, member, depth, nextAncestors);
      return `... on ${member.name} {\n${indent(memberSelection, 1)}\n}`;
    });
    return ['__typename', ...fragments].join('\n');
  }

  if (isObjectType(namedType) || isInterfaceType(namedType)) {
    return buildObjectSelection(schema, namedType, depth, nextAncestors);
  }

  return '__typename';
}

function buildObjectSelection(
  schema: GraphQLSchema,
  type: Extract<GraphQLNamedType, { getFields(): unknown }>,
  depth: number,
  ancestors: Set<string>,
) {
  const fields = Object.values(type.getFields()) as GraphQLField<unknown, unknown>[];
  const safeFields = fields.filter(
    (field) => !field.args.some((argument) => isNonNullType(argument.type) && argument.defaultValue === undefined),
  );
  const ordered = [...safeFields].sort((left, right) => fieldPriority(left) - fieldPriority(right));
  const selections: string[] = [];

  const leafFields = ordered.filter((field) => {
    const namedFieldType = getNamedType(field.type);
    return isScalarType(namedFieldType) || isEnumType(namedFieldType);
  });
  selections.push(...leafFields.slice(0, 6).map((field) => field.name));

  if (depth < 2) {
    const objectFields = ordered.filter((field) => !leafFields.includes(field));
    for (const field of objectFields.slice(0, 2)) {
      const nested = buildSelection(schema, field.type, depth + 1, ancestors);
      selections.push(`${field.name} {\n${indent(nested, 1)}\n}`);
    }
  }

  return selections.length ? selections.join('\n') : '__typename';
}

function fieldPriority(field: GraphQLField<unknown, unknown>) {
  if (field.name === 'id') return -20;
  if (field.name === 'name') return -19;
  const namedType = getNamedType(field.type);
  return isScalarType(namedType) || isEnumType(namedType) ? 0 : 10;
}

function toOperationName(value: string) {
  const normalized = value.replace(/[^_0-9A-Za-z]/g, '');
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'GeneratedOperation';
}

function indent(value: string, level: number) {
  const padding = '  '.repeat(level);
  return value.split('\n').map((line) => `${padding}${line}`).join('\n');
}
