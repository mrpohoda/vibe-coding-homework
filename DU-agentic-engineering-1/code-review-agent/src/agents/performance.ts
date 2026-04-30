import { query } from "@anthropic-ai/claude-code";
import type { AgentResult, Finding, Severity } from "../types";

export async function runPerformanceAgent(targetPath: string): Promise<AgentResult> {
  const findings: Finding[] = [];
  let rawOutput = "";

  const prompt = `You are a performance code reviewer. Analyze all TypeScript/JavaScript files in "${targetPath}" for performance issues.

Look for:
1. N+1 query patterns (database calls inside loops)
2. Inefficient array operations: .find() or .filter() inside loops instead of using a Map/Set
3. Memory leaks: event listeners not removed, intervals not cleared, large objects held in closures
4. Synchronous blocking operations that should be async
5. Repeated expensive computations that could be cached/memoized
6. Unnecessary re-renders or large object copies

For each issue found, output a line in this exact format:
FINDING: <severity:low|high> | <file> | line <N> | <description>

After all findings, output:
SEVERITY: <none|low|high>

Use "high" for N+1 patterns or memory leaks in hot paths. Use "low" for minor inefficiencies. Use "none" if clean.`;

  const messages: string[] = [];

  for await (const message of query({
    prompt,
    options: {
      maxTurns: 15,
      allowedTools: ["Read", "Glob", "Grep"],
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(`[PERFORMANCE] ${block.text}\n`);
          messages.push(block.text);
          rawOutput += block.text + "\n";
        }
      }
    }
  }

  const fullOutput = messages.join("\n");

  for (const line of fullOutput.split("\n")) {
    const match = line.match(/^FINDING:\s*(low|high)\s*\|\s*(.+?)\s*\|\s*line\s*(\d+)\s*\|\s*(.+)$/i);
    if (match) {
      findings.push({
        category: "performance",
        severity: match[1] as Severity,
        file: match[2].trim(),
        line: parseInt(match[3], 10),
        description: match[4].trim(),
      });
    }
  }

  const severityMatch = fullOutput.match(/^SEVERITY:\s*(none|low|high)/im);
  const severity: Severity = (severityMatch?.[1] as Severity) ?? "none";

  return { agentName: "Performance", findings, severity, rawOutput };
}
