import { query } from "@anthropic-ai/claude-code";
import * as path from "path";
import type { AgentResult, Finding } from "../types";

export async function runReportAgent(
  targetPath: string,
  allFindings: Finding[],
  supervisorReasoning: string
): Promise<{ outputPath: string; result: AgentResult }> {
  let rawOutput = "";

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = path.join(targetPath, `review-report-${timestamp}.md`);

  const findingsByCategory = {
    security: allFindings.filter((f) => f.category === "security"),
    style: allFindings.filter((f) => f.category === "style"),
    performance: allFindings.filter((f) => f.category === "performance"),
  };

  const formatFindings = (findings: Finding[]) =>
    findings.length === 0
      ? "No issues found."
      : findings
          .map(
            (f) =>
              `- **[${f.severity.toUpperCase()}]** \`${f.file ?? "unknown"}\` line ${f.line ?? "?"}: ${f.description}`
          )
          .join("\n");

  const prompt = `You are a code review report writer. Generate a detailed, professional markdown report for the code review results.

Write the report to the file: ${outputPath}

The report should contain:

# Code Review Report

**Generated:** ${new Date().toISOString()}
**Target:** ${targetPath}
**Overall Severity:** HIGH — requires human review

## Executive Summary
<2-3 sentence summary of overall code quality and main concerns>

## Supervisor Assessment
${supervisorReasoning}

## Security Findings
${formatFindings(findingsByCategory.security)}

## Style Findings
${formatFindings(findingsByCategory.style)}

## Performance Findings
${formatFindings(findingsByCategory.performance)}

## Recommended Actions
<numbered list of prioritized actions the developer should take, most critical first>

## Risk Summary
| Category | Count | Highest Severity |
|----------|-------|-----------------|
| Security | ${findingsByCategory.security.length} | ${findingsByCategory.security.find((f) => f.severity === "high") ? "HIGH" : findingsByCategory.security.length > 0 ? "LOW" : "NONE"} |
| Style    | ${findingsByCategory.style.length} | ${findingsByCategory.style.find((f) => f.severity === "high") ? "HIGH" : findingsByCategory.style.length > 0 ? "LOW" : "NONE"} |
| Performance | ${findingsByCategory.performance.length} | ${findingsByCategory.performance.find((f) => f.severity === "high") ? "HIGH" : findingsByCategory.performance.length > 0 ? "LOW" : "NONE"} |

Write this report to ${outputPath} now. Fill in the Executive Summary and Recommended Actions sections with meaningful content based on the findings above.`;

  const messages: string[] = [];

  for await (const message of query({
    prompt,
    options: {
      maxTurns: 8,
      allowedTools: ["Write"],
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(`[REPORT] ${block.text}\n`);
          messages.push(block.text);
          rawOutput += block.text + "\n";
        }
      }
    }
  }

  const result: AgentResult = {
    agentName: "Report",
    findings: [],
    severity: "none",
    rawOutput,
  };

  return { outputPath, result };
}
