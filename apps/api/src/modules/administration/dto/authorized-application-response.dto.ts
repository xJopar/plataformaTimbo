import { ApiProperty } from '@nestjs/swagger';
import type { AuthorizedApplication } from '../applications.service';

export class AuthorizedApplicationResponseDto {
  @ApiProperty({ example: 'hello-world' })
  key!: string;

  @ApiProperty({ example: 'Hello World' })
  name!: string;

  @ApiProperty({ example: 'Primera aplicación de Plataforma Timbo.', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ example: '/apps/hello-world' })
  launchPath!: string;

  @ApiProperty({ example: 0, minimum: 0 })
  displayOrder!: number;
}

export function toAuthorizedApplicationResponse(
  application: AuthorizedApplication,
): AuthorizedApplicationResponseDto {
  return application;
}
