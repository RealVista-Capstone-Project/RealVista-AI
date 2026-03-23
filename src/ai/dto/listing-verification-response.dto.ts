import { ApiProperty } from '@nestjs/swagger';

export class ListingVerificationResponseDto {
  @ApiProperty({
    description: 'Whether the listing content passed safety and quality checks',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'Score from 0-100 for absence of harmful content',
    example: 95,
  })
  safetyScore: number;

  @ApiProperty({
    description: 'Score from 0-100 for professional tone and quality',
    example: 80,
  })
  professionalismScore: number;

  @ApiProperty({
    description: 'Score from 0-100 for clarity and lack of errors',
    example: 85,
  })
  clarityScore: number;

  @ApiProperty({
    description: 'List of key property features mentioned in the text',
    example: ['3 phòng ngủ', 'view thành phố', 'nội thất đầy đủ'],
  })
  identifiedFeatures: string[];

  @ApiProperty({
    description: 'Detailed feedback and suggestions in Vietnamese',
    example: 'Nội dung bài đăng chuyên nghiệp và rõ ràng.',
  })
  feedback: string;

  @ApiProperty({
    description: 'The step where the workflow ended',
    example: 'content_verification_completed',
  })
  currentStep: string;
}
