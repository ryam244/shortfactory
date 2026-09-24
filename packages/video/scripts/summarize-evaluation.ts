/** 技術検証と人手評価を分離してPhase 0aの合格状態を集計する。 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const batchDir = path.resolve(here, "../out", process.env.SHORTFACTORY_OUTPUT_DIR ?? "fixture-batch");
const manifest = JSON.parse(await readFile(path.join(batchDir, "evaluation-manifest.json"), "utf8")) as {
  items: Array<{ id: string; topic: string; review: { verdict: string; readingErrors: number | null; editMinutes: number | null } }>;
};
const technical = JSON.parse(await readFile(path.join(batchDir, "technical-evaluation.json"), "utf8")) as {
  items: Array<{ id: string; pass: boolean }>;
};

const technicalPass = technical.items.filter((item) => item.pass).length;
const humanCompleted = manifest.items.filter((item) => item.review.verdict !== "pending");
const postable = manifest.items.filter((item) => item.review.verdict === "postable_with_minor_edits");
const pending = manifest.items.length - humanCompleted.length;
const passed = postable.length >= 4;

console.log(`技術検証: ${technicalPass}/${technical.items.length}`);
console.log(`人手評価済み: ${humanCompleted.length}/${manifest.items.length}`);
console.log(`軽微な修正で投稿可能: ${postable.length}/${manifest.items.length}`);
console.log(`Phase 0a: ${passed ? "合格" : pending > 0 ? "判定待ち" : "未合格"}`);

if (!passed) {
  console.log("合格条件: 技術検証と、人手評価で4/5本以上の postable_with_minor_edits");
}
