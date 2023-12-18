import path from "node:path";

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
  const jsPaths = await globby(path.join(input, "**/*.js"));

  await jscodeshift(transformPath, jsPaths, {
    verbose: true,
  });
}
