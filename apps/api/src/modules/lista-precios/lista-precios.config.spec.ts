import { resolveZohoAnalyticsConfig } from './lista-precios.config';

const VALID_ENVIRONMENT = {
  ZOHO_ORG_ID: '748410058',
  ZOHO_WORKSPACE_ID: '2400409000000791460',
  ZOHO_VIEW_ID: '2400409000025208315',
  ZOHO_CLIENT_ID: 'test-client-id',
  ZOHO_CLIENT_SECRET: 'test-client-secret',
  ZOHO_REFRESH_TOKEN: 'test-refresh-token',
};

describe('resolveZohoAnalyticsConfig', () => {
  it('resuelve la configuración cuando todas las variables están presentes', () => {
    expect(resolveZohoAnalyticsConfig(VALID_ENVIRONMENT)).toEqual({
      orgId: VALID_ENVIRONMENT.ZOHO_ORG_ID,
      workspaceId: VALID_ENVIRONMENT.ZOHO_WORKSPACE_ID,
      viewId: VALID_ENVIRONMENT.ZOHO_VIEW_ID,
      clientId: VALID_ENVIRONMENT.ZOHO_CLIENT_ID,
      clientSecret: VALID_ENVIRONMENT.ZOHO_CLIENT_SECRET,
      refreshToken: VALID_ENVIRONMENT.ZOHO_REFRESH_TOKEN,
    });
  });

  it.each(Object.keys(VALID_ENVIRONMENT))(
    'falla explícitamente cuando falta %s',
    (missingVariable) => {
      const environment = { ...VALID_ENVIRONMENT, [missingVariable]: undefined };

      expect(() => resolveZohoAnalyticsConfig(environment)).toThrow(missingVariable);
    },
  );

  it('falla explícitamente cuando una variable requerida está vacía', () => {
    expect(() =>
      resolveZohoAnalyticsConfig({ ...VALID_ENVIRONMENT, ZOHO_CLIENT_ID: '   ' }),
    ).toThrow('ZOHO_CLIENT_ID');
  });
});
