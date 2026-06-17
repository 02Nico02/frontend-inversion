# Análisis técnico: rendimiento mínimo esperado

Fecha de análisis: 2026-06-17

## Objetivo

Definir cómo debería construirse la funcionalidad de **mínimo esperado de rendimiento** para el frontend `frontend-inversion`, usando el Excel real que importa la app en:

`C:\Users\ika22\OneDrive\Documentos\Historial Sueldo.xlsm`

Este documento **no implementa cambios**. Solo resume:

- qué tablas existen realmente en el Excel,
- cuáles usa hoy el proyecto,
- dónde falta integración,
- cómo conviene modelar el nuevo cálculo,
- qué fórmula usar,
- dónde mostrarlo en la UI,
- y qué casos límite hay que contemplar.

---

## Resumen ejecutivo

El libro Excel sí contiene las tablas necesarias para construir una métrica de rendimiento mínimo esperado, pero el proyecto hoy **no las usa todas de forma funcional**.

Hallazgos principales:

1. `TablaCalendario` existe en el libro, pero **no aparece usada en el código** del frontend.
2. `Tabla13` sí se importa y se mapea como tabla de ventas/salidas, pero el campo `objetivo mínimo` quedó **solo parseado**, no consumido por ninguna lógica de negocio.
3. `Tabla6` es la base operativa de compras/posiciones y hoy se usa como fuente principal de inversiones.
4. Para un cálculo correcto de rendimiento mínimo esperado, no conviene usar `Tabla13` sola ni tomar el último valor encontrado: hay que **calcular por período y por moneda**, y separar:
   - inflación,
   - plazo fijo / TNA,
   - money market / remunerada,
   - objetivo mínimo del Excel como validación, no como fuente principal.

Conclusión corta: **la app tiene la base para leer el Excel, pero falta una capa de normalización y cálculo específica para benchmarks mínimos**.

---

## Qué hay realmente en el Excel

La inspección del libro mostró estas hojas y tablas relevantes:

### Hoja `inversiones`

- `Tabla6`
  - columnas: `ID`, `Fecha`, `ESPECIE`, `MONEDA`, `CANT.`, `PREC. COMP.`, `TOTAL`, `PREC. ACT.`, `VALORI. ACT.`, `VARIACIÓN`, `Var_cuenta_rem_%`, `Valor_cuenta_rem`, `Monto`, `TEM`, `TNA`, `TOP`, `TENDENCIA`
- `Tabla13`
  - columnas: `Fecha Com.`, `Fecha Vent.`, `ESPECIE`, `MONEDA`, `CANT.`, `PREC. COMP.`, `TOTAL`, `PREC.en V.`, `VALORI. ACT.`, `VARIACIÓN`, `Columna1`, `Monto`, `objetivo mínimo`
- `TablaPosiciones`
  - columnas: `ESPECIE`, `MONEDA`, `TIPO`, `CANTIDAD`, `TOTAL INV`, `PRECIO ACT`, `TOTAL ACTUAL`, `RESULTADO $`, `RESULTADO %`, `PRECIO PROM`
- `Tabla9`
  - columnas: `MES`, `TOTAL DEL MES`, `ACUMULADO`, `Val. Inicio`, `VARIACIÓN %`, `REND. REAL`
- `Tabla47`, `Tabla48`, `ObjetivosPorEspecie`, `Tabla11`, `Tabla7`, `Tabla4`, `tblRestarDigitos`

### Hoja `Registro`

- `TablaCalendario`
  - columnas: `Fecha`, `TNA`, `Rend_diaria`, `Indice`
- `TablaCalendarioRem`
  - columnas: `Fecha`, `TNA`, `Rend_diaria`, `Indice`
- `TablaCalendarioInf`
  - columnas: `Fecha`, `Mes`, `Inflación mensual`, `Días del mes`, `Rend_diaria_inf`, `Indice_inf`
- `Tabla34`, `Tabla46`

