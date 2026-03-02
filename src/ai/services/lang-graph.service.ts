import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  SystemMessage,
  HumanMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { ToolsService } from './tools.service';
import { AgentState } from '../state/agent.state';

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);
  private llm: ChatOpenAI;
  private readonly checkpointer = new MemorySaver(); // In-memory checkpointer for MVP streams

  // Define our channels for state management based on our AgentState interface
  private readonly stateChannels = {
    messages: {
      value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
    userContext: {
      value: (x: any, y: any) => ({ ...x, ...y }),
      default: () => ({ sub: '', username: '', roles: [] }),
    },
    extractedEntities: {
      value: (x: any, y: any) => ({ ...x, ...y }),
      default: () => ({}),
    },
    currentStep: {
      value: (x: string, y: string) => y,
      default: () => 'init',
    },
  };

  constructor(
    private configService: ConfigService,
    private toolsService: ToolsService,
  ) {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  /**
   * Constructs the Real Estate AI Agent workflow using LangGraph
   */
  createAgentWorkflow(userRoles: string[]) {
    // 1. Get the permitted tools
    const tools = this.toolsService.getAvailableTools(userRoles);

    // Bind tools to the LLM
    const llmWithTools = this.llm.bindTools(tools);

    // 2. Define the generic Reasoner node
    const reasonerNode = async (state: AgentState) => {
      this.logger.debug(
        `[Reasoner Node] Iteration for user: ${state.userContext.username}`,
      );

      const systemMsg = new SystemMessage(`
        You are a highly intelligent real estate assistant specializing in natural language searches, 
        market insights, and answering property FAQs. You are speaking to ${state.userContext.username}.
        Always rely on your backend tools to search the database, get comparable properties, or predict prices.
        If the user asks an FAQ or about general market insights not requiring a DB query, answer using RAG knowledge.
        DO NOT invent prices or properties. Only report what tools return. 
      `);

      const messages = [systemMsg, ...state.messages];
      const response = await llmWithTools.invoke(messages);

      return { messages: [response], currentStep: 'reasoning' };
    };

    // 3. Define the simplified RAG node (Knowledge Retrieval)
    // For MVP, we mock the vector DB retrieval process.
    const ragNode = async (state: AgentState) => {
      this.logger.debug(`[RAG Node] Retrieving market insights...`);
      // TODO: Connect to Pinecone/Qdrant here for vector search
      const ragKnowledge = new SystemMessage(
        '[RAG Knowledge]: Da Nang market is currently bullish for Coastal Villas in 2026. ROI is estimated at 8-12% annually.',
      );
      return { messages: [ragKnowledge], currentStep: 'rag_completed' };
    };

    // 4. Create the Tool Execution Node
    const toolNode = new ToolNode(tools);

    // 5. Build the Graph
    const workflow = new StateGraph<any>({
      channels: this.stateChannels as any,
    })
      // Add nodes
      .addNode('rag', ragNode)
      .addNode('reasoner', reasonerNode)
      .addNode('tools', toolNode)

      // Add edges & routing
      // Start by fetching context using RAG
      .addEdge(START, 'rag')
      .addEdge('rag', 'reasoner')

      // Conditional Routing: Let the LLM decide if it needs to call tools or finish
      .addConditionalEdges(
        'reasoner',
        (state: any) => {
          const lastMessage = state.messages[state.messages.length - 1];
          // If the model decides to call a tool, route to 'tools'
          if (
            lastMessage &&
            'tool_calls' in lastMessage &&
            lastMessage.tool_calls?.length > 0
          ) {
            this.logger.debug('Routing to Tools Node');
            return 'tools';
          }
          this.logger.debug('Routing to END');
          return END;
        },
        ['tools', END],
      )
      // After tools finish, loop back to reasoner to interpret tool results
      .addEdge('tools', 'reasoner');

    // Compile into runnable state
    return workflow.compile({ checkpointer: this.checkpointer });
  }
}
