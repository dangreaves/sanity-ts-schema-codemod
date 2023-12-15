import { Command } from "commander";

import { convertSchemas } from "@/commands/convert-schemas.js";

const program = new Command();

program
  .command("convert-schemas")
  .description("Convert schemas from JavaScript to TypeScript")
  .requiredOption("-i, --input <string>", "Directory of JS schemas")
  .requiredOption("-o, --output <string>", "Output directory for TS schemas")
  .action((args) => convertSchemas(args));

await program.parse();
