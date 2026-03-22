import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AnalysisResultDto {
  @ApiProperty({
    description: 'Score from 0-100 for lighting quality',
    example: 85,
  })
  lightingScore: number;

  @ApiProperty({
    description: 'Score from 0-100 for composition and framing',
    example: 90,
  })
  compositionScore: number;

  @ApiProperty({
    description: 'Score from 0-100 for image resolution and clarity',
    example: 88,
  })
  clarityScore: number;

  @ApiProperty({
    description: 'Specific room or area identified in the image',
    example: 'Master Bedroom',
  })
  listingRelevance: string;

  @ApiProperty({
    description: 'Constructive feedback in Vietnamese',
    example: 'Ánh sáng tốt, bố cục cân đối.',
  })
  feedback: string;
}

export class ImageAnalysisResponseDto {
  @ApiPropertyOptional({ description: 'Detailed analysis results' })
  analysis?: AnalysisResultDto;

  @ApiPropertyOptional({
    description: 'Final aggregated score (0-100)',
    example: 87,
  })
  finalScore?: number;

  @ApiPropertyOptional({
    description: 'The step where the workflow ended',
    example: 'scoring_completed',
  })
  currentStep?: string;

  @ApiPropertyOptional({
    description: 'Associated listing ID',
    example: 'listing-123',
  })
  listingId?: string;

  @ApiPropertyOptional({
    description: 'URL or name of the image',
    example: 'uploaded-file',
  })
  imageUrl?: string;
}
