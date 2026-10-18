# Spec Delta

## MODIFIED Requirements

### Requirement: Ranking por consumo de cuota

El plugin SHALL ordenar los modelos por tasa de consumo de cuota (coste mezclado
por 1M de tokens dividido por el límite de uso del modelo) relativa al modelo
base, y SHALL colorear cada multiplicador por umbral en los runtimes V1 y V2, sea
cual sea la representación de los tokens del tema (cadenas de color o valores de
color RGBA, incluidos los tokens stateful con `base`).

#### Scenario: Orden y color por umbral

- **WHEN** el panel muestra los modelos
- **THEN** se ordenan de menor a mayor consumo relativo y el color es verde con
  `≤1.5x`, amarillo con `≤5x` y rojo con `>5x`

#### Scenario: Color en OpenCode V2 con tokens no textuales

- **WHEN** el tema de V2 entrega los tokens como valores de color RGBA y algunos
  como envoltorios stateful (`base`, `hovered`, …)
- **THEN** cada multiplicador, nombre, marca y cabecera se dibuja con el color
  resuelto del tema, sin quedar en el color por defecto del terminal

#### Scenario: Token de tema en texto o ausente

- **WHEN** un token del tema es una cadena de color, o el tema no entrega el token
- **THEN** el plugin usa la cadena tal cual y, si el token falta, cae al color por
  defecto sin romper el render

#### Scenario: Modelo sin datos

- **WHEN** un modelo no tiene precio o no tiene límite de uso documentado
- **THEN** se muestra con `?` y se ordena al final, sin multiplicador numérico

#### Scenario: Modelo ilimitado y modelo reciente

- **WHEN** un modelo es gratuito/ilimitado o se publicó en los últimos 30 días
- **THEN** el primero muestra `0.0x` y el segundo lleva la marca `✦`
