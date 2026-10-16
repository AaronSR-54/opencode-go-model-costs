# Design

## Context

Ver `proposal.md` - Why. Estado actual relevante:

- `tui.tsx` (compilado a `tui.js` por `build-tui.mjs` con Babel + `babel-preset-solid`,
  `moduleName: "@opentui/solid"`) exporta `{ id: "model-costs", tui }` (forma V1).
- El loader TUI de V2 valida el `default` con `isPlugin` y exige `id` (string no
  vacío) + `setup` función (`packages/tui/src/plugin/context.tsx`); si no, lanza
  `Invalid V2 TUI plugin module`.
- El loader V1 lee solo `id`/`server`/`tui` y tolera claves extra.
- Datos V2 disponibles en el contexto TUI: `data.location.provider/model`,
  `ui.model.current()`, `storage.store`, `ui.slot`, `keymap.layer`, `theme`.

## Goals / Non-Goals

**Goals:**

- Un único entrypoint TUI que cargue en OpenCode V1 y V2.
- Panel, comando y estado con paridad de comportamiento entre ambos runtimes.
- Una sola implementación del cálculo de coste y del formato, compartida.
- Sin regresiones en V1.

**Non-Goals:**

- Reescribir el comando `init` ni el entrypoint server (ya resueltos).
- Soportar el runtime web/desktop por slots DOM (no existe entrypoint `./web`).
- Cambiar la fuente de datos (se sigue leyendo la tabla de límites de la doc
  oficial de Go, en runtime).
- Añadir features nuevas de UI más allá de la paridad.

## Decisions

### D1. Export dual `{ id, tui, setup }`

El `default` del entrypoint TUI lleva `tui` (V1) y `setup` (V2). Evidencia: la
doc de OpenCode ("Support V1"), el `isPlugin` de `context.tsx` (solo exige
`id` + `setup`, tolera extras) y el ADR de un plugin comunitario verificado
contra V1.18.30 y V2.0.3. Alternativa descartada: sólo V2 (rompe V1).

### D2. Núcleo puro compartido

Extraer a un módulo puro (sin JSX, sin API de runtime) el cálculo:
`buildCostItems({ providers, models, limits, activeModel })` y el loader de
límites (`loadUsageLimits` con caché). Los adaptadores V1 y V2 solo traducen sus
fuentes de datos y su tema a los tipos de entrada. Evita divergencia entre ramas.

### D3. Adaptador V2

`setup(context)`:
- Panel: `context.ui.slot({ append: "sidebar.content", render: ({ sessionID }) => <V2Panel .../> })`;
  guardar el disposer para el cleanup.
- Providers/models: `context.data.location.provider.list(context.location)` y
  `context.data.location.model.list(context.location)`.
- Modelo activo: `context.ui.model.current()` → `{ providerID, modelID }`.
- Estado: `context.storage.store("costs", { initial: { enabled: true, collapsed: false } })`
  (tupla reactiva `[store, update]`).
- Comando: `context.keymap.layer(() => ({ commands: [{ id, title, group, slash:
  { name: "toggle-costs" }, run }] }))`; la capa se retira sola al desactivar el plugin.
- Cleanup: devolver una función que libera el slot y las suscripciones.

### D4. Mapeo de datos de modelo (V2 → CostItem)

`ModelInfo` de V2: `cost: Array<ModelCost>` (`{ tier?, input, output, cache }`),
`time.released` (timestamp), `providerID`, `modelID`/`id`, `name`.
Se usa `cost[0].input/output` para el coste mezclado y `time.released` para la
marca `✦`. El id de provider sale de `model.providerID` (no hay que inferir de
`api.state.provider` como en V1).

### D5. Mapeo de tema (V2)

Tokens V2 (`ResolvedTheme`): `theme.text.base`, `theme.text.muted`,
`theme.text.faint`, `theme.text.feedback.{success,warning,error}.base`, y el acento
vía `theme.text.action.primary[...].base` (los `StatefulColor` exponen `state(...)`).
Se define un helper que resuelve el color efectivo para cada uso del panel.

### D6. Compatibilidad de datos V1

El adaptador V1 conserva `api.state.provider`, `api.kv`, `api.event`,
`api.command.register`, `api.theme.current` y el slot `sidebar_content` (snake_case).
La única adición es la clave `setup` en el `default`.

### D7. Empaquetado y peers

Subir `@opentui/solid` a `>=0.5.8` y declarar peer `@opentui/core >=0.5.8`
(requisito de V2) manteniendo `solid-js`. El bundle debe seguir emitiendo imports
"bare" de `@opentui/*` y `solid-js` (los reescribe el host). Alternativa
descartada: bundlear OpenTUI (rompe el runtime reactivo único del host).

### D8. Tipos V2 sin dependencia de runtime

Añadir un archivo local `tui-v2-types.ts` que espeja el `Context`/`Plugin.Definition`
de V2 (como hace el ADR de referencia), en vez de depender de `@opencode/plugin`
(beta). Son `import type`, se borran en el build. Alternativa descartada: agregar
`@opencode/plugin` como devDependency (acopla el build a una superficie beta).

### D9. Tests

- Tests del núcleo puro (orden, colores por umbral, `?`, `0.0x`, `✦`, idempotencia).
- Test de la forma del módulo: `default` con `id` string, `tui` función y `setup`
  función, y una comprobación que replica `isPlugin` de V2.

## Risks / Trade-offs

- **API TUI V2 en beta** → puede cambiar entre releases; se fija a una versión
  concreta de referencia (v2.0.24) y se documenta.
- **JSX de plugins externos V2** (#37836, "No renderer found") → mitigar con
  `@opentui/solid >=0.5.8` y probar contra un binario V2 si está disponible;
  mantener el componente sin dependencias exóticas.
- **Salto `@opentui/solid` 0.4→0.5** → revisar que el JSX siga compilando y
  renderizando en V1; el build Babel no cambia de mecanismo.
- **Sin binario V2 local** → no hay e2e V2 en esta máquina; se valida por
  contrato (forma del módulo) y contra la doc/código fuente; e2e opcional vía
  `OPENCODE_BIN`.
- **Divergencia V1/V2** → mitigada por el núcleo puro compartido y tests.

## Migration Plan

- Cambio aditivo en el entrypoint TUI; no requiere migración de datos.
- Rollback: revertir `tui.tsx`/`tui.js` y `package.json`; el resto del paquete no
  cambia.
- Despliegue: bump de versión (feature → minor) y publicación estándar; usuarios
  V2 recuperan el panel tras actualizar y reiniciar.
