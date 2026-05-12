/**
 * Tenta listar os modelos disponíveis na sua key Gemini.
 * Útil para descobrir os IDs exatos (ex.: "gemini-2.5-flash-preview-tts" vs "gemini-2.5-flash-tts").
 *
 *   npx tsx scripts/probe-models.ts
 */

import "dotenv/config";

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error(`HTTP ${r.status}: ${await r.text()}`);
    process.exit(1);
  }
  const data = (await r.json()) as {
    models: Array<{
      name: string;
      supportedGenerationMethods?: string[];
      displayName?: string;
    }>;
  };

  const interesting = data.models
    .map((m) => ({
      id: m.name.replace(/^models\//, ""),
      display: m.displayName,
      methods: (m.supportedGenerationMethods ?? []).join(","),
    }))
    .filter((m) => /flash|tts|image|imagen/i.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`Modelos relevantes (${interesting.length}):\n`);
  for (const m of interesting) {
    console.log(`  ${m.id.padEnd(45)} ${m.display ?? ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
