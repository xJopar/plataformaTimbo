const EVENT_LABELS: Record<string, string> = {
  'security.login_succeeded': 'Inicio de sesión',
  'security.login_denied': 'Inicio de sesión rechazado',
  'security.logout': 'Cierre de sesión',
  'access.user_preauthorized': 'Usuario preautorizado (automático)',
  'access.user_preauthorized_by_administrator': 'Usuario preautorizado',
  'access.user_administrative_data_updated': 'Datos de usuario actualizados',
  'access.user_deactivated': 'Usuario desactivado',
  'access.user_reactivated': 'Usuario reactivado',
  'access.platform_admin_assigned': 'Administrador de plataforma asignado',
  'access.application_created': 'Aplicación creada',
  'access.application_updated': 'Aplicación actualizada',
  'access.application_deactivated': 'Aplicación desactivada',
  'access.application_reactivated': 'Aplicación reactivada',
  'access.user_application_assigned': 'Aplicación asignada a usuario',
  'access.user_application_unassigned': 'Aplicación desasignada de usuario',
  'access.application_profile_created': 'Perfil funcional creado',
  'access.application_profile_updated': 'Perfil funcional actualizado',
  'access.application_profile_deactivated': 'Perfil funcional desactivado',
  'access.application_profile_reactivated': 'Perfil funcional reactivado',
  'access.application_profile_permission_added': 'Permiso agregado a perfil',
  'access.application_profile_permission_removed': 'Permiso retirado de perfil',
  'access.user_application_profile_assigned': 'Perfil funcional asignado a usuario',
  'access.user_application_profile_unassigned': 'Perfil funcional desasignado de usuario',
  'meta-company.goal_created': 'Meta creada',
  'meta-company.goal_updated': 'Meta actualizada',
  'meta-company.brand_created': 'Marca creada',
  'meta-company.brand_deactivated': 'Marca desactivada',
  'meta-company.brand_reactivated': 'Marca reactivada',
  'meta-company.business_created': 'Negocio creado',
  'meta-company.business_deactivated': 'Negocio desactivado',
  'meta-company.business_reactivated': 'Negocio reactivado',
  'lista-precios.catalog_opened': 'Ingresó al catálogo',
  'lista-precios.model_viewed': 'Vio un modelo',
  'lista-precios.consultation_started': 'Inició una consulta',
};

/**
 * Traduce un eventName conocido del catálogo de la plataforma. Para eventos de uso
 * (`source: USAGE`) reportados por otras aplicaciones, cae a una versión legible
 * derivada de la clave técnica en vez de una traducción, ya que esas claves las
 * define cada aplicación y no viven en este catálogo.
 */
export function humanizeEventName(eventName: string): string {
  const knownLabel = EVENT_LABELS[eventName];
  if (knownLabel !== undefined) return knownLabel;

  const words = eventName
    .split(/[._-]+/u)
    .filter((word) => word.length > 0)
    .join(' ');
  return words.length === 0 ? eventName : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
