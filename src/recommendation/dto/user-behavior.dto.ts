import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BehaviorType {
  VIEW = 'VIEW',
  CLICK = 'CLICK',
  BOOKMARK = 'BOOKMARK',
  SEARCH = 'SEARCH',
  INQUIRY = 'INQUIRY',
  SHARE = 'SHARE',
}

export class BehaviorEventDto {
  @ApiProperty({
    description: 'Type of user behavior event',
    enum: BehaviorType,
    example: BehaviorType.VIEW,
  })
  @IsEnum(BehaviorType)
  eventType: BehaviorType;

  @ApiProperty({
    description: 'Listing ID the event relates to (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @ApiPropertyOptional({
    description: 'How long the user engaged (seconds), e.g. time on page',
    example: 45,
  })
  @IsNumber()
  @IsOptional()
  durationSeconds?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata from PostHog (JSON-serializable)',
    example: { source: 'search_results', position: 3 },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class IngestBehaviorDto {
  @ApiProperty({
    description: 'User ID from the backend system (UUID)',
    example: 'user-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Array of behavior events from PostHog',
    type: [BehaviorEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BehaviorEventDto)
  events: BehaviorEventDto[];
}

export class GetRecommendationsDto {
  @ApiProperty({
    description: 'User ID to get recommendations for',
    example: 'user-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Maximum number of recommendations to return',
    example: 10,
  })
  @IsNumber()
  @IsOptional()
  limit?: number;
}
