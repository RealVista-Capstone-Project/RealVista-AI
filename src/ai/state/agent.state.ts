import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import type { UserContext } from '../interfaces/user-context.interface.js';

export interface ExtractedEntities {
  location?: string;
  priceRange?: string;
  propertyType?: string;
}

/**
 * Define the State of the LangGraph AI Workflow.
 * This represents the memory, history, and current context across nodes.
 */
export interface AgentState {
  // Chat History
  messages: BaseMessage[];

  // User Context Injected from JWT
  userContext: UserContext;

  // Additional Real Estate Context extracted during reasoning
  extractedEntities?: ExtractedEntities;

  // Step indicator
  currentStep?: string;
}

export const AgentAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),
  userContext: Annotation<UserContext>({
    reducer: (x: UserContext, y: Partial<UserContext>) => ({ ...x, ...y }),
    default: (): UserContext => ({ sub: '', username: '', roles: [] }),
  }),
  extractedEntities: Annotation<ExtractedEntities>({
    reducer: (x: ExtractedEntities, y: Partial<ExtractedEntities>) => ({
      ...x,
      ...y,
    }),
    default: (): ExtractedEntities => ({}),
  }),
  currentStep: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => 'init',
  }),
});
