# Tasks

## 1. Núcleo puro compartido

- [x] 1.1 Extraer a un módulo puro (sin JSX ni API de runtime) `buildCostItems({ providers, models, limits, activeModel })` que devuelva `{ items, baseline }`, verificando que el panel V1 sigue mostrando el mismo resultado
- [x] 1.2 Extraer `loadUsageLimits` (fetch + caché 12h) y las utilidades de parseo/normalización a funciones puras o inyectables, verificando con tests que no dependen del runtime
- [x] 1.3 Añadir tests del núcleo en `test/` (orden por burn, colores por umbral ≤1.5/≤5/>5, `?` para sin datos, `0.0x` para ilimitado, `✦` para recientes), verificando con `npm test`

## 2. Entrypoint TUI dual (V1)

- [x] 2.1 Cambiar el `default` export de `tui.tsx` a `{ id, tui, setup }` manteniendo la rama V1 intacta, verificando que el build genera `tui.js` con las tres claves
- [x] 2.2 Añadir test de la forma del módulo: `id` string no vacío, `tui` función y `setup` función, y una comprobación que replica `isPlugin` de V2 (`id` + `setup`), verificando con `npm test`
- [x] 2.3 Verificar que `tui.js` conserva los imports "bare" de `@opentui/*` y `solid-js` (grep sobre el bundle) para que el host los reescriba

## 3. Adaptador V2 (`setup`)

- [x] 3.1 Añadir `tui-v2-types.ts` con los tipos locales del `Context`/`Definition` de V2 (`ui.slot`, `data.location.provider/model`, `ui.model.current`, `storage.store`, `keymap.layer`, `theme`), verificando que solo se usan como `import type`
- [x] 3.2 Implementar `setup(context)` que registre el panel vía `context.ui.slot({ append: "sidebar.content", render })` y devuelva el cleanup que libera el slot, verificando con el contrato de tipos y el build
- [x] 3.3 Mapear datos V2 a `CostItem` (`model.cost[0].input/output`, `model.time.released`, `model.providerID`) y el modelo activo desde `context.ui.model.current()`, verificando con un test unitario del mapeo
- [x] 3.4 Mapear el tema V2 (`theme.text.base/muted/faint`, `text.feedback.*`, acento) en un helper, verificando con tests de que cada uso resuelve un color
- [x] 3.5 Persistir `enabled`/`collapsed` con `context.storage.store("costs", { initial })` y registrar `/toggle-costs` con `context.keymap.layer(...)`, verificando que alternar cambia el estado observado

## 4. Empaquetado y dependencias

- [x] 4.1 Subir `@opentui/solid` a `>=0.5.8` y declarar peer `@opentui/core >=0.5.8`, verificando que `npm install` instala sin conflictos
- [x] 4.2 Verificar que `npm run build` recompila `tui.js` sin errores y que `npm pack --dry-run` incluye `tui.js` y el nuevo módulo de tipos si aplica

## 5. Documentación

- [x] 5.1 Actualizar `README.md` indicando compatibilidad con OpenCode V1 y V2 (entrypoint dual), verificando coherencia con las specs
- [x] 5.2 Documentar en el README que tras actualizar hay que reiniciar OpenCode para que V2 cargue el panel

## 6. Verificación de integración

- [x] 6.1 Ejecutar `npm test` y confirmar que toda la suite pasa
- [x] 6.2 Cargar el `tui.js` compilado e importar el `default`, confirmando que satisface a la vez el predicado V1 (`id` string + `tui` función) y el de V2 (`id` string no vacío + `setup` función), replicados literalmente en el test
- [x] 6.3 Si hay un binario V2 disponible (`OPENCODE_BIN`), arrancar con un config temporal apuntando al plugin y confirmar que no aparece `Invalid V2 TUI plugin module` en logs
