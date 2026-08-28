export class FirstPlatformAdministratorAlreadyAssignedError extends Error {
  public constructor() {
    super('Ya existe un administrador de plataforma asignado.');
    this.name = new.target.name;
  }
}

export class PlatformAdministratorCannotRevokeOwnRoleError extends Error {
  public constructor() {
    super('Un administrador no puede revocar su propio rol de plataforma.');
    this.name = new.target.name;
  }
}

export class LastPlatformAdministratorCannotBeRevokedError extends Error {
  public constructor() {
    super('No se puede revocar el último administrador activo de la plataforma.');
    this.name = new.target.name;
  }
}

export class InactiveUserCannotBecomePlatformAdministratorError extends Error {
  public constructor() {
    super('Sólo un usuario activo puede convertirse en administrador de plataforma.');
    this.name = new.target.name;
  }
}
