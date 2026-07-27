import { z } from "zod";

const optionalText = (limit: number) => z.string().trim().max(limit);
const optionalNumber = (minimum: number, maximum: number, label: string) =>
  z
    .string()
    .refine(
      (value) =>
        !value ||
        (Number.isInteger(Number(value)) &&
          Number(value) >= minimum &&
          Number(value) <= maximum),
      `${label} must be between ${minimum} and ${maximum}`,
    );

export const projectSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client"),
    title: z.string().trim().min(1, "Project title is required").max(200),
    projectType: z.enum([
      "SOCIAL_MEDIA_MANAGEMENT",
      "SEO_MANAGEMENT",
      "WEBSITE_DEVELOPMENT",
      "SOFTWARE_DEVELOPMENT",
    ]),
    growthObjective: optionalText(5000),
    platforms: z.string().max(500),
    startDate: z.string(),
    endDate: z.string(),
    month: optionalNumber(1, 12, "Month"),
    year: optionalNumber(2000, 2200, "Year"),
    assignedUserId: z.string(),
    contentTarget: optionalNumber(0, 100000, "Content target"),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]),
  })
  .refine(
    (values) =>
      !values.startDate ||
      !values.endDate ||
      Date.parse(values.endDate) >= Date.parse(values.startDate),
    { path: ["endDate"], message: "End date cannot be before start date" },
  );

export type ProjectFormValues = z.infer<typeof projectSchema>;
