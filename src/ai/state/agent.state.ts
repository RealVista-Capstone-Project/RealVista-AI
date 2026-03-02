import { BaseMessage } from '@langchain/core/messages';

/**
 * Define the State of the LangGraph AI Workflow.
 * This represents the memory, history, and current context across nodes.
 */
export interface AgentState {
  // Chat History
  messages: BaseMessage[];

  // User Context Injected from JWT
  userContext: {
    sub: string;
    username: string;
    roles: string[];
  };

  // Additional Real Estate Context extracted during reasoning
  extractedEntities?: {
    location?: string;
    priceRange?: string;
    propertyType?: string;
  };

  // Step indicator
  currentStep?: string;
}
