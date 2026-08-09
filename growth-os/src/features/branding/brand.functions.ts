import { createServerFn } from "@tanstack/react-start";
import { brandInputSchema } from "./brand.schemas";

export const getBrand = createServerFn({ method: "GET" }).handler(async () => {
  const { getBrand: loadBrand } = await import("./brand.server");
  return loadBrand();
});

export const updateBrand = createServerFn({ method: "POST" })
  .validator((input: unknown) => brandInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateBrand: saveBrand } = await import("./brand.server");
    return saveBrand(data);
  });
