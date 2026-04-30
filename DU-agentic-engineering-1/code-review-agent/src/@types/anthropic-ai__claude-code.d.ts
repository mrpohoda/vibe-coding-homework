/**
 * Type declarations for @anthropic-ai/claude-code SDK.
 *
 * The `query` function is available as a runtime injection when this code
 * runs inside a Claude Code agent context (skill, subagent, or SDK call).
 * These declarations let TypeScript compile the project; the actual implementation
 * is provided by the Claude Code runtime environment.
 */
declare module "@anthropic-ai/claude-code" {
  export type MessageRole = "user" | "assistant";

  export interface TextBlock {
    type: "text";
    text: string;
  }

  export interface ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
  }

  export interface ToolResultBlock {
    type: "tool_result";
    tool_use_id: string;
    content: string | Array<{ type: "text"; text: string }>;
    is_error?: boolean;
  }

  export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

  export interface AssistantMessage {
    type: "assistant";
    message: {
      id: string;
      type: "message";
      role: "assistant";
      content: ContentBlock[];
      model: string;
      stop_reason: string | null;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    };
  }

  export interface UserMessage {
    type: "user";
    message: {
      role: "user";
      content: ContentBlock[];
    };
  }

  export interface ResultMessage {
    type: "result";
    subtype: "success" | "error_max_turns" | "error_during_execution";
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    result?: string;
    session_id: string;
    total_cost_usd?: number;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  }

  export interface SystemMessage {
    type: "system";
    subtype: string;
    session_id: string;
  }

  export type SDKMessage =
    | AssistantMessage
    | UserMessage
    | ResultMessage
    | SystemMessage;

  export interface QueryOptions {
    maxTurns?: number;
    allowedTools?: string[];
    systemPrompt?: string;
    model?: string;
    cwd?: string;
  }

  export interface QueryInput {
    prompt: string;
    options?: QueryOptions;
  }

  /**
   * Run a Claude Code agent with the given prompt.
   * Returns an async iterable of SDK messages streamed from the agent.
   */
  export function query(input: QueryInput): AsyncIterable<SDKMessage>;
}