### Hoja `tabla dinamica`

- `EspeciesEnCaida_5D`
- `EspeciesEnRecuperacion_5D`
- `EspeciesEnCaida_30D`
- `EspeciesEnRecuperacion_30D`
- `Tabla47`
- `AlertasSuperoElMaximo`
- `AlertasDebajoDelMinimo`

### Hoja `Historial Inversiones`

- `Tabla35`
- `Tabla39`
- `Tabla38`

---

## Qué usa hoy el proyecto

### 1. Importación del Excel

El importador sí detecta las tablas del libro por nombre y las carga como `WorkbookTableData`.

Referencia:

- [`src/app/core/services/excel-import.service.ts`](src/app/core/services/excel-import.service.ts)
- [`src/app/core/services/workbook-mapping.service.ts`](src/app/core/services/workbook-mapping.service.ts)

### 2. Mapeo funcional actual

El proyecto consume activamente:

- `Tabla6` como operaciones,
- `Tabla13` como ventas/sales,
- `TablaPosiciones` como posiciones,
- `Tabla5` como histórico de precios,
- `Tabla14` como balance diario,
- `HistorialMensualReconstruido` como resumen mensual,
- `Tabla9` como performance mensual,
- `Tabla35` como split estratégico,
- `Tabla38` como distribución por plataforma.

### 3. Qué no se usa hoy

No encontré referencias en el código para:

- `TablaCalendario`,
- `TablaCalendarioRem`,
- `TablaCalendarioInf`.

Eso significa que esas tablas **existen en el Excel**, pero hoy no intervienen en cálculos ni en la UI.

---

## TablaCalendario: estado real

### ¿Se importa?

Sí, el importador detecta la tabla porque recorre todas las tablas del workbook.

### ¿Se mapea?

No hay un mapeo de negocio ni un modelo específico para `TablaCalendario` en el frontend.

### ¿Se usa?

No encontré referencias de uso en el código.

### Conclusión

`TablaCalendario` está disponible como dato crudo, pero **no forma parte de la capa de cálculo actual**.  
Si se quiere usar para benchmarks de plazo fijo o money market, hay que agregar una capa nueva de normalización y cálculo.

---

## Tabla6: rol actual

`Tabla6` es la tabla operativa principal.

La app hoy la usa para:

- construir operaciones,
- derivar posiciones cuando hace falta,
- alimentar alertas y exportaciones,
- identificar nuevas posiciones recientes.

Campos relevantes:

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

Campos que hoy están en el Excel pero no deberían ser la base del nuevo cálculo:

- `TEM`
- `TNA`
- `TOP`
- `TENDENCIA`

Esos campos sirven como contexto, pero no deberían ser el motor del cálculo de rendimiento mínimo esperado.

### Observación técnica

Si el objetivo es comparar un rendimiento mínimo contra inflación / plazo fijo / money market, `Tabla6` debe aportar:

- moneda,
- monto invertido,
- especie,
- fechas.

No debería aportar por sí sola la tasa benchmark.

---

## Tabla13: rol actual y limitación

`Tabla13` se mapea como tabla de ventas / movimientos con estas columnas:

- `Fecha Com.`
- `Fecha Vent.`
- `ESPECIE`
- `MONEDA`
- `CANT.`
- `PREC. COMP.`
- `TOTAL`
- `PREC.en V.`
- `VALORI. ACT.`
- `VARIACIÓN`
- `Columna1`
- `Monto`
- `objetivo mínimo`

### Qué hace hoy el código

El parser:

- lee la tabla,
- convierte fechas,
- convierte importes,
- y guarda `minimumObjective`.

Pero ese valor:

- no aparece consumido por cálculos,
- no se usa para validar rendimientos,
- no se muestra como benchmark funcional.

### Riesgo de diseño

Si `Tabla13` representa filas con ventas parciales o cierres parciales de lotes, el cálculo por fila puede confundir:

