function resolveMetaCompanyEnabled(environment) {
  const normalizedValue = environment.META_COMPANY_ENABLED?.trim().toLowerCase();

  if (normalizedValue === undefined || normalizedValue === '') {
    return true;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error('La variable de entorno META_COMPANY_ENABLED debe ser true o false.');
}

module.exports = { resolveMetaCompanyEnabled };
