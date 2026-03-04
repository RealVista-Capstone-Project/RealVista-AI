/**
 * Represents a streaming event emitted by LangGraph's streamEvents API.
 * Used to type the SSE stream in AiController.
 */
export interface LangGraphStreamEvent {
  /** Event type, e.g. 'on_chat_model_stream', 'on_tool_start', 'on_tool_end' */
  event: string;

  /** Name of the tool or model (present on tool events) */
  name?: string;

  /** Event-specific payload data */
  data?: {
    chunk?: {
      content?: string;
    };
  };
}
