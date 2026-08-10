export const SAMPLE_SCHEMA = /* GraphQL */ `
  """A country recognized by the demo catalog."""
  type Country {
    """Two-letter ISO 3166-1 country code."""
    code: ID!
    name: String!
    native: String!
    phone: String!
    capital: String
    currency: String
    emoji: String!
    continent: Continent!
    languages: [Language!]!
  }

  type Continent {
    code: ID!
    name: String!
    countries: [Country!]!
  }

  type Language {
    code: ID!
    name: String
    native: String
    rtl: Boolean!
  }

  """Filters accepted by the countries collection."""
  input CountryFilterInput {
    code: StringQueryOperatorInput
    currency: StringQueryOperatorInput
    continent: StringQueryOperatorInput
  }

  input StringQueryOperatorInput {
    eq: String
    ne: String
    in: [String!]
    nin: [String!]
    regex: String
    glob: String
  }

  type Query {
    """Find a country using its ISO code."""
    country(code: ID!): Country
    """List countries, optionally constrained by a filter."""
    countries(filter: CountryFilterInput): [Country!]!
    continent(code: ID!): Continent
    continents: [Continent!]!
    language(code: ID!): Language
    languages: [Language!]!
  }
`;

export const SAMPLE_ENDPOINT = 'https://api.cloudplatform.app.silverfort.com/graphql';
