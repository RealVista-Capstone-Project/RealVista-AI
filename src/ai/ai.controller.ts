import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Res,
  Header,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './services/ai.service';
import { RedisCheckpointerService } from './services/redis-checkpointer.service';
import { ChatQueryDto } from './dto/chat-query.dto';
import { User } from '../decorators/user/user.decorator';
import type { UserContext } from './interfaces/user-context.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key/api-key.guard';

@ApiTags('ai')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly redisCheckpointer: RedisCheckpointerService,
  ) {}

  /**
   * Chat endpoint -- responds as an SSE stream.
   *
   * Event format:
   *   event: start      -> data: { "threadId": "..." }
   *   event: token      -> data: { "content": "..." }   (multiple)
   *   event: tool_start -> data: { "name": "..." }
   *   event: tool_end   -> data: { "name": "..." }
   *   event: done       -> data: { "fullResponse": "..." }
   *   event: error      -> data: { "message": "..." }
   *
   * `threadId` is required -- typically the conversation UUID from Spring Boot.
   */
  @Post('chat')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary: 'Chat with the AI agent (SSE token stream)',
    description:
      'Opens a Server-Sent Events stream. Each SSE event has a named `event:` field. ' +
      'The `done` event includes the full accumulated assistant response. ' +
      'Pass a `threadId` to maintain conversation context across calls.',
  })
  @ApiResponse({
    status: 200,
    description:
      'SSE stream: start -> token(s) -> [tool_start/tool_end] -> done (with fullResponse) | error',
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

  /**
   * Delete all Redis state for a given LangGraph thread.
   * Called by Spring Boot when a conversation is deleted from PostgreSQL.
   */
  @Delete('threads/:threadId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete thread state from Redis',
    description:
      'Removes all LangGraph checkpoint data for the given threadId. ' +
      'Call this when a conversation is permanently deleted.',
  })
  @ApiParam({ name: 'threadId', description: 'Thread ID to purge' })
  @ApiResponse({ status: 204, description: 'Thread state deleted' })
  async deleteThread(@Param('threadId') threadId: string) {
    await this.redisCheckpointer.deleteThread(threadId);
  }
}
