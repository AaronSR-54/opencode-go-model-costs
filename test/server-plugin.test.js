import { test } from "node:test";
import assert from "node:assert/strict";
import serverPlugin from "../server.js";

// OpenCode V1 loads { id, server }, V2 decodes { id, setup } | { id, effect }.
// The server entrypoint must satisfy both so a single package works on either.
test("server entrypoint exposes the V1 and V2 module shape", () => {
  assert.equal(typeof serverPlugin.id, "string");
  assert.ok(serverPlugin.id.length > 0);
  assert.equal(typeof serverPlugin.server, "function", "V1 requires server()");
  assert.equal(typeof serverPlugin.setup, "function", "V2 requires setup() or effect()");
});

test("server setup resolves without side effects", async () => {
  const hooks = await serverPlugin.server();
  assert.equal(typeof hooks, "object");
  await serverPlugin.setup();
});
