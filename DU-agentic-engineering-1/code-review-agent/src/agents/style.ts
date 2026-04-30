import { query } from "@anthropic-ai/claude-code";
import type { AgentResult, Finding, Severity } from "../types";

export async function runStyleAgent(targetPath: string): Promise<AgentResult> {
  const findings: Finding[] = [];
  let rawOutput = "";

  const prompt = `You are a code style reviewer. Analyze all TypeScript/JavaScript files in "${targetPath}" for style issues.

Look for:
1. Unused imports or variables
2. Poor variable/function names (single letters like x, y, i outside loops; generic names like data, temp)
3. Inconsistent formatting (mixed tabs/spaces, trailing whitespace)
4. Missing or inconsistent semicolons
5. Functions that are too long (>50 lines) or deeply nested (>4 levels)
6. Magic numbers not assigned to named constants

For each issue found, output a line in this exact format:
FINDING: <severity:low|high> | <file> | line <N> | <description>

After all findings, output:
SEVERITY: <none|low|high>

Use "high" for systemic naming or structural issues. Use "low" for minor formatting. Use "none" if clean.`;

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
          process.stdout.write(`[STYLE] ${block.text}\n`);
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
        category: "style",
        severity: match[1] as Severity,
        file: match[2].trim(),
        line: parseInt(match[3], 10),
        description: match[4].trim(),
      });
    }
  }

  const severityMatch = fullOutput.match(/^SEVERITY:\s*(none|low|high)/im);
  const severity: Severity = (severityMatch?.[1] as Severity) ?? "none";

  return { agentName: "Style", findings, severity, rawOutput };
}
