import {
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  type GraphQLType,
} from 'graphql';

export type TypeCategory = 'object' | 'input' | 'enum' | 'interface' | 'union' | 'scalar';

export interface TypeGroup {
  category: TypeCategory;
  label: string;
  types: GraphQLNamedType[];
}

export interface SearchItem {
  id: string;
  kind: 'type' | 'query' | 'mutation' | 'subscription' | 'field' | 'argument' | 'enum';
  title: string;
  context: string;
  description: string;
  signature: string;
  path: string;
  keywords: string;
}

const CATEGORY_LABELS: Record<TypeCategory, string> = {
  object: 'Objects',
  input: 'Inputs',
  enum: 'Enums',
  interface: 'Interfaces',
  union: 'Unions',
  scalar: 'Scalars',
};

export function getTypeCategory(type: GraphQLNamedType): TypeCategory {
  if (isObjectType(type)) return 'object';
  if (isInputObjectType(type)) return 'input';
  if (isEnumType(type)) return 'enum';
  if (isInterfaceType(type)) return 'interface';
  if (isUnionType(type)) return 'union';
  return 'scalar';
}

export function getTypeGroups(schema: GraphQLSchema): TypeGroup[] {
  const rootNames = new Set(
    [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()]
      .filter(Boolean)
      .map((type) => type!.name),
  );

  const visibleTypes = Object.values(schema.getTypeMap())
    .filter((type) => !type.name.startsWith('__'))
    .filter((type) => !rootNames.has(type.name))
    .filter((type) => !(isScalarType(type) && isSpecifiedScalarType(type)))
    .sort((left, right) => left.name.localeCompare(right.name));

  return (Object.keys(CATEGORY_LABELS) as TypeCategory[])
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      types: visibleTypes.filter((type) => getTypeCategory(type) === category),
    }))
    .filter((group) => group.types.length > 0);
}

export function getSchemaStats(schema: GraphQLSchema) {
  const groups = getTypeGroups(schema);
  const operationTypes = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()].filter(
    Boolean,
  );
  const operationCount = operationTypes.reduce(
    (total, type) => total + Object.keys(type!.getFields()).length,
    0,
  );
  const typeCount = groups.reduce((total, group) => total + group.types.length, 0);
  const fieldCount = groups.reduce((total, group) => {
    return (
      total +
      group.types.reduce((count, type) => {
        if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
          return count + Object.keys(type.getFields()).length;
        }
        return count;
      }, 0)
    );
  }, operationCount);

  return { operationCount, typeCount, fieldCount };
}

export function formatFieldSignature(field: GraphQLField<unknown, unknown>): string {
  const args = field.args.length
    ? `(${field.args.map((argument) => `${argument.name}: ${String(argument.type)}`).join(', ')})`
    : '';
  return `${field.name}${args}: ${String(field.type)}`;
}

export function formatArgumentSignature(argument: GraphQLArgument): string {
  const defaultValue = argument.defaultValue === undefined ? '' : ` = ${JSON.stringify(argument.defaultValue)}`;
  return `${argument.name}: ${String(argument.type)}${defaultValue}`;
}

export function typePath(typeName: string, fieldName?: string): string {
  const base = `/docs/${encodeURIComponent(typeName)}`;
  return fieldName ? `${base}/${encodeURIComponent(fieldName)}` : base;
}

export function getNamedTypePath(type: GraphQLType): string {
  return typePath(getNamedType(type).name);
}

export function buildSearchIndex(schema: GraphQLSchema): SearchItem[] {
  const items: SearchItem[] = [];
  // Leaf-level entries multiply memory on generated enterprise schemas. Fields
  // retain argument names in their keywords, while small schemas keep the more
  // granular argument and enum-value results.
  const includeLeafDefinitions = Object.keys(schema.getTypeMap()).length < 10_000;
  const roots = [
    { type: schema.getQueryType(), kind: 'query' as const },
    { type: schema.getMutationType(), kind: 'mutation' as const },
    { type: schema.getSubscriptionType(), kind: 'subscription' as const },
  ];

  for (const { type, kind } of roots) {
    if (!type) continue;
    items.push(makeTypeSearchItem(type));
    for (const field of Object.values(type.getFields())) {
      items.push(makeFieldSearchItem(type.name, field, kind));
      if (includeLeafDefinitions) {
        items.push(...field.args.map((argument) => makeArgumentSearchItem(type.name, field, argument)));
      }
    }
  }

  for (const group of getTypeGroups(schema)) {
    for (const type of group.types) {
      items.push(makeTypeSearchItem(type));

      if (isObjectType(type) || isInterfaceType(type)) {
        for (const field of Object.values(type.getFields())) {
          items.push(makeFieldSearchItem(type.name, field, 'field'));
          if (includeLeafDefinitions) {
            items.push(...field.args.map((argument) => makeArgumentSearchItem(type.name, field, argument)));
          }
        }
      } else if (isInputObjectType(type)) {
        for (const field of Object.values(type.getFields())) {
          items.push({
            id: `input:${type.name}.${field.name}`,
            kind: 'field',
            title: field.name,
            context: type.name,
            description: field.description ?? '',
            signature: `${field.name}: ${String(field.type)}`,
            path: typePath(type.name, field.name),
            keywords: `${type.name}.${field.name} ${type.name} input ${field.name}`.toLowerCase(),
          });
        }
      } else if (isEnumType(type) && includeLeafDefinitions) {
        for (const value of type.getValues()) {
          items.push({
            id: `enum:${type.name}.${value.name}`,
            kind: 'enum',
            title: value.name,
            context: type.name,
            description: value.description ?? '',
            signature: value.name,
            path: typePath(type.name, value.name),
            keywords: `${type.name}.${value.name} ${type.name} enum ${value.name}`.toLowerCase(),
          });
        }
      }
    }
  }

  return items;
}

function makeTypeSearchItem(type: GraphQLNamedType): SearchItem {
  return {
    id: `type:${type.name}`,
    kind: 'type',
    title: type.name,
    context: CATEGORY_LABELS[getTypeCategory(type)].slice(0, -1),
    description: type.description ?? '',
    signature: type.name,
    path: typePath(type.name),
    keywords: `${type.name} ${getTypeCategory(type)}`.toLowerCase(),
  };
}

function makeFieldSearchItem(
  parentName: string,
  field: GraphQLField<unknown, unknown>,
  kind: SearchItem['kind'],
): SearchItem {
  return {
    id: `field:${parentName}.${field.name}`,
    kind,
    title: field.name,
    context: parentName,
    description: field.description ?? '',
    signature: formatFieldSignature(field),
    path: typePath(parentName, field.name),
    keywords: `${parentName}.${field.name} ${parentName} ${field.name} ${String(field.type)} ${field.args.map((arg) => arg.name).join(' ')}`.toLowerCase(),
  };
}

function makeArgumentSearchItem(
  parentName: string,
  field: GraphQLField<unknown, unknown>,
  argument: GraphQLArgument,
): SearchItem {
  return {
    id: `argument:${parentName}.${field.name}.${argument.name}`,
    kind: 'argument',
    title: argument.name,
    context: `${parentName}.${field.name}`,
    description: argument.description ?? '',
    signature: formatArgumentSignature(argument),
    path: typePath(parentName, field.name),
    keywords: `${parentName}.${field.name}.${argument.name} ${parentName} ${field.name} argument ${argument.name} ${String(argument.type)}`.toLowerCase(),
  };
}
