import {
  getNamedType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
} from 'graphql';

export interface ExplorerCatalogItem {
  name: string;
  type: string;
  description?: string | null;
}

export interface ExplorerCatalog {
  filterType?: string;
  filters: ExplorerCatalogItem[];
  responseType?: string;
  fields: ExplorerCatalogItem[];
}

export function getExplorerCatalog(schema: GraphQLSchema, rootName: string, fieldName: string): ExplorerCatalog {
  const root = schema.getType(rootName);
  if (!isObjectType(root)) return { filters: [], fields: [] };
  const operation = root.getFields()[fieldName];
  if (!operation) return { filters: [], fields: [] };

  const filterArgument = operation.args.find((argument) => argument.name === 'filter');
  const namedFilter = filterArgument ? getNamedType(filterArgument.type) : undefined;
  const filterFields = namedFilter && isInputObjectType(namedFilter)
    ? Object.values(namedFilter.getFields())
    : operation.args;

  const responseType = resolveEntityType(getNamedType(operation.type));
  const responseFields = responseType && (isObjectType(responseType) || isInterfaceType(responseType))
    ? Object.values(responseType.getFields())
    : [];

  return {
    filterType: namedFilter?.name,
    filters: filterFields.map(toCatalogItem),
    responseType: responseType?.name,
    fields: responseFields.map(toCatalogItem),
  };
}

function resolveEntityType(type: GraphQLNamedType): GraphQLNamedType {
  if (!isObjectType(type) && !isInterfaceType(type)) return type;
  const fields = type.getFields();

  const directNode = fields.node ?? fields.nodes;
  if (directNode) return getNamedType(directNode.type);

  const edges = fields.edges;
  if (edges) {
    const edgeType = getNamedType(edges.type);
    if (isObjectType(edgeType) || isInterfaceType(edgeType)) {
      const edgeNode = edgeType.getFields().node;
      if (edgeNode) return getNamedType(edgeNode.type);
    }
  }

  return type;
}

function toCatalogItem(field: GraphQLField<unknown, unknown> | { name: string; type: unknown; description?: string | null }): ExplorerCatalogItem {
  return {
    name: field.name,
    type: String(field.type),
    description: field.description,
  };
}
