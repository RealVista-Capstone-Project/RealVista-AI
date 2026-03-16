import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyListingDto {
  @ApiProperty({
    description: 'The title of the real estate listing',
    example: 'Căn hộ chung cư cao cấp 3 phòng ngủ tại Landmark 81',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'The detailed description of the property',
    example: 'Căn hộ rộng 100m2, nội thất đầy đủ, view thành phố tuyệt đẹp...',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Optional listing ID if verifying an existing listing',
    required: false,
  })
  @IsString()
  @IsOptional()
  listingId?: string;
}
