# Mapeo real del Excel

Este documento resume las tablas que consume el frontend y cómo se interpretan hoy.

## Fuente de verdad

- El Excel local sigue siendo la única fuente de verdad.
- El frontend no persiste datos ni los recalcula fuera del workbook.
- Las tablas se detectan desde el workbook real, no por nombres simulados.

## Tablas críticas

### `TablaPosiciones`

- Hoja: `inversiones`
- Uso:
  - posiciones actuales consolidadas;
  - cards principales;
  - tabla operativa;
  - total actual;
  - total invertido;
  - resultado;
  - peso por especie.
- Columnas esperadas:
  - `ESPECIE`
  - `MONEDA`
  - `TIPO`
  - `CANTIDAD`
  - `TOTAL INV`
  - `PRECIO ACT`
  - `TOTAL ACTUAL`
  - `RESULTADO $`
  - `RESULTADO %`
  - `PRECIO PROM`
- Nota:
  - `TIPO` se interpreta como `positionType`.
  - La clasificación de negocio por activo viene de `Tabla47` y se expone como `assetType`.

### `Tabla6`

- Hoja: `inversiones`
- Uso:
  - operaciones/compras por especie;
  - detalle de lotes en drawer;
  - análisis por compra.
- Columnas esperadas:
  - `ID`
  - `Fecha`
  - `ESPECIE`
  - `MONEDA`
  - `CANT.`
  - `PREC. COMP.`
  - `TOTAL`
  - `PREC. ACT.`
  - `VALORI. ACT.`
  - `VARIACIÓN`
  - `Var_cuenta_rem_%`
  - `Valor_cuenta_rem`
  - `Monto`
  - `TEM`
  - `TNA`
  - `TOP`
  - `TENDENCIA`

### `Tabla5`

- Hoja: `Historial Inversiones`
- Uso:
  - precios históricos;
  - gráfico por especie;
  - máximos y mínimos;
  - variación por período;
  - histórico dentro del drawer.
- Columnas esperadas:
  - `FECHA`
  - `MES`
  - `ESPECIE`
  - `PRECIO`

### `Tabla14`

- Hoja: `Historial Inversiones`
- Uso:
  - evolución diaria;
  - gráfico de serie histórica.
- Columnas esperadas:
  - `FECHA`
  - `MES`
  - `BALANCE`

#### Observación sobre `BALANCE`

La app hoy lo trata como una serie de evolución diaria. En la interfaz se muestra como `Evolución diaria` para no asumir más de lo que el workbook confirma.

### `Tabla47`

- Hoja: `Alertas` o la hoja donde el workbook la exponga.
- Uso:
  - clasificación de especies;
  - tipo de activo;
  - sector;
  - subsector;
  - región;
  - monto esperado;
  - desvío vs esperado.
- Columnas esperadas:
  - `ESPECIE`
  - `VALORI. ACT.`
  - `Monto`
  - `Esperado`
  - `TIPO`
  - `SECTOR`
  - `SUBSECTOR`
  - `REGION`
- Nota:
  - `TablaPosiciones.TIPO` = tipo técnico de posición.
  - `Tabla47.TIPO` = tipo de activo.

### `ObjetivosPorEspecie`

- Hoja: `inversiones`
- Uso:
  - alertas manuales por especie.
- Columnas esperadas:
  - `Especie`
  - `Condición`
  - `Precio objetivo`
  - `Notas`
  - `Estado`

### Señales 5D / 30D

- Tablas:
  - `AlertasEspeciesEnCaida_5D`
  - `EspeciesEnRecuperacion_5D`
  - `EspeciesEnCaida_30D`
  - `EspeciesEnRecuperacion_30D`
- Uso:
  - señales recientes;
  - caídas;
  - recuperaciones.
- Columnas esperadas:
  - `ESPECIE`
  - `Fecha Inicio`
  - `Precio Inicio`
  - `Fecha Fin`
  - `Precio Fin`
  - `Variación %`

### `Tabla35`

- Hoja: `graficos`
- Uso:
  - split estratégico;
  - retiro/jubilación vs ahorro;
  - largo plazo vs mediano plazo.
- Columnas esperadas:
  - `FECHA`
  - `VALOR AR`
  - `VALOR USD`
  - `% JUBILACIÓN`
  - `% AHORRO`
  - `MONTO JUB. AR`
  - `MONTO JUB. USD`
  - `MONTO AHOR. AR`
  - `MONTO AHOR. USD`

#### Observación sobre escala

La escala de `Tabla35` requiere revisión si aparecen montos muy bajos frente al resto del portafolio. El frontend la trata como una fuente útil pero no totalmente confiable para tomar decisiones cuantitativas hasta validar su unidad.

### `HistorialMensualReconstruido`

- Hoja: `Historial Inversiones`
- Uso futuro:
  - análisis mensual;
  - rendimiento real;
  - compras;
  - ventas;
  - inflación;
  - tipo de mes.

### `Tabla60`

- Hoja: `Historial Inversiones`
- Uso futuro:
  - análisis anual;
  - rendimiento anual;
  - rendimiento real;
  - compras;
  - ventas;
  - inflación.

## Mapeo interno importante

- `positionType` proviene de `TablaPosiciones.TIPO`.
- `assetType` proviene de `Tabla47.TIPO`.
- `currency` siempre se normaliza a `ARS`, `USD` o `UNKNOWN`.
- Las fechas pasan por normalización antes de llegar a los componentes visuales.

## Tablas opcionales

- `AlertasSuperoElMaximo`
- `AlertasDebajoDelMinimo`
- `EspeciesEnCaida_5D`
- `EspeciesEnRecuperacion_5D`
- `EspeciesEnCaida_30D`
- `EspeciesEnRecuperacion_30D`
- `HistorialMensualReconstruido`
- `Tabla60`
- `Tabla35`
- `Tabla38`
- `Tabla39`

