# Code Review Agent

An automated code review system built with the [Claude Code SDK](https://www.npmjs.com/package/@anthropic-ai/claude-code) that demonstrates the **Supervisor multi-agent pattern** with a **Conditional workflow**.

## Architecture

```
orchestrator.ts  (Supervisor Agent)
│
├── Phase 1: Parallel Analysis (Promise.all)
│   ├── [SECURITY]     security.ts    — finds vulnerabilities, hardcoded secrets, injection risks
│   ├── [STYLE]        style.ts       — finds naming, formatting, unused code issues
│   └── [PERFORMANCE]  performance.ts — finds N+1 queries, memory leaks, inefficient loops
│
└── Phase 2: Supervisor Decision (another query() call)
    │   Reads aggregated findings → outputs JSON { decision, reasoning }
    │
    ├── decision = "low"  → [AUTOFIX]  autofix.ts  — applies safe, non-breaking fixes
    └── decision = "high" → [REPORT]   report.ts   — writes markdown report for humans
```

### Multi-agent pattern: Supervisor

The orchestrator is itself an AI agent — it calls `query()` to read all findings and output a JSON decision. This is not a simple `if/else`; the supervisor uses reasoning to weigh the severity of findings across all three dimensions.

### Conditional workflow

After the supervisor decides, exactly one of two paths executes:
- **Low severity** → AutoFix agent safely rewrites files (has `Write`/`Edit` access)
- **High severity** → Report agent produces a human-readable markdown file

## Agents

| Agent | Tools | maxTurns | Description |
|-------|-------|----------|-------------|
| Security | `Read`, `Glob`, `Grep` | 15 | Finds hardcoded secrets, XSS, SQL injection |
| Style | `Read`, `Glob`, `Grep` | 15 | Finds naming issues, unused imports, formatting |
| Performance | `Read`, `Glob`, `Grep` | 15 | Finds N+1 patterns, memory leaks, O(n²) loops |
| Supervisor | _(none)_ | 5 | Aggregates findings → outputs `{ decision, reasoning }` |
| AutoFix | `Read`, `Write`, `Edit` | 20 | Applies safe low-severity fixes |
| Report | `Write` | 8 | Generates detailed markdown report |

## Setup

```bash
npm install
```

## Usage

```bash
npx ts-node src/orchestrator.ts ./sample-code
```

Or point it at any directory with TypeScript/JavaScript files:

```bash
npx ts-node src/orchestrator.ts /path/to/your/project/src
```

## Sample Code

`sample-code/vulnerable.ts` contains intentional issues:

- **Hardcoded API key** — `sk-prod-...` assigned to a constant (security, high)
- **XSS vulnerability** — unsanitized user input injected into HTML string (security, high)
- **SQL injection** — userId concatenated directly into a query string (security, high)
- **Unused import** — `axios` imported but never used (style, low)
- **Single-letter variables** — `x`, `y`, `z` in `calculate()` (style, low)
- **Inefficient array search in loop** — `.find()` inside a `for` loop O(n²) (performance, high)
- **N+1 pattern** — individual DB fetch inside a loop (performance, high)
- **Memory leak** — `setInterval` started but never cleared (performance, high)
- **Magic numbers** — discount tiers `0.95`, `0.85`, `0.70` without named constants (style, low)

Because the sample file contains high-severity issues, the supervisor will route to the **Report** path.

## Output

```
Code Review Agent — Supervisor Pattern
Target: /path/to/sample-code

────────────────────────────────────────────────────────────
  PHASE 1 — PARALLEL ANALYSIS
────────────────────────────────────────────────────────────

[SECURITY] ...
[STYLE] ...
[PERFORMANCE] ...

Agent           Findings    Severity
────────────────────────────────────────
Security        3           HIGH
Style           4           LOW
Performance     3           HIGH

────────────────────────────────────────────────────────────
  PHASE 2 — SUPERVISOR DECISION
────────────────────────────────────────────────────────────

[SUPERVISOR] {"decision": "high", "reasoning": "..."}

Decision: HIGH

────────────────────────────────────────────────────────────
  PHASE 3 — REPORT GENERATION (high severity path)
────────────────────────────────────────────────────────────

[REPORT] Writing report...
Report written to: ./sample-code/review-report-2026-04-30T12-00-00.md
```

## Type Safety

All agent results are typed via `src/types.ts`:

```ts
interface AgentResult {
  agentName: string;
  findings: Finding[];
  severity: "none" | "low" | "high";
  rawOutput: string;
}
```

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` environment variable set
