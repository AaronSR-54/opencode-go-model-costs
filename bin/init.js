#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { addPackage, newConfig } from "./config.js";

const PKG = "@aaronsr-54/opencode-go-model-costs";

const USAGE = `opencode-go-model-costs init

Registers the plugin in your global OpenCode config.

Usage:
  npx ${PKG} init

Options:
  -h, --help   Show this help
`;

function configDir() {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim() ? xdg : join(homedir(), ".config");
  return join(base, "opencode");
}

// Prefer opencode.json; fall back to an existing opencode.jsonc; otherwise the
// path to create is opencode.json.
function resolveConfigFile(dir) {
  const json = join(dir, "opencode.json");
  if (existsSync(json)) return { path: json, exists: true };
  const jsonc = join(dir, "opencode.jsonc");
  if (existsSync(jsonc)) return { path: jsonc, exists: true };
  return { path: json, exists: false };
}

function run() {
  const dir = configDir();
  const { path, exists } = resolveConfigFile(dir);

  if (!exists) {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, newConfig(PKG));
    } catch (error) {
      console.error(`Could not create ${path}: ${error.message}`);
      return 1;
    }
    console.log(`Installed ${PKG} in ${path}`);
    console.log("Restart OpenCode for the plugin to load.");
    return 0;
  }

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    console.error(`Could not read ${path}: ${error.message}`);
    return 1;
  }

  let result;
  try {
    result = addPackage(text, PKG);
  } catch (error) {
    console.error(`Could not update ${path}: ${error.message}`);
    console.error("The file was left unchanged.");
    return 1;
  }

  if (!result.installed) {
    console.log(`${PKG} is already installed in ${path}`);
    return 0;
  }

  try {
    writeFileSync(path, result.text);
  } catch (error) {
    console.error(`Could not write ${path}: ${error.message}`);
    return 1;
  }

  console.log(`Installed ${PKG} in ${path}`);
  console.log("Restart OpenCode for the plugin to load.");
  return 0;
}

function main(argv) {
  const command = argv[0];

  if (command === "-h" || command === "--help") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (!command) {
    process.stderr.write(USAGE);
    return 1;
  }

  if (command !== "init") {
    process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
    return 1;
  }

  return run();
}

process.exit(main(process.argv.slice(2)));
