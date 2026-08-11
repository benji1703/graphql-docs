import {
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  valueFromAST,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql';

export interface OperationBuilderOptions {
  argumentNames?: Iterable<string>;
  fieldNames?: Iterable<string>;
  filterFieldNames?: Iterable<string>;
}

export function generateOperation(
  schema: GraphQLSchema,
  parentName: string,
  fieldName: string,
  options?: OperationBuilderOptions,
): string {
  const roots = [
    { kind: 'query', type: schema.getQueryType() },
    { kind: 'mutation', type: schema.getMutationType() },
    { kind: 'subscription', type: schema.getSubscriptionType() },
  ] as const;
  const root = roots.find((entry) => entry.type?.name === parentName);
  const field = root?.type?.getFields()[fieldName];
  if (!root || !field) throw new Error(`${parentName}.${fieldName} is not a root operation.`);

  const operationName = toOperationName(field.name);
  const selectedArgumentNames = options?.argumentNames
    ? new Set(options.argumentNames)
    : new Set(defaultArgumentNames(field.args));
  const selectedArguments = field.args.filter((argument) => selectedArgumentNames.has(argument.name));
  const variableDefinitions = selectedArguments.map((argument) => `$${argument.name}: ${String(argument.type)}`).join(', ');
  const argumentUsage = selectedArguments.map((argument) => `${argument.name}: $${argument.name}`).join(', ');
  const selectedFields = options?.fieldNames ? new Set(options.fieldNames) : undefined;
  const selectionTarget = selectedFields ? resolveSelectionTarget(field.type) : undefined;
  const selection = buildSelection(schema, field.type, 0, new Set(), selectedFields, selectionTarget?.name);
  const definition = variableDefinitions ? `(${variableDefinitions})` : '';
  const invocation = argumentUsage ? `${field.name}(${argumentUsage})` : field.name;
  const body = selection ? `${invocation} {\n${indent(selection, 2)}\n  }` : invocation;

  return `${root.kind} ${operationName}${definition} {\n  ${body}\n}`;
}

export function generateOperationVariables(
  schema: GraphQLSchema,
  parentName: string,
  fieldName: string,
  options?: OperationBuilderOptions,
) {
  const parent = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()]
    .find((type) => type?.name === parentName);
  const field = parent?.getFields()[fieldName];
  if (!parent || !field) throw new Error(`${parentName}.${fieldName} is not a root operation.`);

  const selectedArgumentNames = options?.argumentNames
    ? new Set(options.argumentNames)
    : new Set(defaultArgumentNames(field.args));
  const selectedFilterFields = new Set(options?.filterFieldNames ?? []);

  return Object.fromEntries(field.args
    .filter((argument) => selectedArgumentNames.has(argument.name))
    .map((argument) => {
      if (argument.name === 'filter' && selectedFilterFields.size) {
        const namedFilter = getNamedType(argument.type);
        if (isInputObjectType(namedFilter)) {
          return [argument.name, Object.fromEntries([...selectedFilterFields]
            .map((name) => namedFilter.getFields()[name])
            .filter(Boolean)
            .map((filterField) => [filterField.name, sampleInputValue(filterField.type, new Set(), true)]))];
        }
      }
      return [
        argument.name,
        readDefaultValue(argument) ?? sampleInputValue(argument.type, new Set(), true),
      ];
    }));
}

function sampleInputValue(type: GraphQLInputType, ancestors: Set<string>, includeSuggestion = false): unknown {
  if (isNonNullType(type)) return sampleInputValue(type.ofType, ancestors, includeSuggestion);
  if (isListType(type)) return [];
  if (isEnumType(type)) return type.getValues()[0]?.name ?? null;
  if (isInputObjectType(type)) {
    if (ancestors.has(type.name)) return {};
    const nextAncestors = new Set(ancestors).add(type.name);
    const allFields = Object.values(type.getFields());
    const requiredFields = allFields.filter(
      (field) => isNonNullType(field.type) && !hasDefaultValue(field),
    );
    const suggestedField = includeSuggestion && !requiredFields.length
      ? [...allFields].sort((left, right) => inputFieldPriority(left.name) - inputFieldPriority(right.name))[0]
      : undefined;
    const fields = suggestedField ? [suggestedField] : requiredFields;
    return Object.fromEntries(fields.map((field) => [field.name, sampleInputValue(field.type, nextAncestors, includeSuggestion)]));
  }
  if (isScalarType(type)) {
    if (type.name === 'Boolean') return false;
    if (type.name === 'Int' || type.name === 'Float') return 0;
    if (type.name === 'ID') return 'replace-with-id';
    if (/json/i.test(type.name)) return {};
    if (/date|time/i.test(type.name)) return '2026-01-01T00:00:00Z';
    return 'value';
  }
  return null;
}

