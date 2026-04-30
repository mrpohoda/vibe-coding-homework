import { query } from "@anthropic-ai/claude-code";
import { readdir } from "fs/promises";
import { join } from "path";

const SRC_DIR = new URL(".", import.meta.url).pathname;

async function getTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => join(dir, e.name));
}

// Subagent: analyzuje jeden soubor a vrátí shrnutí
async function analyzujeSoubor(filePath: string): Promise<string> {
  let result = "";

  for await (const message of query({
    prompt: `Přečti soubor "${filePath}" pomocí nástroje Read a vrať jednu větu popisující co tento soubor dělá. Odpověz pouze touto větou, bez dalšího textu.`,
    options: { maxTurns: 3 },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      result = message.result.trim();
    }
  }

  return result || "(bez popisu)";
}

async function main() {
  const files = await getTypeScriptFiles(SRC_DIR);

  console.log("Analyzuji projekt pomocí subagentů...\n");

  // Spustí subagenta pro každý soubor paralelně
  const analyzy = await Promise.all(
    files.map(async (file) => {
      const nazev = file.split("/").pop()!;
      const popis = await analyzujeSoubor(file);
      return { nazev, popis };
    })
  );

  console.log("## Výsledek analýzy\n");
  console.log("| Soubor | Popis |");
  console.log("|--------|-------|");
  for (const { nazev, popis } of analyzy) {
    console.log(`| ${nazev} | ${popis} |`);
  }
  console.log(`\nCelkem souborů: ${files.length}`);
}

main().catch(console.error);
