import { ApiProperty } from '@nestjs/swagger';

export class FiveSDashboardDailyPointDto {
  @ApiProperty({ example: '2026-08-17' }) public entryDate!: string;

  @ApiProperty({ type: Number, nullable: true })
  public compliance!: number | null;
}

export class FiveSDashboardSummaryResponseDto {
  @ApiProperty({ type: String, nullable: true, example: '2026-08-17' })
  public lastLoadedDate!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  public lastLoadedCompliance!: number | null;

  @ApiProperty() public controlsPerformed!: number;
  @ApiProperty() public markedNotApplicable!: number;

  @ApiProperty({ type: FiveSDashboardDailyPointDto, isArray: true })
  public dailySeries!: FiveSDashboardDailyPointDto[];
}

export class FiveSCapabilitiesResponseDto {
  @ApiProperty() public canManageIndicators!: boolean;
  @ApiProperty() public canManageEntries!: boolean;
  @ApiProperty() public canManageParticipants!: boolean;
}
