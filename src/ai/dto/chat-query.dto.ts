import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatQueryDto {
  @ApiProperty({
    description: 'The natural language prompt from the user.',
    example:
      'Find properties under 3B VND in Da Nang, compare them, estimate ROI, and explain risk.',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    description:
      'Optional: override the auto-assigned thread. Omit to use your persistent user thread (7-day TTL).',
  })
  @IsString()
  @IsOptional()
  threadId?: string;
}
