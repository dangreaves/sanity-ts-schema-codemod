import { Command } from "commander";

import { ConvertSchemasCommandSchema } from "@/schemas.js";

import { convertSchemas } from "@/commands/convert-schemas.js";

const program = new Command();

program
  .command("convert-schemas")
  .description("Convert schemas from JavaScript to TypeScript")
  .requiredOption("-i, --input <string>", "Directory of JS schemas")
  .requiredOption("-o, --output <string>", "Output directory for TS schemas")
  .option(
    "--remove-field-types <string>",
    "Comma separated list of field types to remove",
  )
  .action((_args) => {
    const args = ConvertSchemasCommandSchema.parse(_args);

    convertSchemas({
      input: args.input,
      output: args.output,
      removeFieldTypes: args.removeFieldTypes
        ? args.removeFieldTypes.split(",").filter((type) => type.trim())
        : [],
    });
  });

await program.parse();