- rendimiento de la posición,
- rendimiento de un lote,
- rendimiento de una venta parcial,
- objetivo mínimo por operación.

### Conclusión

`Tabla13` es útil para la nueva funcionalidad, pero **no como única fuente**.  
El `objetivo mínimo` conviene tratarlo como **dato de validación** y no como benchmark principal.

---

## Relación entre posición, lote y venta parcial

Hoy el modelo del frontend no tiene un identificador formal de lote.

Eso implica que, si una especie tuvo varias compras y luego ventas parciales:

- no existe una clave de lote estable,
- no hay FIFO/LIFO explícito en el modelo,
- no se puede atribuir un mínimo esperado exacto por lote sin una regla adicional.

### Riesgo

Si se calcula rendimiento mínimo por especie sin separar lotes:

- una venta parcial puede inflar o reducir el rendimiento aparente,
- puede haber doble conteo de inversión o de salida,
- el `objetivo mínimo` del Excel puede quedar desalineado con la realidad operativa.

### Recomendación

Para esta funcionalidad nueva:

1. Si la fila representa una operación cerrada completa, usar la fila como unidad mínima.
2. Si hay parciales, introducir una regla explícita:
   - FIFO por compras,
   - o lote sintético por `ESPECIE + Fecha Com. + Cantidad + MONEDA`.
3. Si no se puede determinar el lote con seguridad, mostrar el dato como estimado o en estado de revisión.

---

## Propuesta de modelo TS

Sugerencia de modelo conceptual:

```ts
interface MinimumExpectedPerformanceRow {
  symbol: string;
  currency: 'ARS' | 'USD' | string;
  startDate: string | null;
  endDate: string | null;
  investedAmount: number | null;
  workbookMinimumObjective: number | null;
  inflationBenchmarkPercent: number | null;
  fixedDepositBenchmarkPercent: number | null;
  moneyMarketBenchmarkPercent: number | null;
  expectedMinimumPercent: number | null;
  sourceTables: string[];
  status: 'ok' | 'warning' | 'review';
  notes: string[];
}
```

### Qué debería representar

- `inflationBenchmarkPercent`: inflación acumulada del período.
- `fixedDepositBenchmarkPercent`: benchmark equivalente de plazo fijo.
- `moneyMarketBenchmarkPercent`: benchmark equivalente de money market / remunerada.
- `expectedMinimumPercent`: el piso recomendado para ese período.
- `workbookMinimumObjective`: el objetivo mínimo que ya trae `Tabla13`, sólo para contrastar.

---

## Fórmula recomendada

### Principio

El mínimo esperado no debería salir de un único dato del Excel.  
Debería ser el **máximo conservador** entre los benchmarks comparables del mismo período y moneda.

### Fórmula sugerida

Para un período dado:

```text
expectedMinimumPercent = max(
  inflationPeriodPercent,
  fixedDepositPeriodPercent,
  moneyMarketPeriodPercent
)
```

### Cómo usar `Tabla13.objetivo mínimo`

`Tabla13.objetivo mínimo` no debería reemplazar el cálculo.

Debe usarse así:

```text
if workbookMinimumObjective exists:
    compare workbookMinimumObjective vs expectedMinimumPercent
    flag difference if the gap is relevante
```

### Si querés un resultado más estricto

También se puede mostrar:

```text
recommendedFloor = max(expectedMinimumPercent, workbookMinimumObjective)
```

pero eso sólo sirve si el objetivo del Excel se considera siempre válido.  
Si el Excel tiene valores manuales o parciales, es mejor **comparar** que **fusionar**.

---

## Qué fuente usar para cada benchmark

### Inflación

Fuente sugerida:

- `TablaCalendarioInf`
- y/o `HistorialMensualReconstruido` en su columna `Inflación %`

Uso:

- calcular inflación acumulada del período,
- luego convertir a rendimiento comparable.

### Plazo fijo

Fuente sugerida:

- `TablaCalendario`

Uso:

