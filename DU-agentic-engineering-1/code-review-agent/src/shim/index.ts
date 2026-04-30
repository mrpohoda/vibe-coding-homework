/**
 * Runtime shim for @anthropic-ai/claude-code.
 *
 * When this project runs as a Claude Code subagent (the intended production use),
 * the `query` function is injected by the Claude Code runtime.
 * For standalone development (npx ts-node), this shim provides the same interface
 * by spawning the `claude` CLI binary with --print --output-format stream-json.
 */
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export type Severity = "none" | "low" | "high";

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
    usage: { input_tokens: number; output_tokens: number };
  };
}

export interface UserMessage {
  type: "user";
  message: { role: "user"; content: ContentBlock[] };
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

function findClaudeBinary(): string {
  const candidates = [
    path.join(__dirname, "../../node_modules/@anthropic-ai/claude-code/bin/claude.exe"),
    path.join(__dirname, "../../node_modules/.bin/claude"),
    "claude",
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch { /* keep looking */ }
  }
  return "claude";
}

export async function* query(input: QueryInput): AsyncIterable<SDKMessage> {
  const claudeBin = findClaudeBinary();
  const opts = input.options ?? {};

  const args: string[] = [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
  ];

  if (opts.allowedTools && opts.allowedTools.length > 0) {
    args.push("--allowed-tools", opts.allowedTools.join(","));
  }

  if (opts.model) {
    args.push("--model", opts.model);
  }

  const cwd = opts.cwd ?? process.cwd();

  const proc = spawn(claudeBin, args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  // Write prompt to stdin and close it
  proc.stdin.write(input.prompt);
  proc.stdin.end();

  let buffer = "";
  const messageQueue: SDKMessage[] = [];
  let resolveNext: ((value: IteratorResult<SDKMessage>) => void) | null = null;
  let done = false;
  let error: Error | null = null;

  function enqueue(msg: SDKMessage): void {
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ value: msg, done: false });
    } else {
      messageQueue.push(msg);
    }
  }

  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as SDKMessage;
        enqueue(msg);
      } catch {
        // Non-JSON line (e.g. debug output) — skip
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    // Suppress stderr unless debugging
    if (process.env.DEBUG_SHIM) process.stderr.write(chunk);
  });

  proc.on("error", (err) => {
    error = err;
    if (resolveNext) {
      resolveNext({ value: undefined as unknown as SDKMessage, done: true });
    }
  });

  proc.on("close", () => {
    // Flush remaining buffer
    if (buffer.trim()) {
      try {
        const msg = JSON.parse(buffer.trim()) as SDKMessage;
        enqueue(msg);
      } catch { /* ignore */ }
    }
    done = true;
    if (resolveNext) {
      resolveNext({ value: undefined as unknown as SDKMessage, done: true });
    }
  });

  while (true) {
    if (messageQueue.length > 0) {
      yield messageQueue.shift()!;
    } else if (done) {
      if (error) throw error;
      return;
    } else {
      const msg = await new Promise<IteratorResult<SDKMessage>>((resolve) => {
        resolveNext = resolve;
      });
      if (msg.done) {
        if (error) throw error;
        return;
      }
      yield msg.value;
    }
  }
}
