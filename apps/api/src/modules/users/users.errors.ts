export abstract class UsersDomainError extends Error {
  public readonly operation: string;

  protected constructor(message: string, operation: string, cause?: unknown) {
    super(message, { cause });
    this.name = new.target.name;
    this.operation = operation;
  }
}

export class InvalidCorporateEmailError extends UsersDomainError {
  public constructor(operation: string) {
    super('El correo corporativo debe contener texto luego de normalizarse.', operation);
  }
}

export class UserNotFoundError extends UsersDomainError {
  public constructor(operation: string, cause?: unknown) {
    super('No se encontró el usuario solicitado.', operation, cause);
  }
}

export class UserInactiveError extends UsersDomainError {
  public constructor(operation: string) {
    super('El usuario se encuentra inactivo.', operation);
  }
}

export class CorporateEmailAlreadyInUseError extends UsersDomainError {
  public constructor(operation: string, cause: unknown) {
    super('Ya existe un usuario con el correo corporativo indicado.', operation, cause);
  }
}

export class GoogleSubjectAlreadyLinkedError extends UsersDomainError {
  public constructor(operation: string, cause?: unknown) {
    super('La identidad de Google ya está vinculada a un usuario.', operation, cause);
  }
}

export class ZohoCrmUserIdAlreadyInUseError extends UsersDomainError {
  public constructor(operation: string, cause: unknown) {
    super('El identificador de Zoho CRM ya está vinculado a un usuario.', operation, cause);
  }
}

export class InvalidUserStatusTransitionError extends UsersDomainError {
  public readonly currentStatus: 'ACTIVE' | 'INACTIVE';
  public readonly requestedStatus: 'ACTIVE' | 'INACTIVE';

  public constructor(
    operation: string,
    currentStatus: 'ACTIVE' | 'INACTIVE',
    requestedStatus: 'ACTIVE' | 'INACTIVE',
  ) {
    super('La transición solicitada no es válida para el estado actual del usuario.', operation);
    this.currentStatus = currentStatus;
    this.requestedStatus = requestedStatus;
  }
}

export class PlatformAdministratorCannotBeDeactivatedError extends UsersDomainError {
  public constructor() {
    super(
      'Un administrador de plataforma no puede desactivarse en este primer corte.',
      'deactivateUser',
    );
  }
}
