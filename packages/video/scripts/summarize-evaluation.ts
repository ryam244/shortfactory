/** 技術検証と人手評価を分離してPhase 0aの合格状態を集計する。 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { batchDirFromEnv } from "./lib/evaluation";

const batchDir = batchDirFromEnv();
const manifest = JSON.parse(await readFile(path.join(batchDir, "evaluation-manifest.json"), "utf8")) as {
  items: Array<{
    id: string;
    topic: string;
    qualityEvaluable?: boolean;
    review: { verdict: string; readingErrors: number | null; editMinutes: number | null };
  }>;
};
const technical = JSON.parse(await readFile(path.join(batchDir, "technical-evaluation.json"), "utf8")) as {
  items: Array<{ id: string; pass: boolean }>;
};

const REQUIRED_POSTABLE = 4;
const total = manifest.items.length;
const technicalPass = technical.items.filter((item) => item.pass).length;
const technicalAllPass = technical.items.length === total && technicalPass === total;
// qualityEvaluable がない古いマニフェストは判定対象外として扱う
const evaluable = manifest.items.filter((item) => item.qualityEvaluable === true);
const humanCompleted = manifest.items.filter((item) => item.review.verdict !== "pending");
const postable = evaluable.filter((item) => item.review.verdict === "postable_with_minor_edits");

console.log(`技術検証: ${technicalPass}/${technical.items.length}`);
console.log(`品質判定の対象（台本・音声・素材がすべて実物）: ${evaluable.length}/${total}`);
console.log(`人手評価済み: ${humanCompleted.length}/${total}`);
console.log(`軽微な修正で投稿可能（判定対象のみ）: ${postable.length}/${total}`);

let status: string;
if (evaluable.length < total) {
  status = "判定対象外（fixtureまたは仮素材を含む。配線の確認のみ）";
} else if (!technicalAllPass) {
  status = "未合格（技術検証に不合格あり）";
} else if (postable.length >= REQUIRED_POSTABLE) {
  status = "合格";
} else if (humanCompleted.length < total) {
  status = "判定待ち";
} else {
  status = "未合格";
}
console.log(`Phase 0a: ${status}`);

if (status !== "合格") {
  console.log(
    `合格条件: 台本・音声・素材がすべて実物の${total}本で、技術検証が全件合格し、人手評価で${REQUIRED_POSTABLE}/${total}本以上が postable_with_minor_edits`,
  );
}
