import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/** @jsxImportSource @opentui/solid */

import { Show, createMemo, createSignal, onCleanup } from "solid-js";
const SIDEBAR_ORDER = 200;
const RECENT_WINDOW_DAYS = 30;
const NAME_MAX_CHARS = 28;
function clipName(name, max) {
  if (max < 4) max = 4;
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

// Monthly usage limits are looked up at runtime from the official Go docs
// instead of a hardcoded table, so models added/removed upstream are picked
// up automatically. https://opencode.ai/docs/go.md serves the docs source
// markdown containing the per-model "Monthly limit" table.
// The docs' base "Go" table is used: Go Plus scales every limit by the same
// factor, so relative burn rates are identical.
const USAGE_LIMITS_URL = "https://opencode.ai/docs/go.md";
const USAGE_LIMITS_CACHE_KEY = "costs-usage-limits";
const USAGE_LIMITS_TTL_MS = 12 * 60 * 60 * 1000;
// Free/unlimited models consume no quota. Kept JSON-safe for the kv cache.
const UNLIMITED = Number.MAX_SAFE_INTEGER;
// "DeepSeek V4.1 Flash (Off-Peak)" -> "deepseek-v4.1-flash", which matches
// the provider's model id. Tier / price suffixes are dropped.
function normalizeModelId(name) {
  return name.replace(/\([^)]*\)/g, "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9.-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Parse the first "Monthly limit" markdown table from the docs source.
function parseUsageLimits(markdown) {
  const limits = {};
  const lines = markdown.split(/\r?\n/);
  let i = lines.findIndex(l => /^\s*\|.*Monthly limit/i.test(l));
  if (i < 0) return limits;
  i += 2; // skip the header + separator rows
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*\|/.test(line)) break;
    const cells = line.split("|").slice(1, -1).map(s => s.trim());
    if (cells.length < 2) continue;
    const raw = cells[cells.length - 1];
    const key = normalizeModelId(cells[0]);
    if (!key) continue;
    if (/unlimited/i.test(raw)) {
      limits[key] = UNLIMITED;
      continue;
    }
    const match = raw.match(/[0-9]+(?:\.[0-9]+)?/);
    if (match) limits[key] = parseFloat(match[0]);
  }
  return limits;
}

