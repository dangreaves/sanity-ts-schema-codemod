import z from "zod";

export const ConvertSchemasCommandSchema = z.object({
  input: z.string(),
  output: z.string(),
  removeFieldTypes: z.string(),
});

export const ConvertSchemasInnerSchema = ConvertSchemasCommandSchema.extend({
  removeFieldTypes: z.array(z.string()),
});
