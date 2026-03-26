import { ApiProperty } from '@nestjs/swagger';

export class ImageUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The image file to analyze.',
  })
  file: unknown;

  @ApiProperty({
    description: 'Optional listing ID to associate with the image.',
    example: 'listing-123',
    required: false,
  })
  listingId?: string;
}
