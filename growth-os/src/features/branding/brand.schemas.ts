import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(hexColor.parse(first));
  const secondLuminance = relativeLuminance(hexColor.parse(second));
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export const brandInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    logoUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .refine((value) => new URL(value).protocol === "https:", "Logo URL must use HTTPS"),
    primaryColor: hexColor,
    accentColor: hexColor,
    onPrimaryColor: hexColor,
    reportName: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((brand, context) => {
    if (contrastRatio(brand.primaryColor, brand.onPrimaryColor) < 4.5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary and on-primary colors must have at least 4.5:1 contrast",
        path: ["onPrimaryColor"],
      });
    }
  });

export type BrandInput = z.infer<typeof brandInputSchema>;
