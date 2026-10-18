import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pluginModule from "../tui.js";
import { v2Theme } from "../tui-core.js";

// Loader predicates, replicated literally from each runtime's source:
// V1 accepts { id, tui }, V2 accepts { id (non-empty), setup }.
const isV1Plugin = (m) => !!m && typeof m.id === "string" && m.id.length > 0 && typeof m.tui === "function";
const isV2Plugin = (m) => !!m && typeof m.id === "string" && m.id.length > 0 && typeof m.setup === "function";

// Minimal stand-in for OpenTUI's RGBA, the shape V2 hands plugins as theme
// tokens (and a valid `fg` input as-is).
const rgba = (r, g, b, a = 255) => ({ toInts: () => [r, g, b, a] });

test("TUI entrypoint exposes the V1 and V2 module shape", () => {
  assert.equal(typeof pluginModule.id, "string");
  assert.ok(pluginModule.id.length > 0);
  assert.equal(typeof pluginModule.tui, "function", "V1 requires tui()");
  assert.equal(typeof pluginModule.setup, "function", "V2 requires setup()");
});

test("compiled tui.js default satisfies both the V1 and V2 loader predicates", () => {
  assert.equal(isV1Plugin(pluginModule), true);
  assert.equal(isV2Plugin(pluginModule), true);
});

function createV2Harness() {
  const state = { enabled: true, collapsed: false };
  const calls = { slot: null, layer: null, disposed: false };
  const context = {
    location: { directory: "/tmp/project" },
    theme: {
      text: {
        base: rgba(237, 238, 233),
        muted: "#222",
        faint: "#333",
        action: { primary: { base: rgba(3, 6, 9), hovered: rgba(9, 9, 9) } },
        feedback: { success: { base: "#0f0" }, warning: { base: "#ff0" }, error: { base: "#f00" } },
      },
    },
    data: {
      location: {
        default: () => ({ directory: "/tmp/project" }),
        provider: { list: () => [{ id: "opencode-go", name: "OpenCode Go" }], sync: async () => {}, invalidate: () => {} },
        model: { list: () => [], sync: async () => {}, invalidate: () => {} },
      },
    },
    ui: {
      slot: (input) => {
        calls.slot = input;
        return () => {
          calls.disposed = true;
        };
      },
      model: { current: () => null },
    },
    storage: {
      store: () => [state, (mutator) => mutator(state)],
      memory: () => [state, (mutator) => mutator(state)],
    },
    keymap: {
      layer: (factory) => {
        calls.layer = factory;
        return () => {};
      },
    },
  };
  return { context, state, calls };
}

test("v2Theme resolves RGBA theme tokens from the V2 context", () => {
  const { context } = createV2Harness();
  const theme = v2Theme(context.theme);
  assert.equal(theme.text, context.theme.text.base, 'RGBA token must pass through, not become ""');
  assert.equal(theme.accent, context.theme.text.action.primary.base, "stateful accent must unwrap to base");
  assert.equal(theme.success, "#0f0");
  assert.notEqual(theme.text, "");
});

test("setup registers the sidebar slot and /toggle-costs, persists state and returns cleanup", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, text: async () => "" });
  try {
    const { context, state, calls } = createV2Harness();
    const cleanup = await pluginModule.setup(context);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(typeof cleanup, "function");
    assert.equal(calls.slot.append, "sidebar.content");
    assert.equal(typeof calls.slot.render, "function");
    assert.equal(typeof calls.layer, "function");

    const layer = calls.layer();
    assert.equal(layer.commands[0].slash.name, "toggle-costs");
    assert.equal(state.enabled, true);
    layer.commands[0].run();
    assert.equal(state.enabled, false, "run() must toggle the observable state");

    cleanup();
    assert.equal(calls.disposed, true, "cleanup must release the slot");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Optional end-to-end smoke against a real V2 binary. Skipped unless
// OPENCODE_BIN points at one, since the repo has no V2 runtime otherwise.
test(
  "V2 binary loads the plugin without 'Invalid V2 TUI plugin module'",
  { skip: !process.env.OPENCODE_BIN },
  () => {
    const dir = mkdtempSync(join(tmpdir(), "ocgm-costs-"));
    const configDir = join(dir, ".opencode");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "opencode.json"), JSON.stringify({ plugin: [join(process.cwd(), "tui.js")] }));

    const result = spawnSync(process.env.OPENCODE_BIN, [], {
      cwd: dir,
      encoding: "utf8",
      timeout: 20000,
      input: "\u0003",
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    assert.doesNotMatch(output, /Invalid V2 TUI plugin module/);
  }
);
