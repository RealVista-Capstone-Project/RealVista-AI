import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { HumanMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
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
   *   { event: 'done',       data: { threadId } }
   *   { event: 'error',      data: { message: string } }
   */
  async *processChatSse(
    prompt: string,
    threadId: string | undefined,
    userContext: UserContext,
  ): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    const resolvedThreadId = threadId ?? uuidv4();

    this.logger.log(
      `[SSE] Chat for ${userContext.username} on thread ${resolvedThreadId}`,
    );

    yield { event: 'start', data: { threadId: resolvedThreadId } };

    try {
      const workflow = this.langGraphService.createAgentWorkflow(
        userContext.roles,
      );

      const initialState = {
        messages: [new HumanMessage(prompt)],
        userContext,
      };

      const config = { configurable: { thread_id: resolvedThreadId } };

      const stream = workflow.streamEvents(initialState as never, {
        ...config,
        version: 'v2',
      });

      for await (const event of stream) {
        // Stream LLM tokens to the client
        if (
          event.event === 'on_chat_model_stream' &&
          event.data?.chunk?.content
        ) {
          const content = event.data.chunk.content;
          if (typeof content === 'string' && content.length > 0) {
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

      yield { event: 'done', data: { threadId: resolvedThreadId } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[SSE] Error on thread ${resolvedThreadId}: ${message}`,
      );
      yield { event: 'error', data: { message } };
    }
  }

  /**
   * @deprecated Use processChatSse instead.
   * Kept for backward compat with /ai/stream endpoint.
   */
  processStream(prompt: string, threadId: string, userContext: UserContext) {
    this.logger.log(
      `Processing SSE Stream query for ${userContext.username} on thread ${threadId}`,
    );

    const workflow = this.langGraphService.createAgentWorkflow(
      userContext.roles,
    );
    const config = { configurable: { thread_id: threadId } };

    const initialState = {
      messages: [new HumanMessage(prompt)],
      userContext: userContext,
    };

    return workflow.streamEvents(initialState as never, {
      ...config,
      version: 'v2',
    });
  }
}
