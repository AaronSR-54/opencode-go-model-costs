# Proposal

## Why

Instalar el plugin hoy requiere que el usuario edite a mano el archivo de
configuración global de OpenCode (`~/.config/opencode/opencode.json`), conozca
la ruta exacta, respete el formato del arreglo `plugin` y no rompa el resto del
archivo (que puede ser JSONC con comentarios). Es un paso propenso a errores y
una fricción innecesaria para una herramienta pensada como "instalar y listo".

## What Changes

- Añadir un comando CLI `init` al paquete, distribuido mediante un `bin` en
  `package.json`, para invocarse como
  `npx @aaronsr-54/opencode-go-model-costs init`.
- El comando registra el propio paquete (`@aaronsr-54/opencode-go-model-costs`)
  dentro del arreglo `plugin` del config global de OpenCode.
- El destino por defecto es el config global del usuario, resolviendo
  `$XDG_CONFIG_HOME/opencode` (o `~/.config/opencode`) y detectando
  `opencode.json` u `opencode.jsonc`.
- Si no existe el archivo de config, se crea con el `$schema` de OpenCode y el
  arreglo `plugin` conteniendo el paquete.
- Si ya existe, se inserta el paquete preservando el resto del contenido y los
  comentarios (JSONC), sin duplicar la entrada si ya está presente.
- La operación es idempotente y reporta por consola el resultado; recuerda al
  usuario reiniciar OpenCode para que el plugin se cargue.
- Actualizar el `README.md` para documentar el nuevo comando `init` como vía de
  instalación recomendada (manteniendo la edición manual como alternativa).

## Capabilities

### New Capabilities
- `init-command`: comportamiento del comando CLI `init` que instala el plugin en
  el config global de OpenCode de forma idempotente y segura.

### Modified Capabilities

## Impact

- `package.json`: nuevo campo `bin` apuntando al script del comando; el script
  debe incluirse en `files` para publicarse.
- Nuevo archivo de entrada CLI (por ejemplo `bin/init.js`) con shebang,
  compatible con el paquete ESM (`"type": "module"`).
- Posible nueva dependencia para parsear/editar JSONC preservando comentarios
  (por ejemplo `jsonc-parser`), o una implementación propia mínima.
- `README.md`: nueva sección de instalación con `npx ... init`.
- No cambia el comportamiento del plugin TUI en tiempo de ejecución ni la
  superficie de la config más allá del alta del propio paquete.
