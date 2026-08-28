const configuredCorporateEmailDomain =
  import.meta.env.VITE_CORPORATE_EMAIL_DOMAIN?.trim().toLowerCase();

export const corporateEmailDomain =
  configuredCorporateEmailDomain === undefined || configuredCorporateEmailDomain.length === 0
    ? 'timbo.com.py'
    : configuredCorporateEmailDomain;
