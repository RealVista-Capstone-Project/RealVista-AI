import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BulkIndividualResultDto {
  @ApiProperty({
    description: 'Index of the image in the uploaded array',
    example: 0,
  })
  imageIndex: number;

  @ApiProperty({ description: 'Original file name', example: 'kitchen.jpg' })
  imageName: string;

  @ApiProperty({
    description: 'Whether the image is a valid property photo',
    example: true,
  })
  isValidProperty: boolean;

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
    description: 'Specific area of the house identified',
    example: 'Master Bedroom',
  })
  listingRelevance: string;

  @ApiProperty({
    description: 'Constructive feedback in Vietnamese',
    example: 'Ánh sáng tốt.',
  })
  feedback: string;

  @ApiProperty({ description: 'Final aggregated score (0-100)', example: 87 })
  finalScore: number;
}

class BulkCollectionAnalysisDto {
  @ApiProperty({
    description: 'Whether the image set covers various rooms',
    example: true,
  })
  hasVariety: boolean;

  @ApiProperty({
    description: 'Whether duplicate/similar images were detected',
    example: false,
  })
  duplicatesDetected: boolean;

  @ApiProperty({
    description: 'List of room types missing from the collection',
    example: ['Bathroom', 'Exterior'],
  })
  missingAreas: string[];

  @ApiProperty({
    description: 'Overall listing photo quality score (0-100)',
    example: 82,
  })
  overallScore: number;

  @ApiProperty({
    description:
      'Suggestions for improving the photo collection, in Vietnamese',
    example: 'Nên bổ sung ảnh phòng tắm và mặt tiền.',
  })
  suggestion: string;
}

export class BulkImageAnalysisResponseDto {
  @ApiProperty({
    description: 'Per-image analysis results',
    type: [BulkIndividualResultDto],
  })
  individualResults: BulkIndividualResultDto[];

  @ApiProperty({
    description: 'Collection-level analysis of all images',
    type: BulkCollectionAnalysisDto,
  })
  collectionAnalysis: BulkCollectionAnalysisDto;

  @ApiPropertyOptional({ description: 'The step where the workflow ended' })
  currentStep?: string;

  @ApiPropertyOptional({ description: 'Associated listing ID' })
  listingId?: string;
}
