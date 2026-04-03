import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatQueryDto {
  @ApiProperty({
    description: 'The natural language prompt from the user.',
    example:
      'Find properties under 3B VND in Da Nang, compare them, estimate ROI, and explain risk.',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    description:
      'Thread ID for conversation context. Typically the conversation UUID ' +
      'managed by the backend. Required for multi-turn conversations.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  threadId: string;
}
