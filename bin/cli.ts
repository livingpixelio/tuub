#!/usr/bin/env node
import { serve, browse } from "../src/index.js";

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.error("Usage: tuub-reader <command> [options]");
  console.error("Commands:");
  console.error("  serve <srcDir> [--cache-dir <dir>]");
  console.error("  browse <shareKey> [--port <port>] [--cache-dir <dir>]");
  process.exit(1);
}

async function main() {
  if (command === "serve") {
    const srcDir = args[1];
    if (!srcDir) {
      console.error("Error: serve requires srcDir argument");
      console.error("Usage: tuub-reader serve <srcDir> [--cache-dir <dir>]");
      process.exit(1);
    }

    const cacheDir = getOption("cache-dir");
    await serve({ srcDir, cacheDir });
  } else if (command === "browse") {
    const shareKey = args[1];
    if (!shareKey) {
      console.error("Error: browse requires shareKey argument");
      console.error(
        "Usage: tuub-reader browse <shareKey> [--port <port>] [--cache-dir <dir>]",
      );
      process.exit(1);
    }

    const port = getOption("port")
      ? parseInt(getOption("port")!, 10)
      : undefined;
    const cacheDir = getOption("cache-dir");

    if (port && isNaN(port)) {
      console.error("Error: port must be a valid number");
      process.exit(1);
    }

    await browse({ shareKey, port, cacheDir });
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Available commands: serve, browse");
    process.exit(1);
  }
}

function getOption(name: string): string | undefined {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
