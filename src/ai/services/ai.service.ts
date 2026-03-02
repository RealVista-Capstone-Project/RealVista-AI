import { Injectable, Logger } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { HumanMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly langGraphService: LangGraphService) {}

  /**
   * Synchronously process a prompt and return the final reasoned response
   */
  async processSync(prompt: string, userContext: any) {
    this.logger.log(`Processing sync query for ${userContext.username}`);

    // Compile workflow tailored for this user's roles
    const workflow = this.langGraphService.createAgentWorkflow(
      userRoles(userContext),
    );

    // A unique thread ID is required for MemorySaver to maintain session history
    const threadId = uuidv4();

    const initialState = {
      messages: [new HumanMessage(prompt)],
      userContext: userContext,
    };

    const config = { configurable: { thread_id: threadId } };

    // Invoke the graph
    const finalState = await workflow.invoke(initialState, config);

    const lastMessage = finalState.messages[finalState.messages.length - 1];
    return {
      threadId,
      response: lastMessage.content,
    };
  }

  /**
   * Asynchronously stream the reasoning process and tokens back to the client
   */
  async processStream(prompt: string, threadId: string, userContext: any) {
    this.logger.log(
      `Processing SSE Stream query for ${userContext.username} on thread ${threadId}`,
    );

    const workflow = this.langGraphService.createAgentWorkflow(
      userRoles(userContext),
    );
    const config = { configurable: { thread_id: threadId } };

    const initialState = {
      messages: [new HumanMessage(prompt)],
      userContext: userContext,
    };

    // Use streamEvents for detailed SSE streaming of LangGraph's lifecycle
    return workflow.streamEvents(initialState, { ...config, version: 'v2' });
  }
}

// Utility
function userRoles(ctx: any): string[] {
  return ctx?.roles || [];
}
