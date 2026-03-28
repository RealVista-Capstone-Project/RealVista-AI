import { Controller, Post, Body, Res, Header, UseGuards } from '@nestjs/common';
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

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Chat endpoint — responds as an SSE stream.
   *
   * Event format:
   *   event: start      → data: { "threadId": "..." }
   *   event: token      → data: { "content": "..." }   (multiple)
   *   event: tool_start → data: { "name": "..." }
   *   event: tool_end   → data: { "name": "..." }
   *   event: done       → data: {}
   *   event: error      → data: { "message": "..." }
   *
   * Pass `threadId` in the request body to continue an existing conversation.
   * Omit it (or set to null) to start a new thread — the server will assign one
   * and return it in the `start` event.
   */
  @Post('chat')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary: 'Chat with the AI agent (SSE token stream)',
    description:
      'Opens a Server-Sent Events stream. Each SSE event has a named `event:` field. ' +
      'Reconnect using the `threadId` from the `start` event to continue the conversation.',
  })
  @ApiResponse({
    status: 200,
    description:
      'SSE stream: start → token(s) → [tool_start/tool_end] → done | error',
  })
  async chat(
    @Body() chatQueryDto: ChatQueryDto,
    @User() user: UserContext,
    @Res() res: Response,
  ) {
    const sseStream = this.aiService.processChatSse(
      chatQueryDto.prompt,
      chatQueryDto.threadId,
      user,
    );

    for await (const { event, data } of sseStream) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    res.end();
  }
}
