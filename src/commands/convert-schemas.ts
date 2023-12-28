import path from "node:path";

import z from "zod";
import fs from "fs-extra";
import { globby } from "globby";
import { run as jscodeshift } from "jscodeshift/src/Runner.js";

import { ConvertSchemasInnerSchema } from "@/schemas.js";

export async function convertSchemas(
  options: z.infer<typeof ConvertSchemasInnerSchema>,
) {
  // Resolve input and output dirs.
  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);

  // Copy files to output dir.
  for (const jsPath of await globby(path.join(inputDir, "**/*.{js,jsx}"))) {
    const relativePath = jsPath.replace(inputDir, "");

    const sourcePath = path.join(inputDir, relativePath);
    const outputPath = path.join(outputDir, relativePath).replace(".js", ".ts");

    await fs.copy(sourcePath, outputPath);
  }

  // Resolve output files to transform.
  const transformPaths = await globby(path.join(outputDir, "**/*.{ts,tsx}"));

  // Run transform.
  await jscodeshift(
    path.resolve("src/transformers/schema.ts"),
    transformPaths,
    {
      ...options,
      verbose: true,
    },
  );
}
