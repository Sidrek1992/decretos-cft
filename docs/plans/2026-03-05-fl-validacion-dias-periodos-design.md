# Diseño: Validación de consistencia días FL vs períodos

**Fecha:** 2026-03-05  
**Estado:** Aprobado

## Problema

Al emitir una resolución de Feriado Legal (FL), el sistema no valida que los "Días Solicitados" del bloque superior ("Datos del Feriado Legal") sean iguales a la suma de los días solicitados en los períodos. Un usuario puede ingresar valores inconsistentes (ej: 10 días en el feriado pero P1=7 + P2=2 = 9) y el sistema los acepta.

## Solución

Agregar una validación en `handleSubmit` de `PermitForm.tsx`, dentro del bloque FL existente (líneas 561–605), **después** del check de saldo insuficiente. La validación compara `cantidadDias` con `solicitadoP1 + (hasPeriod2 ? solicitadoP2 : 0)`.

## Reglas de validación

| Condición | Regla |
|---|---|
| Solo Período 1 activo (`periodo2` vacío) | `cantidadDias === solicitadoP1` |
| Período 1 y 2 activos (`periodo2` no vacío) | `cantidadDias === solicitadoP1 + solicitadoP2` |

Si no se cumple → bloquear envío con `setFormError` + marcar `errors.cantidadDias`.

## Mensajes de error

- **1 período:** `"Los días del feriado (X) no coinciden con los días solicitados en el Período 1 (X)."`
- **2 períodos:** `"Los días del feriado (X) no coinciden con la suma de los períodos: P1 (X) + P2 (X) = X."`

## Posición en el flujo de validación FL

1. `fechaTermino` requerida *(ya existe)*
2. `periodo1` requerido *(ya existe)*
3. Consistencia P2 *(ya existe)*
4. `fechaTermino >= fechaInicio` *(ya existe)*
5. `cantidadDias == días hábiles entre fechas` *(ya existe)*
6. Saldo suficiente en P1 y P2 *(ya existe)*
7. **`cantidadDias == solicitadoP1 + solicitadoP2`** ← nuevo, va aquí

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `components/PermitForm.tsx` | Agregar bloque de validación en `handleSubmit` ~línea 605 |

No se requieren cambios en tipos, parsers, servicios ni tests existentes.
