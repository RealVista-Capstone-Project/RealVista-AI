import {
  Controller,
  Post,
  Get,
  Body,
  Sse,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AiService } from './services/ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { User } from '../decorators/user/user.decorator';
import { ChatQueryDto } from './dto/chat-query.dto';

@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/chat')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({ summary: 'Synchronously process an AI reasoning query.' })
  @Post('sync')
  async processSync(@Body() chatQueryDto: ChatQueryDto, @User() user: any) {
    return this.aiService.processSync(chatQueryDto.prompt, user);
  }

  @ApiOperation({ summary: 'Stream reasoning via Server-Sent Events.' })
  @Get('stream')
  @Sse()
  processStream(
    @Query('prompt') prompt: string,
    @Query('threadId') threadId: string,
    @User() user: any,
  ): Observable<MessageEvent> {
    // We wrap LangGraph's async generator into an RxJS Observable for NestJS SSE
    return new Observable((subscriber) => {
      (async () => {
        try {
          const tId = threadId || Date.now().toString(); // Fallback ID for MVP
          const stream = await this.aiService.processStream(prompt, tId, user);

          for await (const event of stream) {
            // Depending on the event type from LangGraph, we can filter what we send to the client
            const eventType = event.event;

            // Forward relevant tokens or tool calls
            if (eventType === 'on_chat_model_stream') {
              const chunk = event.data?.chunk?.content;
              if (chunk) {
                subscriber.next({
                  data: JSON.stringify({ type: 'token', content: chunk }),
                } as MessageEvent);
              }
            } else if (eventType === 'on_tool_start') {
              subscriber.next({
                data: JSON.stringify({
                  type: 'tool',
                  content: `Starting tool ${event.name}...`,
                }),
              } as MessageEvent);
            }
          }
          subscriber.next({
            data: JSON.stringify({ type: 'done' }),
          } as MessageEvent);
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
