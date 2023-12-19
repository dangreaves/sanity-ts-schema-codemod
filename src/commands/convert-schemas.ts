import path from "node:path";

import fs from "fs-extra";
import { globby } from "globby";
import { run as jscodeshift } from "jscodeshift/src/Runner.js";

const transformPath = path.resolve("src/transformers/schema.ts");

export async function convertSchemas({
  input,
  output,
}: {
  input: string;
  output: string;
}) {
  // Resolve input and output dirs.
  const inputDir = path.resolve(input);
  const outputDir = path.resolve(output);

  // Copy files to output dir.
  for (const jsPath of await globby(path.join(inputDir, "**/*.{js,jsx}"))) {
    const relativePath = jsPath.replace(inputDir, "");

    const sourcePath = path.join(inputDir, relativePath);
    const outputPath = path.join(outputDir, relativePath).replace(".js", ".ts");

    await fs.copy(sourcePath, outputPath);
  }

  // Transform output files.
  const transformPaths = await globby(path.join(outputDir, "**/*.ts"));
  await jscodeshift(transformPath, transformPaths, {
    verbose: true,
  });
}
