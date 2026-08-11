export function createExplorerHeaders(organization: string, authorization: string): Record<string, string> {
  const normalizedOrganization = organization.trim();
  const normalizedAuthorization = authorization.trim().replace(/^Bearer\s+/i, '');

  if (!normalizedOrganization) throw new Error('Organization is required before running an operation.');
  if (!normalizedAuthorization) throw new Error('Authorization token is required before running an operation.');

  return {
    Organization: normalizedOrganization,
    Authorization: `Bearer ${normalizedAuthorization}`,
  };
}