- tomar `TNA` o `Indice`,
- convertir el período a tasa acumulada o mensual equivalente.

### Money market / remunerada

Fuente sugerida:

- `TablaCalendarioRem`

Uso:

- usar la misma lógica temporal que plazo fijo,
- pero con el benchmark que represente la cuenta remunerada o fondo money market.

### `Tabla13.objetivo mínimo`

Uso:

- validación,
- comparación,
- alerta de desvío.

No debería ser la fuente principal del benchmark mínimo.

---

## Dónde mostrarlo en la UI

### 1. Página de `Decisiones`

Es el lugar más natural para mostrar:

- benchmark mínimo esperado,
- inflación,
- plazo fijo,
- money market,
- comparación contra `objetivo mínimo`.

### 2. Detalle de especie

Útil para cada posición:

- mínimo esperado de la especie,
- benchmark aplicado,
- diferencia contra `Tabla13.objetivo mínimo`.

### 3. `Datos a revisar`

Si la diferencia entre benchmark y `objetivo mínimo` supera un umbral, mostrarlo como hallazgo.

### 4. Exportación para ChatGPT

Agregarlo al contexto exportado para que el análisis posterior tenga:

- benchmark usado,
- fuente,
- período,
- diferencia.

---

## Casos límite que hay que contemplar

1. **Ventas parciales**
   - riesgo de atribución incorrecta por lote.

2. **Cambios de moneda**
   - no mezclar ARS y USD sin conversión explícita.

3. **Tablas con fechas incompletas**
   - si falta inicio o fin, no calcular y marcar revisión.

4. **Meses sin inflación o sin tasa**
   - usar la serie auxiliar más cercana o marcar N/D.

5. **Tasas expresadas como decimal o porcentaje**
   - normalizar antes de calcular.

6. **Duplicados de fecha**
   - consolidar por fecha antes de compounding.

7. **Datos de Excel con escala dudosa**
   - si `TNA`, `Indice` o `objetivo mínimo` vienen en escalas extrañas, advertir y no ocultarlo.

8. **Objetivo mínimo vacío**
   - tratarlo como dato opcional, no como error fatal.

---

## Validación contra `Tabla13.objetivo mínimo`

Recomendación de validación:

1. Calcular el benchmark mínimo esperado para el mismo período.
2. Leer `Tabla13.objetivo mínimo`.
3. Comparar ambos valores.
4. Clasificar:
   - `ok` si están cercanos,
   - `warning` si hay desvío relevante,
   - `review` si falta alguno de los dos.

### Umbral sugerido

No fijar un umbral rígido todavía.  
Primero conviene ver la dispersión real del archivo y luego definir un margen razonable.

---

## Recomendación final

La implementación correcta no debería salir de una sola tabla.

### Orden recomendado de trabajo

1. Crear una capa de cálculo nueva para benchmarks mínimos.
2. Normalizar `TablaCalendario`, `TablaCalendarioRem` y `TablaCalendarioInf`.
3. Usar `Tabla6` como base operativa.
4. Usar `Tabla13` sólo para contraste de objetivos mínimos y cierre de operaciones.
5. Mostrar el resultado en `Decisiones`, detalle de especie y `Datos a revisar`.

### Recomendación de producto

No mostrar sólo “un porcentaje mínimo”.
Mostrar:

- benchmark de inflación,
- benchmark de plazo fijo,
- benchmark de money market,
- `objetivo mínimo` del Excel,
- y una comparación clara entre todos.

Eso deja el cálculo más auditable y evita tomar decisiones sobre una sola referencia que podría no representar el caso real.

---

## Estado actual del proyecto respecto a este análisis

- `TablaCalendario` está en el libro, pero no en uso funcional.
- `Tabla13` está mapeada, pero su `objetivo mínimo` no se consume.
- `Tabla6` sí es una base activa de negocio.
- La app tiene buena base para extenderse, pero falta la capa específica de benchmarks mínimos.