function buildSelection(
  schema: GraphQLSchema,
  outputType: GraphQLOutputType,
  depth: number,
  ancestors: Set<string>,
  selectedFields?: Set<string>,
  selectionTargetName?: string,
): string {
  const namedType = getNamedType(outputType);
  if (isScalarType(namedType) || isEnumType(namedType)) return '';
  if (depth >= 3 || ancestors.has(namedType.name)) return '__typename';

  const nextAncestors = new Set(ancestors).add(namedType.name);

  if (selectedFields && namedType.name === selectionTargetName && (isObjectType(namedType) || isInterfaceType(namedType))) {
    return buildExplicitSelection(schema, namedType, selectedFields, depth, nextAncestors);
  }

  if (isUnionType(namedType)) {
    const fragments = namedType.getTypes().slice(0, 3).map((member) => {
      const memberSelection = buildObjectSelection(schema, member, depth, nextAncestors, selectedFields, selectionTargetName);
      return `... on ${member.name} {\n${indent(memberSelection, 1)}\n}`;
    });
    return ['__typename', ...fragments].join('\n');
  }

  if (isObjectType(namedType) || isInterfaceType(namedType)) {
    return buildObjectSelection(schema, namedType, depth, nextAncestors, selectedFields, selectionTargetName);
  }

  return '__typename';
}

function buildObjectSelection(
  schema: GraphQLSchema,
  type: Extract<GraphQLNamedType, { getFields(): unknown }>,
  depth: number,
  ancestors: Set<string>,
  selectedFields?: Set<string>,
  selectionTargetName?: string,
) {
  const fields = Object.values(type.getFields()) as GraphQLField<unknown, unknown>[];
  const safeFields = fields.filter(
    (field) => !field.args.some((argument) => isNonNullType(argument.type) && !hasDefaultValue(argument)),
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
      const nested = buildSelection(schema, field.type, depth + 1, ancestors, selectedFields, selectionTargetName);
      selections.push(`${field.name} {\n${indent(nested, 1)}\n}`);
    }
  }

  return selections.length ? selections.join('\n') : '__typename';
}

export function getOperationBuilderDefaults(schema: GraphQLSchema, parentName: string, fieldName: string) {
  const parent = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()]
    .find((type) => type?.name === parentName);
  const field = parent?.getFields()[fieldName];
  if (!parent || !field) throw new Error(`${parentName}.${fieldName} is not a root operation.`);
  const target = resolveSelectionTarget(field.type);
  const fields = target && (isObjectType(target) || isInterfaceType(target))
    ? Object.values(target.getFields())
      .filter((candidate) => !candidate.args.some((argument) => isNonNullType(argument.type) && !hasDefaultValue(argument)))
      .filter((candidate) => {
        const named = getNamedType(candidate.type);
        return isScalarType(named) || isEnumType(named);
      })
      .sort((left, right) => fieldPriority(left) - fieldPriority(right))
      .slice(0, 6)
      .map((candidate) => candidate.name)
    : [];
  return { argumentNames: defaultArgumentNames(field.args), fieldNames: fields };
}

function defaultArgumentNames(args: ReadonlyArray<{ name: string; type: GraphQLInputType; defaultValue?: unknown }>) {
  return args
    .filter((argument) => isNonNullType(argument.type) && !hasDefaultValue(argument))
    .map((argument) => argument.name);
}

type DefaultedInput = {
  type: GraphQLInputType;
  defaultValue?: unknown;
  default?: unknown;
  astNode?: { defaultValue?: Parameters<typeof valueFromAST>[0] } | null;
};

function hasDefaultValue(input: DefaultedInput) {
  return input.defaultValue !== undefined
    || input.default !== undefined
    || input.astNode?.defaultValue !== undefined;
}

function readDefaultValue(input: DefaultedInput) {
  if (input.defaultValue !== undefined) return input.defaultValue;
  if (input.astNode?.defaultValue) return valueFromAST(input.astNode.defaultValue, input.type);
  return undefined;
}

function resolveSelectionTarget(outputType: GraphQLOutputType): GraphQLNamedType {
  const type = getNamedType(outputType);
  if (!isObjectType(type) && !isInterfaceType(type)) return type;
  const fields = type.getFields();
  const directNode = fields.node ?? fields.nodes;
  if (directNode) return getNamedType(directNode.type);
  const edges = fields.edges;
  if (edges) {
    const edgeType = getNamedType(edges.type);
    if (isObjectType(edgeType) || isInterfaceType(edgeType)) {
      const node = edgeType.getFields().node;
      if (node) return getNamedType(node.type);
    }
  }
  return type;
}

function buildExplicitSelection(
  schema: GraphQLSchema,
  type: Extract<GraphQLNamedType, { getFields(): unknown }>,
  selectedFields: Set<string>,
  depth: number,
  ancestors: Set<string>,
) {
  const fields = type.getFields() as Record<string, GraphQLField<unknown, unknown>>;
  const selections = [...selectedFields].map((name) => fields[name]).filter(Boolean).map((field) => {
    const named = getNamedType(field.type);
    if (isScalarType(named) || isEnumType(named)) return field.name;
    const nested = buildSelection(schema, field.type, depth + 1, ancestors);
    return `${field.name} {\n${indent(nested, 1)}\n}`;
  });
  return selections.length ? selections.join('\n') : '__typename';
}

function inputFieldPriority(name: string) {
  if (name === 'eq') return -20;
  if (name === 'contains') return -19;
  if (name === 'in') return -18;
  return 0;
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
