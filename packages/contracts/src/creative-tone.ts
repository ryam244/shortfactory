import { z } from "zod";

export const CREATIVE_TONE_PROFILES = ["ip-character", "realistic-person", "pale-illustration-person"] as const;
export const creativeToneProfileSchema = z.enum(CREATIVE_TONE_PROFILES);
export type CreativeToneProfile = z.infer<typeof creativeToneProfileSchema>;
