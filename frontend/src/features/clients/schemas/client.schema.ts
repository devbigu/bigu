import { z } from "zod";

const optionalText = (limit: number) => z.string().trim().max(limit).optional();
const optionalUrl = z.string().trim().max(2048).refine(
  (value) => !value || /^https?:\/\//i.test(value) && URL.canParse(value),
  "Enter a valid URL beginning with http:// or https://"
).optional();

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(160),
  industry: optionalText(120),
  description: optionalText(5000),
  targetAudience: optionalText(5000),
  brandVoice: optionalText(5000),
  websiteUrl: optionalUrl,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  businessObjectives: optionalText(5000),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

