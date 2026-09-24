/** 評価マニフェストの1本分の人手評価をCLIから更新する。 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { batchDirFromEnv } from "./lib/evaluation";

const args = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

if (args.includes("--help") || args.length === 0) {
  console.log(`使い方:
  pnpm --filter @shortfactory/video evaluation:review -- \\
    --id gift-01 \\
    --verdict postable_with_minor_edits \\
    --hook pass --factual-accuracy pass --character-consistency pass \\
    --caption-readability pass --audio-sync pass --cta pass \\
    --reading-errors 0 --edit-minutes 5 --notes "字幕1か所修正"

必須: --id, --verdict
verdict: postable_with_minor_edits | not_postable
grade: pass | revise | fail`);
  process.exit(0);
}

const id = value("--id");
const verdict = value("--verdict");
if (!id || !verdict || !["postable_with_minor_edits", "not_postable"].includes(verdict)) {
  throw new Error("--id と有効な --verdict が必要です");
}

const outputPath = path.join(batchDirFromEnv(), "evaluation-manifest.json");
if (!existsSync(outputPath)) throw new Error(`評価マニフェストがありません: ${outputPath}`);
const manifest = JSON.parse(await readFile(outputPath, "utf8")) as {
  items: Array<{ id: string; review: Record<string, unknown> }>;
};
const item = manifest.items.find((candidate) => candidate.id === id);
if (!item) throw new Error(`評価対象がありません: ${id}`);

const gradeFields: Record<string, string> = {
  hook: "hook",
  "factual-accuracy": "factualAccuracy",
  "character-consistency": "characterConsistency",
  "caption-readability": "captionReadability",
  "audio-sync": "audioSync",
  cta: "cta",
};
for (const field of Object.keys(gradeFields)) {
  const candidate = value(`--${field}`);
  if (candidate !== undefined && !["pass", "revise", "fail"].includes(candidate)) {
    throw new Error(`--${field} は pass / revise / fail のいずれかです`);
  }
  if (candidate !== undefined) item.review[gradeFields[field]!] = candidate;
}

const readingErrors = value("--reading-errors");
if (readingErrors !== undefined) {
  const parsed = Number(readingErrors);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("--reading-errors は0以上の整数です");
  item.review.readingErrors = parsed;
}
const editMinutes = value("--edit-minutes");
if (editMinutes !== undefined) {
  const parsed = Number(editMinutes);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("--edit-minutes は0以上の数値です");
  item.review.editMinutes = parsed;
}
const notes = value("--notes");
if (notes !== undefined) item.review.notes = notes;
item.review.verdict = verdict;

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`評価を保存しました: ${id} -> ${verdict}`);
console.log(`マニフェスト: ${outputPath}`);
