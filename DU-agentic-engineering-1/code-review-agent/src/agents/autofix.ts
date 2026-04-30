import { query } from "@anthropic-ai/claude-code";
import type { AgentResult, Finding } from "../types";

export async function runAutoFixAgent(
  targetPath: string,
  allFindings: Finding[]
): Promise<{ modifiedFiles: string[]; result: AgentResult }> {
  const modifiedFiles: string[] = [];
  let rawOutput = "";

  const findingsSummary = allFindings
    .filter((f) => f.severity === "low")
    .map((f) => `- [${f.category.toUpperCase()}] ${f.file ?? "unknown"} line ${f.line ?? "?"}: ${f.description}`)
    .join("\n");

  const prompt = `You are an automated code fixer. Apply safe, low-risk fixes to the files in "${targetPath}".

The following LOW severity issues were found by the analysis agents:
${findingsSummary}

Your task:
1. Read each affected file
2. Apply ONLY safe, non-breaking fixes such as:
   - Removing unused imports
   - Renaming single-letter variables to descriptive names (be careful to rename all usages)
   - Fixing formatting issues (trailing whitespace, consistent semicolons)
   - Extracting magic numbers into named constants
3. Do NOT touch security or performance issues — those require human review even if marked low
4. After each file you modify, output: MODIFIED: <filepath>
5. If a fix seems risky, skip it and output: SKIPPED: <filepath> | <reason>

Be conservative. When in doubt, do not modify.`;

  const messages: string[] = [];

  for await (const message of query({
    prompt,
    options: {
      maxTurns: 20,
      allowedTools: ["Read", "Write", "Edit"],
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(`[AUTOFIX] ${block.text}\n`);
          messages.push(block.text);
          rawOutput += block.text + "\n";
        }
      }
    }
  }

  const fullOutput = messages.join("\n");

  for (const line of fullOutput.split("\n")) {
    const match = line.match(/^MODIFIED:\s*(.+)$/i);
    if (match) {
      modifiedFiles.push(match[1].trim());
    }
  }

  const result: AgentResult = {
    agentName: "AutoFix",
    findings: [],
    severity: "none",
    rawOutput,
  };

  return { modifiedFiles, result };
}
