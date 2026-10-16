// Local, type-only mirror of the OpenCode V2 TUI plugin `Context`. Kept in the
// repo (instead of depending on the beta `@opencode/plugin`) so the build stays
// decoupled; only `import type` is used, so it is erased at build time.

export type TuiV2Location = {
  directory?: string;
  workspaceID?: string;
  project?: unknown;
};

export type TuiV2ModelCost = {
  tier?: string;
  input: number;
  output: number;
  cache?: number;
};

export type TuiV2Model = {
  id?: string;
  modelID?: string;
  providerID?: string;
  name?: string;
  cost?: TuiV2ModelCost[] | TuiV2ModelCost;
  time?: { released?: string | number };
};

export type TuiV2Provider = {
  id: string;
  name?: string;
  models?: Record<string, TuiV2Model>;
};

export type TuiV2LocationData<T> = {
  list: (location?: TuiV2Location) => T[] | undefined;
  sync: (location?: TuiV2Location) => Promise<unknown>;
  invalidate: (location?: TuiV2Location) => void;
};

export type TuiV2Store<T> = [T | (() => T), (mutator: (draft: T) => void) => unknown];

export type TuiV2SlotInput = {
  append?: string;
  prepend?: string;
  before?: string;
  after?: string;
  replace?: string;
  render: (props: { sessionID: string; name?: string; width?: number }) => unknown;
};

export type TuiV2Command = {
  id: string;
  title: string;
  group?: string;
  bind?: string;
  slash?: { name: string; aliases?: string[]; arguments?: boolean };
  run: (input?: string, event?: unknown) => unknown;
};

export type TuiV2KeymapLayer = {
  mode?: string;
  priority?: number;
  commands: TuiV2Command[];
  bindings?: string[];
};

export type TuiV2Context = {
  location?: TuiV2Location;
  app?: { version?: string; channel?: string };
  theme?: Record<string, any>;
  data: {
    location: {
      default: () => TuiV2Location;
      provider: TuiV2LocationData<TuiV2Provider>;
      model: TuiV2LocationData<TuiV2Model>;
    };
  };
  ui: {
    slot: (input: TuiV2SlotInput) => () => void;
    model: {
      current: () => { providerID?: string; modelID?: string; variant?: string } | null;
    };
  };
  storage: {
    store: <T>(key: string, options: { initial: T }) => TuiV2Store<T>;
    memory: <T>(key: string, options: { initial: T }) => TuiV2Store<T>;
  };
  keymap: {
    layer: (factory: () => TuiV2KeymapLayer) => () => void;
  };
};
