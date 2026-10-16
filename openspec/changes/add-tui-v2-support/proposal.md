# Proposal

## Why

OpenCode V2 cambió la API de plugins de TUI. Un módulo TUI debe exportar por
`default` un objeto con `id` y una función `setup(context)`; el loader V2 rechaza
la forma V1 `{ id, tui }` con `Invalid V2 TUI plugin module` y descarta el plugin
(el panel desaparece). Nuestro `tui.js` usa la forma V1, así que en OpenCode V2
falla aunque el arreglo del server (1.6.1) ya haya resuelto el arranque del lado
servidor.

## What Changes

- Cambiar el `default` export del entrypoint TUI a la forma dual
  `{ id, tui, setup }`: V1 usa `tui`, V2 usa `setup`, y cada loader ignora la
  clave del otro (mismo patrón que ya aplicamos a `server` + `setup`).
- Implementar `setup(context)` contra la API TUI de V2:
  - Registrar el panel con `context.ui.slot({ append: "sidebar.content", render })`.
  - Persistir `enabled`/`collapsed` con `context.storage.store(...)`.
  - Leer providers y models de `context.data.location.provider/model.list(location)`
    y el modelo activo de `context.ui.model.current()`.
  - Registrar el comando `/toggle-costs` con `context.keymap.layer(...)`.
  - Mapear los colores a los tokens de `context.theme` (`text.base`, `text.muted`,
    `text.faint`, `text.feedback.*`, `text.action.*`).
- Compartir la lógica de coste entre los adaptadores V1 y V2 (una sola
  implementación de cálculo, extraída y testeable).
- Mantener el comportamiento V1 actual sin regresiones.
- Actualizar dependencias/peers para V2 (`@opentui/solid` y `@opentui/core`
  `>= 0.5.8`) y documentar en el README la compatibilidad V1/V2.

## Capabilities

### New Capabilities
- `tui-plugin`: comportamiento del panel de costes como plugin TUI, incluyendo
  su carga tanto en OpenCode V1 como V2 y la información que muestra.

### Modified Capabilities

## Impact

- `tui.tsx` (fuente) y `tui.js` (compilado): nuevo `default` export dual y rama
  `setup` para V2; refactor para compartir cómputo y render entre V1 y V2.
- `build-tui.mjs`: sin cambios de mecanismo, pero el bundle debe conservar
  `@opentui/*` y `solid-js` como imports "bare" (los reescribe el host).
- `package.json`: bump de `@opentui/solid`/`@opentui/core` a `>=0.5.8`; posible
  devDependency `@opencode/plugin` para los tipos del contexto V2 (o tipos
  locales equivalentes).
- `test/`: tests del cómputo compartido y de la forma del módulo dual.
- `README.md`: nota de compatibilidad V1/V2.
- No cambia el entrypoint server ni el comando `init`.
