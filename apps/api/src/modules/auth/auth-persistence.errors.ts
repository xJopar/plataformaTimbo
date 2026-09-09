export class OAuthLoginAttemptUnavailableError extends Error {
  public readonly operation: string;

  public constructor(operation: string) {
    super('El intento de inicio de sesion no existe, vencio o ya fue consumido.');
    this.name = new.target.name;
    this.operation = operation;
  }
}

export class UserSessionUnavailableError extends Error {
  public readonly operation: string;

  public constructor(operation: string) {
    super('La sesion no existe, vencio o fue revocada.');
    this.name = new.target.name;
    this.operation = operation;
  }
}
