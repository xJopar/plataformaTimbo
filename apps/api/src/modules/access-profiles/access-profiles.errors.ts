export class FirstPlatformAdministratorAlreadyAssignedError extends Error {
  public constructor() {
    super('Ya existe un administrador de plataforma asignado.');
    this.name = new.target.name;
  }
}
