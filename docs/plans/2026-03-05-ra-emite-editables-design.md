# Diseño: Campos R.A. y Emite editables en el formulario

**Fecha:** 2026-03-05  
**Estado:** Aprobado

## Problema

Los campos `R.A.` (Responsable Administrativo) y `Emite` existen en el estado interno del formulario y se envían al generador de PDF, pero no son visibles ni editables en la interfaz. Se rellenan automáticamente con los valores `MGA` y `mga` por defecto. El usuario no puede modificarlos desde la UI.

## Solución

Agregar dos campos de texto editables al final del formulario (`PermitForm.tsx`), antes del botón "Generar Decreto", visibles para ambos tipos de solicitud (PA y FL).

## Diseño Visual

```
┌─────────────────────────────────────────────────────┐
│  Responsable Administrativo                          │
│  ┌────────────────────────┐  ┌─────────────────────┐ │
│  │ R.A.                   │  │ Emite               │ │
│  │ [MGA                 ] │  │ [mga              ] │ │
│  └────────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────┘
              [GENERAR DECRETO]
```

## Comportamiento

- Valor inicial: `MGA` y `mga` (ya definidos en `initialState` en `PermitForm.tsx:88-89`)
- Al resetear el formulario: vuelven a `MGA` y `mga`
- Visibles en PA y FL por igual
- Los valores modificados se usan directamente en la generación del PDF (ya funciona vía `record.ra` y `record.emite`)

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `components/PermitForm.tsx` | Agregar bloque visual con dos `<input type="text">` para `ra` y `emite` |

## Lo que NO cambia

- `services/pdfGenerator.ts` — ya usa `record.ra` y `record.emite`
- `utils/parsers/recordParser.ts` — ya tiene fallbacks a `MGA`/`mga`
- `types.ts` — `ra` y `emite` ya existen en `PermitFormData`
- `initialState` en `PermitForm.tsx` — ya tiene los defaults correctos
