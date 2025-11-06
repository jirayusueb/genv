#!/usr/bin/env bun
import { runCLI } from "./cli";

async function main() {
  if (import.meta.main) {
    const exitCode = await runCLI(process.argv.slice(2));
    process.exit(exitCode);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
