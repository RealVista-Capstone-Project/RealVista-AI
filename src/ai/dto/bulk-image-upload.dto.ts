import { ApiProperty } from '@nestjs/swagger';

export class BulkImageUploadDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description:
      'Array of image files to analyze (max 20). Supported formats: JPEG, PNG, WebP, HEIC, HEIF.',
  })
  files: unknown[];

  @ApiProperty({
    description: 'Listing ID to associate with the images.',
    example: 'listing-123',
    required: false,
  })
  listingId?: string;
}
