import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { HumanMessage } from '@langchain/core/messages';

import type { UserContext } from '../interfaces/user-context.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  /**
   * Stream the chat response as clean SSE events:
   *   { event: 'start',      data: { threadId } }
   *   { event: 'token',      data: { content: string } }  (repeats per chunk)
   *   { event: 'tool_start', data: { name: string } }
   *   { event: 'tool_end',   data: { name: string } }
   *   { event: 'done',       data: { fullResponse: string } }
   *   { event: 'error',      data: { message: string } }
   *
   * The `done` event includes the complete accumulated assistant response
   * so the caller (Spring Boot proxy) can persist it without buffering tokens.
   *
   * @param prompt      User message text
   * @param threadId    Required — conversation thread ID (typically the conversation UUID from Spring Boot)
   * @param userContext Authenticated user context forwarded by the API gateway
   */
  async *processChatSse(
    prompt: string,
    threadId: string,
    userContext: UserContext,
  ): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    this.logger.log(
      `[SSE] Chat for ${userContext.username} on thread ${threadId}`,
    );

    yield { event: 'start', data: { threadId } };

    try {
      const workflow = this.langGraphService.createAgentWorkflow(
        userContext.roles,
      );

      const initialState = {
        messages: [new HumanMessage(prompt)],
        userContext,
      };

      const config = { configurable: { thread_id: threadId } };

      const stream = workflow.streamEvents(initialState as never, {
        ...config,
        version: 'v2',
      });

      // Accumulate the full assistant response for the `done` event
      const responseChunks: string[] = [];

      for await (const event of stream) {
        // Stream LLM tokens to the client
        if (
          event.event === 'on_chat_model_stream' &&
          event.data?.chunk?.content
        ) {
          const content = event.data.chunk.content;
          if (typeof content === 'string' && content.length > 0) {
            responseChunks.push(content);
            yield { event: 'token', data: { content } };
          }
        }

        // Notify when a tool is invoked
        if (event.event === 'on_tool_start') {
          yield {
            event: 'tool_start',
            data: { name: event.name },
          };
        }

        // Notify when a tool finishes
        if (event.event === 'on_tool_end') {
          yield {
            event: 'tool_end',
            data: { name: event.name },
          };
        }
      }

      yield {
        event: 'done',
        data: { fullResponse: responseChunks.join('') },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SSE] Error on thread ${threadId}: ${message}`);
      yield { event: 'error', data: { message } };
    }
  }
}
