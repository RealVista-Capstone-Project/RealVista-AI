import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './services/ai.service';
import { ChatQueryDto } from './dto/chat-query.dto';
import { User } from '../decorators/user/user.decorator';
import type { UserContext } from './interfaces/user-context.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key/api-key.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Process a chat query synchronously' })
  @ApiResponse({
    status: 200,
    description: 'The final response from the AI agent.',
  })
  async chat(@Body() chatQueryDto: ChatQueryDto, @User() user: UserContext) {
    return this.aiService.processSync(chatQueryDto.prompt, user);
  }

  @Post('stream')
  @ApiOperation({ summary: 'Stream the chat query response via SSE' })
  @ApiResponse({ status: 200, description: 'SSE stream of events.' })
  async stream(
    @Body() chatQueryDto: ChatQueryDto,
    @User() user: UserContext,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const threadId = chatQueryDto.threadId || 'new-thread'; // Simplified for now
    const eventStream = this.aiService.processStream(
      chatQueryDto.prompt,
      threadId,
      user,
    );

    for await (const event of eventStream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.end();
  }
}
