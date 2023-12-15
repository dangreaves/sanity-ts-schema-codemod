import { Command } from "commander";

import { helloWorld } from "@/commands/hello-world.js";

const program = new Command();

program
  .command("hello-world")
  .description("Output a hello world message")
  .requiredOption("-n, --name <string>", "Your name")
  .action((args: { name: string }) => helloWorld(args));

await program.parse();
