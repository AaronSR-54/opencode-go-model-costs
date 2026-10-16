// Pure helpers for editing an OpenCode config (JSON or JSONC). They never touch
// the filesystem so the CLI stays a thin I/O shell and tests need no HOME.
import { modify, applyEdits, parse, parseTree, findNodeAtLocation } from "jsonc-parser";

export const SCHEMA_URL = "https://opencode.ai/config.json";

// "pkg" or "@scope/pkg" without a trailing "@version". A leading "@" belongs to
// the scope, so only a later "@" marks a version suffix.
export function normalizePackageName(entry) {
  if (typeof entry !== "string") return "";
  const at = entry.lastIndexOf("@");
  return at > 0 ? entry.slice(0, at) : entry;
}

// Parse and validate config text. Throws on invalid JSON/JSONC so callers can
// abort without overwriting the user's file.
export function parseConfig(configText) {
  const errors = [];
  const data = parse(configText, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const error = new Error("Config is not valid JSON or JSONC");
    error.parseErrors = errors;
    throw error;
  }
  return data;
}

// Text for a brand-new config: the OpenCode schema plus the plugin entry.
export function newConfig(pkg) {
  return JSON.stringify({ $schema: SCHEMA_URL, plugin: [pkg] }, null, 2) + "\n";
}

export function isInstalled(configText, pkg) {
  const target = normalizePackageName(pkg);
  const data = parseConfig(configText);
  const plugins = Array.isArray(data?.plugin) ? data.plugin : [];
  return plugins.some((entry) => normalizePackageName(entry) === target);
}

// Insert the package into the "plugin" array (creating it if missing) while
// preserving the rest of the file, including JSONC comments. Returns the new
// text and whether an entry was actually added.
export function addPackage(configText, pkg) {
  const data = parseConfig(configText);
  const target = normalizePackageName(pkg);
  const plugins = Array.isArray(data?.plugin) ? data.plugin : null;
  const already = plugins?.some((entry) => normalizePackageName(entry) === target) ?? false;
  if (already) return { text: configText, installed: false };

  const formattingOptions = { insertSpaces: true, tabSize: 2 };
  const pluginNode = findNodeAtLocation(parseTree(configText), ["plugin"]);
  // Append at the array's end so inner comments stay attached to their elements.
  // Otherwise write the whole key, as a one-element array so the shape is right.
  const edits =
    pluginNode?.type === "array"
      ? modify(configText, ["plugin", pluginNode.children.length], pkg, { formattingOptions })
      : modify(configText, ["plugin"], [pkg], { formattingOptions });
  return { text: applyEdits(configText, edits), installed: true };
}
