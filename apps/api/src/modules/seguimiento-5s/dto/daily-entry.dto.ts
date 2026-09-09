import { ApiProperty } from '@nestjs/swagger';
import { FiveSEntryValue } from '../../../generated/prisma/client';

export class SaveFiveSDailyEntryItemDto {
  @ApiProperty() public userId!: string;
  @ApiProperty() public indicatorId!: string;
  @ApiProperty({ enum: FiveSEntryValue }) public value!: FiveSEntryValue;
}

export class SaveFiveSDailyEntriesRequestDto {
  @ApiProperty({ example: '2026-08-17' })
  public entryDate!: string;

  @ApiProperty({ type: SaveFiveSDailyEntryItemDto, isArray: true })
  public entries!: SaveFiveSDailyEntryItemDto[];
}

export class FiveSDailyIndicatorValueDto {
  @ApiProperty() public indicatorId!: string;

  @ApiProperty({ enum: FiveSEntryValue, nullable: true })
  public value!: FiveSEntryValue | null;
}

export class FiveSDailyPersonSummaryDto {
  @ApiProperty() public userId!: string;
  @ApiProperty() public displayName!: string;
  @ApiProperty({ type: String, nullable: true }) public roleKey!: string | null;

  @ApiProperty({ type: FiveSDailyIndicatorValueDto, isArray: true })
  public indicatorValues!: FiveSDailyIndicatorValueDto[];

  @ApiProperty() public points!: number;
  @ApiProperty() public evaluated!: number;
  @ApiProperty() public notApplicable!: number;
  @ApiProperty() public pending!: number;

  @ApiProperty({ type: Number, nullable: true })
  public compliance!: number | null;
}

export class FiveSDailyEntriesResponseDto {
  @ApiProperty({ example: '2026-08-17' }) public entryDate!: string;

  @ApiProperty({ type: FiveSDailyPersonSummaryDto, isArray: true })
  public people!: FiveSDailyPersonSummaryDto[];
}
