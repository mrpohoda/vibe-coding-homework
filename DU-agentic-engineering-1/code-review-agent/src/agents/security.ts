import { query } from "@anthropic-ai/claude-code";
import type { AgentResult, Finding, Severity } from "../types";

export async function runSecurityAgent(targetPath: string): Promise<AgentResult> {
  const findings: Finding[] = [];
  let rawOutput = "";

  const prompt = `You are a security code reviewer. Analyze all TypeScript/JavaScript files in "${targetPath}" for security vulnerabilities.

Look for:
1. Hardcoded secrets, API keys, passwords, tokens
2. SQL injection, command injection, XSS vulnerabilities
3. Insecure use of eval() or Function()
4. Missing input validation or sanitization
5. Exposed sensitive data in logs or error messages

For each issue found, output a line in this exact format:
FINDING: <severity:low|high> | <file> | line <N> | <description>

After all findings, output:
SEVERITY: <none|low|high>

Use "high" severity if you find hardcoded secrets or injection vulnerabilities. Use "low" for minor issues. Use "none" if clean.`;

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
          process.stdout.write(`[SECURITY] ${block.text}\n`);
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
        category: "security",
        severity: match[1] as Severity,
        file: match[2].trim(),
        line: parseInt(match[3], 10),
        description: match[4].trim(),
      });
    }
  }

  const severityMatch = fullOutput.match(/^SEVERITY:\s*(none|low|high)/im);
  const severity: Severity = (severityMatch?.[1] as Severity) ?? "none";

  return { agentName: "Security", findings, severity, rawOutput };
}
