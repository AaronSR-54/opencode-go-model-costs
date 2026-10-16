// Server entrypoint. The actual feature lives in the TUI plugin (see tui.js),
// so the server side is a no-op.
//
// OpenCode V2's external loader requires the default export to carry an `id`
// and a `setup` (or `effect`) function; V1 calls `server` instead. Exporting
// both keeps a single entrypoint working on V1 and V2.
const server = async () => ({});
const setup = async () => {};
export default { id: "model-costs", server, setup };