// Fetch limits from the docs, falling back to a cached copy (even stale) when
// the network is unavailable. Returns null only when nothing is available.
async function loadUsageLimits(api) {
  const cached = api.kv.get(USAGE_LIMITS_CACHE_KEY, null);
  const hasCache = !!cached?.limits && Object.keys(cached.limits).length > 0;
  if (hasCache && Date.now() - cached.at < USAGE_LIMITS_TTL_MS) return cached.limits;
  try {
    const res = await fetch(USAGE_LIMITS_URL, {
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const limits = parseUsageLimits(await res.text());
    if (Object.keys(limits).length === 0) throw new Error("empty usage table");
    api.kv.set(USAGE_LIMITS_CACHE_KEY, {
      at: Date.now(),
      limits
    });
    return limits;
  } catch {
    return hasCache ? cached.limits : null;
  }
}
const BASELINE_MODEL = "minimax-m2.7";
const BASELINE_FALLBACK_COST = 0.66;
const BASELINE_FALLBACK_LIMIT = 60;
function costColor(n, theme) {
  if (n <= 1.5) return theme.success;
  if (n <= 5) return theme.warning;
  return theme.error;
}
function getGoModels(api, limits) {
  const providers = api.state.provider;
  const go = providers.find(p => p.id === "opencode-go" || p.id === "go" || RegExp("go", "i").test(p.name || ""));
  const models = go?.models ?? {};
  const entries = Object.entries(models);

  // Quota burn rate: share of the model's own monthly usage allowance
  // consumed per blended 1M tokens. This is what actually depletes the
  // shared 5h/weekly/monthly windows.
  const baseLimit = limits[BASELINE_MODEL] ?? BASELINE_FALLBACK_LIMIT;
  const baseCost = models[BASELINE_MODEL]?.cost;
  const BASELINE_BURN = (baseCost ? baseCost.input + baseCost.output * 0.3 : BASELINE_FALLBACK_COST) / baseLimit;
  function limitOf(id) {
    return limits[normalizeModelId(id.split("/").pop() || id)] ?? null;
  }
  const dates = [];
  for (const [, m] of entries) {
    const d = Date.parse(m.release_date);
    if (!isNaN(d)) dates.push(d);
  }
  const newest = dates.length > 0 ? Math.max(...dates) : Date.now();
  const threshold = newest - RECENT_WINDOW_DAYS * 86400000;
  function isRecent(m) {
    const d = Date.parse(m.release_date);
    return !isNaN(d) && d >= threshold;
  }
  const fmtMult = n => n >= 10 ? Math.round(n) + "x" : n.toFixed(1) + "x";

  // Models missing a price or a documented usage limit are shown with a "?"
  // marker instead of an approximate multiplier.
  const items = entries.map(([id, m]) => {
    const recent = isRecent(m);
    const c = m.cost;
    const limit = limitOf(id);
    if (!c || !limit || limit <= 0) {
      const score = c ? c.input + c.output * 0.3 : null;
      return {
        id,
        name: m.name || id,
        mult: "?",
        score,
        burn: null,
        limit: null,
        recent
      };
    }
    const sc = c.input + c.output * 0.3;
    const burn = sc / limit; // share of monthly allowance per 1M tok
    return {
      id,
      name: m.name || id,
      score: sc,
      burn,
      limit,
      mult: fmtMult(burn / BASELINE_BURN),
      recent
    };
  }).sort((a, b) => {
    const ka = a.burn ?? a.score ?? Infinity;
    const kb = b.burn ?? b.score ?? Infinity;
    return ka - kb;
  });
  return {
    items,
    baseline: BASELINE_BURN
  };
}
function SidebarContentView(props) {
  const [activeId, setActiveId] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(props.api.kv.get("costs-collapsed", false));
  const dispose = props.api.event.on("session.updated", event => {
    const sid = event.properties?.info?.id;
    if (sid && sid !== props.sessionID) return;
    const id = event.properties?.info?.model?.id;
    if (id) setActiveId(id);
  });
  onCleanup(dispose);
  const isActive = id => {
    const a = activeId();
    if (!a) return false;
    if (a === id) return true;
    const aShort = a.split("/").pop() || "";
    const idShort = id.split("/").pop() || "";
    return aShort === idShort || a.endsWith("/" + id) || a.includes(id);
  };
  const toggleCollapsed = () => {
    const next = !collapsed();
    setCollapsed(next);
    props.api.kv.set("costs-collapsed", next);
  };
  const toggleIcon = () => collapsed() ? "▶" : "▼";
  return _$createComponent(Show, {
    get when() {
      return props.items.length > 0;
    },
    get children() {
      var _el$ = _$createElement("box"),
        _el$2 = _$createElement("box"),
        _el$3 = _$createElement("text"),
        _el$4 = _$createElement("b"),
        _el$5 = _$createTextNode(` Costs`);
      _$insertNode(_el$, _el$2);
      _$setProp(_el$, "gap", 0);
      _$insertNode(_el$2, _el$3);
      _$setProp(_el$2, "flexDirection", "row");
      _$insertNode(_el$3, _el$4);
      _$setProp(_el$3, "onMouseDown", toggleCollapsed);
      _$insertNode(_el$4, _el$5);
      _$insert(_el$4, toggleIcon, _el$5);
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return collapsed();
        },
        get children() {
          var _el$6 = _$createElement("text"),
            _el$7 = _$createTextNode(` (`),
            _el$8 = _$createTextNode(` models)`);
          _$insertNode(_el$6, _el$7);
          _$insertNode(_el$6, _el$8);
          _$insert(_el$6, () => props.items.length, _el$8);
          _$effect(_$p => _$setProp(_el$6, "fg", props.api.theme.current.textMuted, _$p));
          return _el$6;
        }
      }), null);
      _$insert(_el$, _$createComponent(Show, {
        get when() {
          return !collapsed();
        },
        get children() {
          var _el$9 = _$createElement("box"),
            _el$0 = _$createElement("box"),
            _el$1 = _$createElement("text"),
            _el$11 = _$createElement("text");
          _$insertNode(_el$9, _el$0);
          _$setProp(_el$9, "gap", 0);
          _$insertNode(_el$0, _el$1);
          _$insertNode(_el$0, _el$11);
          _$setProp(_el$0, "flexDirection", "row");
          _$setProp(_el$0, "justifyContent", "space-between");
          _$insertNode(_el$1, _$createTextNode(`[OpenCode Go]`));
          _$insertNode(_el$11, _$createTextNode(`use/1M tok`));
          _$setProp(_el$11, "fg", "#555555");
          _$insert(_el$9, () => props.items.map(m => {
            const mx = m.burn !== null ? m.burn / props.baseline : 99;
            const active = isActive(m.id);
            const unknown = m.mult === "?";
            const costFg = unknown || !m.score ? props.api.theme.current.textMuted : costColor(mx, props.api.theme.current);
            const nameFg = active ? props.api.theme.current.accent : props.api.theme.current.textMuted;
            const tag = m.recent ? "✦ " : "";
            const label = clipName(m.name, NAME_MAX_CHARS - tag.length);
            return (() => {
              var _el$13 = _$createElement("box"),
                _el$14 = _$createElement("text"),
                _el$15 = _$createElement("box"),
                _el$16 = _$createElement("text"),
                _el$17 = _$createElement("text");
              _$insertNode(_el$13, _el$14);
              _$insertNode(_el$13, _el$15);
              _$setProp(_el$13, "flexDirection", "row");
              _$setProp(_el$13, "justifyContent", "space-between");
              _$setProp(_el$14, "wrapMode", "none");
              _$insert(_el$14, active ? "● " : "  ", null);
              _$insert(_el$14, () => m.mult, null);
              _$insertNode(_el$15, _el$16);
              _$insertNode(_el$15, _el$17);
              _$setProp(_el$15, "flexDirection", "row");
              _$setProp(_el$16, "fg", "#666666");
              _$setProp(_el$16, "wrapMode", "none");
              _$insert(_el$16, tag);
              _$setProp(_el$17, "fg", nameFg);
              _$setProp(_el$17, "wrapMode", "none");
              _$insert(_el$17, label);
              _$effect(_$p => _$setProp(_el$14, "fg", active ? props.api.theme.current.accent : costFg, _$p));
              return _el$13;
            })();
          }), null);
          _$effect(_$p => _$setProp(_el$1, "fg", props.api.theme.current.textMuted, _$p));
          return _el$9;
        }
      }), null);
      _$effect(_$p => _$setProp(_el$3, "fg", props.api.theme.current.text, _$p));
      return _el$;
    }
  });
}
function LimitsUnavailable(props) {
  return (() => {
    var _el$18 = _$createElement("box"),
      _el$19 = _$createElement("text"),
      _el$20 = _$createElement("b"),
      _el$22 = _$createElement("text");
    _$insertNode(_el$18, _el$19);
    _$insertNode(_el$18, _el$22);
    _$setProp(_el$18, "gap", 0);
    _$insertNode(_el$19, _el$20);
    _$insertNode(_el$20, _$createTextNode(`▼ Costs`));
    _$insertNode(_el$22, _$createTextNode(`[OpenCode Go] limits unavailable`));
    _$effect(_p$ => {
      var _v$ = props.api.theme.current.text,
        _v$2 = props.api.theme.current.textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$19, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$22, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$18;
  })();
}
const tui = async api => {
  const [enabled, setEnabled] = createSignal(api.kv.get("costs-enabled", true));
  const [usageLimits, setUsageLimits] = createSignal(undefined);
  loadUsageLimits(api).then(limits => setUsageLimits(limits)).catch(() => setUsageLimits(null));
  const data = createMemo(() => {
    const limits = usageLimits();
    return limits ? getGoModels(api, limits) : null;
  });
  const toggle = () => {
    const next = !enabled();
    setEnabled(next);
    api.kv.set("costs-enabled", next);
  };
  if (api.command) {
    const disposeCommand = api.command.register(() => [{
      title: "Toggle Go Costs",
      value: "model-costs.toggle",
      description: "Show/hide the Go model costs sidebar",
      category: "Model Costs",
      slash: {
        name: "toggle-costs"
      },
      onSelect: toggle
    }]);
    api.lifecycle.onDispose(() => disposeCommand());
  }
  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, _props) {
        return _$createComponent(Show, {
          get when() {
            return enabled();
          },
          get children() {
            return _$createComponent(Show, {
              get when() {
                return data();
              },
              get fallback() {
                return _$createComponent(Show, {
                  get when() {
                    return usageLimits() === null;
                  },
                  get children() {
                    return _$createComponent(LimitsUnavailable, {
                      api: api
                    });
                  }
                });
              },
              children: d => _$createComponent(SidebarContentView, {
                api: api,
                get items() {
                  return d().items;
                },
                get baseline() {
                  return d().baseline;
                },
                get sessionID() {
                  return _props.session_id;
                }
              })
            });
          }
        });
      }
    }
  });
};
const pluginModule = {
  id: "model-costs",
  tui
};
export default pluginModule;