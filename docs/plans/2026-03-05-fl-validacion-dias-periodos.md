# Validación FL: consistencia días vs períodos - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Al emitir una resolución FL, validar que `cantidadDias` sea igual a `solicitadoP1` (1 período) o `solicitadoP1 + solicitadoP2` (2 períodos). Bloquear el envío si no coinciden.

**Architecture:** Agregar un bloque de validación dentro del bloque FL de `handleSubmit` en `PermitForm.tsx`, después del check de saldo insuficiente (línea 604) y antes del cierre `}` del bloque FL (línea 605). Mismo patrón que todas las validaciones FL existentes: `setFormError` + `setErrors` + `return`.

**Tech Stack:** React 19, TypeScript

---

### Task 1: Agregar validación de consistencia días vs períodos en handleSubmit

**Files:**
- Modify: `components/PermitForm.tsx:600-605`

**Contexto exacto del archivo:**

El bloque FL de `handleSubmit` va de línea 562 a 605. Las variables `hasPeriod2`, `saldoP1` y `saldoP2` ya están declaradas en líneas 563-565 y pueden reutilizarse. El punto de inserción es entre el cierre del bloque de saldo insuficiente (línea 604) y el cierre `}` del bloque FL (línea 605).

**Código actual en líneas 600-605:**
```typescript
      if (saldoP1 < 0 || (hasPeriod2 && saldoP2 < 0)) {
        setFormError(`Saldo FL insuficiente. Resultado: P1 ${saldoP1.toFixed(1)}${hasPeriod2 ? ` | P2 ${saldoP2.toFixed(1)}` : ''}.`);
        setErrors({ ...newErrors, cantidadDias: 'Saldo FL insuficiente' });
        return;
      }
    }
```

**Step 1: Leer el área exacta para confirmar contexto**

Leer `components/PermitForm.tsx` líneas 598-607 para confirmar el texto exacto antes de editar.

**Step 2: Insertar la validación**

Buscar este texto exacto:
```typescript
      if (saldoP1 < 0 || (hasPeriod2 && saldoP2 < 0)) {
        setFormError(`Saldo FL insuficiente. Resultado: P1 ${saldoP1.toFixed(1)}${hasPeriod2 ? ` | P2 ${saldoP2.toFixed(1)}` : ''}.`);
        setErrors({ ...newErrors, cantidadDias: 'Saldo FL insuficiente' });
        return;
      }
    }
```

Reemplazar con:
```typescript
      if (saldoP1 < 0 || (hasPeriod2 && saldoP2 < 0)) {
        setFormError(`Saldo FL insuficiente. Resultado: P1 ${saldoP1.toFixed(1)}${hasPeriod2 ? ` | P2 ${saldoP2.toFixed(1)}` : ''}.`);
        setErrors({ ...newErrors, cantidadDias: 'Saldo FL insuficiente' });
        return;
      }

      const totalSolicitadoPeriodos = (formData.solicitadoP1 || 0) + (hasPeriod2 ? (formData.solicitadoP2 || 0) : 0);
      if (Number(formData.cantidadDias) !== totalSolicitadoPeriodos) {
        const diasFeriado = Number(formData.cantidadDias);
        const p1 = formData.solicitadoP1 || 0;
        const p2 = hasPeriod2 ? (formData.solicitadoP2 || 0) : null;
        const mensajePeriodos = p2 !== null
          ? `P1 (${p1}) + P2 (${p2}) = ${totalSolicitadoPeriodos}`
          : `Período 1 (${p1})`;
        setFormError(`Los días del feriado (${diasFeriado}) no coinciden con los días solicitados en los períodos: ${mensajePeriodos}.`);
        setErrors({ ...newErrors, cantidadDias: 'No coincide con períodos' });
        return;
      }
    }
```

**Step 3: Verificar TypeScript sin errores**

```bash
npx tsc --noEmit
```

Expected: Sin output (sin errores).

**Step 4: Verificar tests existentes pasan**

```bash
npm test
```

Expected: 45 passed, 45 total (o más si hay nuevos). Sin failures.

**Step 5: Commit**

```bash
git add components/PermitForm.tsx docs/plans/2026-03-05-fl-validacion-dias-periodos.md docs/plans/2026-03-05-fl-validacion-dias-periodos-design.md
git commit -m "feat: validar consistencia días FL vs suma de períodos al emitir"
```
