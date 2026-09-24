import type { BrandKit } from "./brand-kit";

export class GenerationBudgetExceededError extends Error {
  readonly code = "generation_budget_exceeded";

  constructor(readonly requestedImages: number, readonly maxGeneratedImages: number) {
    super(`画像生成数 ${requestedImages} は上限 ${maxGeneratedImages} を超えています`);
    this.name = "GenerationBudgetExceededError";
  }
}

/** Providerを呼び出す前に、ブランド設定の画像生成上限を確認する。 */
export function assertGenerationBudget(brand: Pick<BrandKit, "budget">, requestedImages: number): void {
  if (!Number.isInteger(requestedImages) || requestedImages < 0) throw new Error("requestedImages must be a non-negative integer");
  if (requestedImages > brand.budget.maxGeneratedImages) {
    throw new GenerationBudgetExceededError(requestedImages, brand.budget.maxGeneratedImages);
  }
}
