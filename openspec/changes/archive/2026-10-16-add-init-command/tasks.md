# Tasks

## 1. Scaffolding y empaquetado

- [x] 1.1 Agregar `jsonc-parser` a `dependencies` en `package.json` y verificar que `npm install` termina sin errores
- [x] 1.2 Declarar el binario `"bin": { "opencode-go-model-costs": "./bin/init.js" }` y añadir `"bin"` a `files`, verificando que `npm pack --dry-run` lista `bin/init.js`
- [x] 1.3 Añadir un script `test` que corra `node --test` y verificar que `npm test` ejecuta el runner sin fallar por archivos inexistentes
- [x] 1.4 Crear `bin/init.js` con shebang `#!/usr/bin/env node` y un stub ESM, verificando que `node bin/init.js` ejecuta sin error de sintaxis

## 2. Lógica pura de edición del config

- [x] 2.1 Implementar `isInstalled(configText, pkg)` con normalización de sufijo `@version`, verificando con tests unitarios para entradas con y sin versión
- [x] 2.2 Implementar `addPackage(configText, pkg)` usando `jsonc-parser` (`parse`/`modify`/`applyEdits`) que agregue la entrada al arreglo `plugin` o lo cree si falta, verificando con tests
- [x] 2.3 Añadir tests en `test/` (con `node:test`) para: JSONC con comentarios y claves vecinas intactas, ausencia de la clave `plugin`, y JSON inválido que devuelve error sin sobrescribir; verificar con `npm test`

## 3. CLI `init`

- [x] 3.1 Implementar el parseo de argumentos: aceptar `init`, mostrar ayuda y salir con código distinto de cero ante subcomando ausente o desconocido, verificando manualmente ambos casos
- [x] 3.2 Implementar la resolución del directorio de config (`$XDG_CONFIG_HOME` o `~/.config`) y la selección `opencode.json` → `opencode.jsonc` → crear `opencode.json`, verificando con `HOME`/`XDG_CONFIG_HOME` temporales
- [x] 3.3 Implementar el flujo completo: leer, detectar idempotencia, crear/editar, escribir, e imprimir la ruta modificada y el recordatorio de reiniciar OpenCode con código de salida cero, verificando contra un config JSONC de prueba
- [x] 3.4 Implementar el manejo de error para config ilegible/inválido: no escribir, informar y salir con código distinto de cero, verificando con un archivo JSON corrupto

## 4. Documentación

- [x] 4.1 Actualizar `README.md` documentando `npx @aaronsr-54/opencode-go-model-costs init` como vía de instalación recomendada, verificando que el comando mostrado coincide con el `bin` real
- [x] 4.2 Mantener la edición manual del config como alternativa y aclarar el comportamiento idempotente y que requiere reiniciar OpenCode, verificando la coherencia con las specs

## 5. Verificación de integración

- [x] 5.1 Con un `XDG_CONFIG_HOME` temporal vacío, ejecutar `init`, confirmar el archivo creado, re-ejecutar y confirmar que no hay duplicados ni cambios
- [x] 5.2 Sobre un `opencode.jsonc` temporal con comentarios y otros plugins, ejecutar `init` y confirmar con diff que solo se agregó la entrada al arreglo `plugin`
- [x] 5.3 Ejecutar `npm test` y confirmar que toda la suite de tests pasa
