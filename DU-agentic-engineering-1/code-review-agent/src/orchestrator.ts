import { query } from "@anthropic-ai/claude-code";
import * as path from "path";
import { runSecurityAgent } from "./agents/security";
import { runStyleAgent } from "./agents/style";
import { runPerformanceAgent } from "./agents/performance";
import { runAutoFixAgent } from "./agents/autofix";
import { runReportAgent } from "./agents/report";
import type { AgentResult, SupervisorDecision, ReviewSummary } from "./types";

function printSeparator(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${label}`);
  console.log(`${line}\n`);
}

function printSummaryTable(results: AgentResult[]): void {
  printSeparator("ANALYSIS SUMMARY");
  console.log(
    "Agent".padEnd(16) +
    "Findings".padEnd(12) +
    "Severity"
  );
  console.log("─".repeat(40));
  for (const r of results) {
    console.log(
      r.agentName.padEnd(16) +
      String(r.findings.length).padEnd(12) +
      r.severity.toUpperCase()
    );
  }
  console.log();
}

async function runSupervisor(
  targetPath: string,
  agentResults: AgentResult[]
): Promise<SupervisorDecision> {
  const aggregated = agentResults
    .map((r) => {
      const findingLines = r.findings
        .map(
          (f) => `  - [${f.severity.toUpperCase()}] ${f.file ?? "?"} line ${f.line ?? "?"}: ${f.description}`
        )
        .join("\n");
      return `## ${r.agentName} Agent (severity: ${r.severity})\n${findingLines || "  No structured findings."}`;
    })
    .join("\n\n");

  const prompt = `You are the supervisor agent for an automated code review system.

You have received findings from 3 specialist agents that analyzed: ${targetPath}

${aggregated}

Your job: decide whether this code requires HUMAN review or can be AUTO-FIXED.

Rules:
- Output "high" if ANY finding has severity "high" OR if there are security vulnerabilities (hardcoded secrets, injection risks)
- Output "low" if ALL findings are severity "low" or "none" and there are no security issues
- Output "low" if there are zero findings total

You MUST respond with valid JSON only, no other text:
{"decision": "low" | "high", "reasoning": "<one paragraph explaining the decision>"}`;

  let rawOutput = "";
  const messages: string[] = [];

  for await (const message of query({
    prompt,
    options: {
      maxTurns: 5,
      allowedTools: [],
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(`[SUPERVISOR] ${block.text}\n`);
          messages.push(block.text);
          rawOutput += block.text;
        }
      }
    }
  }

  const fullOutput = messages.join("");

  const jsonMatch = fullOutput.match(/\{[\s\S]*"decision"[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[SUPERVISOR] Could not parse JSON decision, defaulting to high");
    return { decision: "high", reasoning: rawOutput || "Parse error — defaulting to human review." };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as SupervisorDecision;
    return parsed;
  } catch {
    return { decision: "high", reasoning: "JSON parse error — defaulting to human review." };
  }
}

async function main(): Promise<void> {
  const targetArg = process.argv[2];
  if (!targetArg) {
    console.error("Usage: npx ts-node src/orchestrator.ts <path-to-code>");
    process.exit(1);
  }

  const targetPath = path.resolve(targetArg);
  console.log(`\nCode Review Agent — Supervisor Pattern`);
  console.log(`Target: ${targetPath}\n`);

  // ── Phase 1: Run 3 analysis agents in parallel ──────────────────────────
  printSeparator("PHASE 1 — PARALLEL ANALYSIS");
  console.log("Running Security, Style, and Performance agents in parallel...\n");

  const [securityResult, styleResult, performanceResult] = await Promise.all([
    runSecurityAgent(targetPath),
    runStyleAgent(targetPath),
    runPerformanceAgent(targetPath),
  ]);

  const agentResults: AgentResult[] = [securityResult, styleResult, performanceResult];
  printSummaryTable(agentResults);

  // ── Phase 2: Supervisor decision ────────────────────────────────────────
  printSeparator("PHASE 2 — SUPERVISOR DECISION");

  const decision = await runSupervisor(targetPath, agentResults);
  console.log(`\nDecision: ${decision.decision.toUpperCase()}`);
  console.log(`Reasoning: ${decision.reasoning}\n`);

  // ── Phase 3: Conditional workflow ───────────────────────────────────────
  const allFindings = agentResults.flatMap((r) => r.findings);
  const summary: ReviewSummary = {
    targetPath,
    agentResults,
    supervisorDecision: decision,
  };

  if (decision.decision === "low") {
    printSeparator("PHASE 3 — AUTO-FIX (low severity path)");
    const { modifiedFiles, result } = await runAutoFixAgent(targetPath, allFindings);
    agentResults.push(result);
    summary.modifiedFiles = modifiedFiles;

    if (modifiedFiles.length > 0) {
      console.log("\nModified files:");
      for (const f of modifiedFiles) {
        console.log(`  ✓ ${f}`);
      }
    } else {
      console.log("\nNo files were modified by AutoFix.");
    }
  } else {
    printSeparator("PHASE 3 — REPORT GENERATION (high severity path)");
    const { outputPath, result } = await runReportAgent(
      targetPath,
      allFindings,
      decision.reasoning
    );
    agentResults.push(result);
    summary.outputPath = outputPath;
    console.log(`\nReport written to: ${outputPath}`);
  }

  // ── Final summary ────────────────────────────────────────────────────────
  printSeparator("REVIEW COMPLETE");
  console.log(`Target:    ${summary.targetPath}`);
  console.log(`Decision:  ${summary.supervisorDecision.decision.toUpperCase()}`);
  console.log(`Total findings: ${allFindings.length}`);
  if (summary.outputPath) {
    console.log(`Report:    ${summary.outputPath}`);
  }
  if (summary.modifiedFiles && summary.modifiedFiles.length > 0) {
    console.log(`Auto-fixed ${summary.modifiedFiles.length} file(s)`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
