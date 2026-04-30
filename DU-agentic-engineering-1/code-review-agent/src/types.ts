export type Severity = "none" | "low" | "high";

export type FindingCategory =
  | "security"
  | "style"
  | "performance";

export interface Finding {
  category: FindingCategory;
  description: string;
  file?: string;
  line?: number;
  severity: Severity;
}

export interface AgentResult {
  agentName: string;
  findings: Finding[];
  severity: Severity;
  rawOutput: string;
}

export interface SupervisorDecision {
  decision: "low" | "high";
  reasoning: string;
}

export interface ReviewSummary {
  targetPath: string;
  agentResults: AgentResult[];
  supervisorDecision: SupervisorDecision;
  outputPath?: string;
  modifiedFiles?: string[];
}
