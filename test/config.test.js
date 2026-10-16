import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePackageName,
  parseConfig,
  newConfig,
  isInstalled,
  addPackage,
  SCHEMA_URL,
} from "../bin/config.js";

const PKG = "@aaronsr-54/opencode-go-model-costs";

test("normalizePackageName strips a version suffix", () => {
  assert.equal(normalizePackageName(PKG), PKG);
  assert.equal(normalizePackageName(`${PKG}@latest`), PKG);
  assert.equal(normalizePackageName(`${PKG}@1.2.3`), PKG);
  assert.equal(normalizePackageName("opencode-wakatime@latest"), "opencode-wakatime");
});

test("isInstalled matches entries with and without a version suffix", () => {
  const withoutVersion = JSON.stringify({ plugin: [PKG] });
  const withVersion = JSON.stringify({ plugin: [`${PKG}@latest`] });
  assert.equal(isInstalled(withoutVersion, PKG), true);
  assert.equal(isInstalled(withVersion, PKG), true);
  assert.equal(isInstalled(JSON.stringify({ plugin: [] }), PKG), false);
  assert.equal(isInstalled(JSON.stringify({ plugin: ["opencode-wakatime"] }), PKG), false);
});

test("addPackage appends and preserves JSONC comments and neighbouring keys", () => {
  const fixture = `{
  "$schema": "https://opencode.ai/config.json",
  // keep this comment
  "plugin": [
    "opencode-wakatime", // trailing comment
    "@slkiser/opencode-quota@latest"
  ],
  "provider": {
    "opencode-go": {}
  }
}
`;
  const { text, installed } = addPackage(fixture, PKG);
  assert.equal(installed, true);
  assert.match(text, /\/\/ keep this comment/);
  assert.match(text, /\/\/ trailing comment/);
  assert.match(text, /"opencode-wakatime"/);
  assert.match(text, new RegExp(`"${PKG.replace(/[/@]/g, "\\$&")}"`));
  const parsed = parseConfig(text);
  assert.deepEqual(parsed.plugin, [
    "opencode-wakatime",
    "@slkiser/opencode-quota@latest",
    PKG,
  ]);
  assert.deepEqual(parsed.provider, { "opencode-go": {} });
});

test("addPackage creates the plugin key when missing", () => {
  const fixture = `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "opencode-go": {}
  }
}
`;
  const { text, installed } = addPackage(fixture, PKG);
  assert.equal(installed, true);
  const parsed = parseConfig(text);
  assert.deepEqual(parsed.plugin, [PKG]);
  assert.deepEqual(parsed.provider, { "opencode-go": {} });
});

test("addPackage is idempotent for the same package", () => {
  const fixture = JSON.stringify({ plugin: [PKG] }, null, 2);
  const { text, installed } = addPackage(fixture, PKG);
  assert.equal(installed, false);
  assert.equal(text, fixture);
});

test("parseConfig throws on invalid JSON", () => {
  assert.throws(() => parseConfig("{ this is not json"), /not valid JSON/);
});

test("newConfig includes the schema and the package", () => {
  const parsed = parseConfig(newConfig(PKG));
  assert.equal(parsed.$schema, SCHEMA_URL);
  assert.deepEqual(parsed.plugin, [PKG]);
});
