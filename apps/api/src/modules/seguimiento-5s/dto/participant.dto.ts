import { ApiProperty } from '@nestjs/swagger';

export const FIVE_S_ROLE_KEYS = ['lider-5s', 'miembro-5s'] as const;
export type FiveSRoleKey = (typeof FIVE_S_ROLE_KEYS)[number];

export class FiveSParticipantResponseDto {
  @ApiProperty() public userId!: string;
  @ApiProperty() public displayName!: string;
  @ApiProperty() public corporateEmail!: string;

  @ApiProperty({ enum: FIVE_S_ROLE_KEYS, nullable: true })
  public roleKey!: FiveSRoleKey | null;
}

export class SetFiveSParticipantRoleDto {
  @ApiProperty({ enum: FIVE_S_ROLE_KEYS })
  public roleKey!: FiveSRoleKey;
}
