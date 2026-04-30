# DU-vibe-coding-2: MCP + Skill + Subagent Demo

Ukázkový TypeScript projekt demonstrující tři klíčové funkce Claude Code.

## Co projekt dělá

Analyzuje TypeScript soubory ve složce `src/` — pro každý soubor spustí subagenta, který ho přečte a jednou větou popíše co dělá. Výsledky vypíše jako markdown tabulku.

## Architektura

```
src/index.ts          — hlavní skript
.claude/
  settings.json       — konfigurace MCP serveru + permissions
  commands/
    shrnout.md        — vlastní skill /shrnout
```

## Tři použité funkce

### 1. MCP Server (`filesystem`)

Nakonfigurován v `.claude/settings.json`. Zpřístupňuje složku `src/` přes MCP filesystem server — Claude Code může číst soubory přímo přes MCP nástroje (bez Bash).

Spouštění: `npx @modelcontextprotocol/server-filesystem`

### 2. Skill (`/shrnout`)

Vlastní slash command v `.claude/commands/shrnout.md`. Spustíš ho v Claude Code jako:

```
/shrnout
```

Skill použije MCP filesystem server k přečtení všech `.ts` souborů a vypíše přehlednou tabulku.

### 3. Subagent (`query`)

`src/index.ts` používá `query()` z `@anthropic-ai/claude-code` SDK k vytvoření subagenta pro každý soubor. Subagenti běží paralelně (`Promise.all`).

## Spuštění

```bash
npm install
npm start
```

## Závislosti

- `@anthropic-ai/claude-code` — SDK pro subagenty (`query`)
- `@modelcontextprotocol/server-filesystem` — MCP server (spouští se přes `npx`)
- `tsx` — spouštění TypeScript bez build kroku
