import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/** @jsxImportSource @opentui/solid */

import { Show, createMemo, createSignal, onCleanup } from "solid-js";
import { NAME_MAX_CHARS, SIDEBAR_ORDER, buildCostItems, clipName, costColorKey, isGoProvider, kvCache, loadUsageLimits, v1Theme, v2Theme } from "./tui-core.js";

// Accent / semantic colors come from the host theme. V1 and string-based V2
// themes yield strings, while V2 resolved tokens are OpenTUI `RGBA` values;
// both are valid `fg`/`backgroundColor` inputs.

function readStore(value) {
  return typeof value === "function" ? value() : value;
}
function CostsPanel(props) {
  const toggleIcon = () => props.collapsed ? "▶" : "▼";
  return (() => {
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
    _$insertNode(_el$4, _el$5);
    _$insert(_el$4, toggleIcon, _el$5);
    _$insert(_el$2, _$createComponent(Show, {
      get when() {
        return props.collapsed;
      },
      get children() {
        var _el$6 = _$createElement("text"),
          _el$7 = _$createTextNode(` (`),
          _el$8 = _$createTextNode(` models)`);
        _$insertNode(_el$6, _el$7);
        _$insertNode(_el$6, _el$8);
        _$insert(_el$6, () => props.items.length, _el$8);
        _$effect(_$p => _$setProp(_el$6, "fg", props.theme().muted, _$p));
        return _el$6;
      }
    }), null);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return !props.collapsed;
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
        _$insert(_el$9, () => props.items.map(m => {
          const mx = m.burn !== null ? m.burn / props.baseline : 99;
          const active = m.active;
          const unknown = m.mult === "?";
          const costFg = unknown || !m.score ? props.theme().muted : props.theme()[costColorKey(mx)];
          const nameFg = active ? props.theme().accent : props.theme().muted;
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
            _$setProp(_el$16, "wrapMode", "none");
            _$insert(_el$16, tag);
            _$setProp(_el$17, "fg", nameFg);
            _$setProp(_el$17, "wrapMode", "none");
            _$insert(_el$17, label);
            _$effect(_p$ => {
              var _v$5 = active ? props.theme().accent : costFg,
                _v$6 = props.theme().faint;
              _v$5 !== _p$.e && (_p$.e = _$setProp(_el$14, "fg", _v$5, _p$.e));
              _v$6 !== _p$.t && (_p$.t = _$setProp(_el$16, "fg", _v$6, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$13;
          })();
        }), null);
        _$effect(_p$ => {
          var _v$ = props.theme().muted,
            _v$2 = props.theme().dim;
          _v$ !== _p$.e && (_p$.e = _$setProp(_el$1, "fg", _v$, _p$.e));
          _v$2 !== _p$.t && (_p$.t = _$setProp(_el$11, "fg", _v$2, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$9;
      }
    }), null);
    _$effect(_p$ => {
      var _v$3 = props.theme().text,
        _v$4 = props.onToggleCollapse;
      _v$3 !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$3, _p$.e));
      _v$4 !== _p$.t && (_p$.t = _$setProp(_el$3, "onMouseDown", _v$4, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })();
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
      var _v$7 = props.theme().text,
        _v$8 = props.theme().muted;
      _v$7 !== _p$.e && (_p$.e = _$setProp(_el$19, "fg", _v$7, _p$.e));
      _v$8 !== _p$.t && (_p$.t = _$setProp(_el$22, "fg", _v$8, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$18;
  })();
}
function V1SidebarContent(props) {
  const [activeId, setActiveId] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(props.api.kv.get("costs-collapsed", false));
  const dispose = props.api.event.on("session.updated", event => {
    const sid = event.properties?.info?.id;
    if (sid && sid !== props.sessionID) return;
    const id = event.properties?.info?.model?.id;
    if (id) setActiveId(id);
  });
  onCleanup(dispose);
  const data = createMemo(() => buildCostItems({
    providers: props.api.state.provider,
    limits: props.limits,
    activeModel: activeId()
  }));
  const theme = () => v1Theme(props.api.theme.current);
  const toggleCollapsed = () => {
    const next = !collapsed();
    setCollapsed(next);
    props.api.kv.set("costs-collapsed", next);
  };
  return _$createComponent(Show, {
    get when() {
      return data().items.length > 0;
    },
    get children() {
      return _$createComponent(CostsPanel, {
        get items() {
          return data().items;
        },
        get baseline() {
          return data().baseline;
        },
        get collapsed() {
          return collapsed();
        },
        theme: theme,
        onToggleCollapse: toggleCollapsed
      });
    }
  });
}
function V2SidebarContent(props) {
  const theme = () => v2Theme(props.context.theme);
  const collapsed = () => props.store().collapsed;
  const data = createMemo(() => {
    const context = props.context;
    const location = context.location ?? context.data.location.default();
    const providers = context.data.location.provider.list(location) ?? [];
    const go = providers.find(p => isGoProvider(p.id, p.name));
    const models = (context.data.location.model.list(location) ?? []).filter(m => !!go && m.providerID === go.id);
    return buildCostItems({
      providers,
      models: go ? models : [],
      limits: props.limits,
      activeModel: context.ui.model.current()
    });
  });
  const toggleCollapsed = () => {
    props.update(draft => {
      draft.collapsed = !draft.collapsed;
    });
  };
  return _$createComponent(Show, {
    get when() {
      return data().items.length > 0;
    },
    get children() {
      return _$createComponent(CostsPanel, {
        get items() {
          return data().items;
        },
        get baseline() {
          return data().baseline;
        },
        get collapsed() {
          return collapsed();
        },
        theme: theme,
        onToggleCollapse: toggleCollapsed
      });
    }
  });
}
const tui = async api => {
  const [enabled, setEnabled] = createSignal(api.kv.get("costs-enabled", true));
  const [usageLimits, setUsageLimits] = createSignal(undefined);
  loadUsageLimits({
    cache: kvCache(api.kv)
  }).then(limits => setUsageLimits(limits)).catch(() => setUsageLimits(null));
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
      sidebar_content(_ctx, props) {
        return _$createComponent(Show, {
          get when() {
            return enabled();
          },
          get children() {
            return _$createComponent(Show, {
              get when() {
                return usageLimits();
              },
              get fallback() {
                return _$createComponent(Show, {
                  get when() {
                    return usageLimits() === null;
                  },
                  get children() {
                    return _$createComponent(LimitsUnavailable, {
                      theme: () => v1Theme(api.theme.current)
                    });
                  }
                });
              },
              get children() {
                return _$createComponent(V1SidebarContent, {
                  api: api,
                  get limits() {
                    return usageLimits();
                  },
                  get sessionID() {
                    return props.session_id;
                  }
                });
              }
            });
          }
        });
      }
    }
  });
};
const setup = async context => {
  const [storeValue, update] = context.storage.store("costs", {
    initial: {
      enabled: true,
      collapsed: false
    }
  });
  const store = () => readStore(storeValue);
  const [usageLimits, setUsageLimits] = createSignal(undefined);
  loadUsageLimits().then(limits => setUsageLimits(limits)).catch(() => setUsageLimits(null));
  const disposeSlot = context.ui.slot({
    append: "sidebar.content",
    render: ({
      sessionID
    }) => _$createComponent(Show, {
      get when() {
        return store().enabled;
      },
      get children() {
        return _$createComponent(Show, {
          get when() {
            return usageLimits();
          },
          get fallback() {
            return _$createComponent(Show, {
              get when() {
                return usageLimits() === null;
              },
              get children() {
                return _$createComponent(LimitsUnavailable, {
                  theme: () => v2Theme(context.theme)
                });
              }
            });
          },
          get children() {
            return _$createComponent(V2SidebarContent, {
              context: context,
              get limits() {
                return usageLimits();
              },
              store: store,
              update: update,
              sessionID: sessionID
            });
          }
        });
      }
    })
  });
  context.keymap.layer(() => ({
    mode: "global",
    commands: [{
      id: "model-costs.toggle",
      title: "Toggle Go Costs",
      group: "Model Costs",
      slash: {
        name: "toggle-costs"
      },
      run: () => {
        update(draft => {
          draft.enabled = !draft.enabled;
        });
      }
    }]
  }));
  return () => {
    if (typeof disposeSlot === "function") disposeSlot();
  };
};
const pluginModule = {
  id: "model-costs",
  tui,
  setup
};
export default pluginModule;