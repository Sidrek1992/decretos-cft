# Campos R.A. y Emite Editables - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar los campos R.A. (Responsable Administrativo) y Emite como inputs de texto editables en el formulario, antes del botón de envío, pre-rellenos con los valores por defecto `MGA` y `mga`.

**Architecture:** Cambio puramente de UI en `PermitForm.tsx`. El estado (`ra`, `emite`) ya existe en `PermitFormData` y en `initialState`. Solo se necesita renderizar los inputs que enlacen con ese estado existente mediante el `handleChange` que ya existe. No hay cambios en servicios, parsers ni tipos.

**Tech Stack:** React 19, TypeScript, Tailwind CSS

---

### Task 1: Agregar los inputs de R.A. y Emite en PermitForm.tsx

**Files:**
- Modify: `components/PermitForm.tsx:1106`

**Contexto:** El archivo tiene 1127 líneas. El bloque a insertar va entre la línea 1104 (`</div>` que cierra el `)}` de FL) y la línea 1106 (comentario `{/* ===================== BOTÓN SUBMIT ===================== */}`).

El formulario usa `handleChange` genérico para todos los inputs con `name` igual al campo del estado, y el estado ya tiene `ra: 'MGA'` y `emite: 'mga'` en `initialState` (líneas 88-89). El `handleChange` ya maneja strings correctamente.

**Step 1: Leer el area a modificar para confirmar contexto exacto**

```bash
# Leer líneas 1100-1115 para confirmar el punto de inserción
```

Expected: Ver el cierre del bloque FL (`</div>` + `)}`) en línea ~1104 y el comentario del botón submit en línea 1106.

**Step 2: Insertar el bloque de R.A. y Emite**

Insertar el siguiente bloque entre la línea que cierra `)}` del bloque FL (línea 1104) y el comentario del botón submit (línea 1106).

Buscar exactamente este texto en el archivo:
```
          {/* ===================== BOTÓN SUBMIT ===================== */}
```

Reemplazar con:
```tsx
          {/* ===================== RESPONSABLE ADMINISTRATIVO ===================== */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Responsable Administrativo</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">R.A.</label>
                <input
                  type="text"
                  name="ra"
                  value={formData.ra}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Emite</label>
                <input
                  type="text"
                  name="emite"
                  value={formData.emite}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-xl font-black text-slate-800 dark:text-white outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* ===================== BOTÓN SUBMIT ===================== */}
```

**Step 3: Verificar que el archivo compila sin errores TypeScript**

```bash
npx tsc --noEmit
```

Expected: Sin errores. Si hay errores de tipo, verificar que `handleChange` en el formulario acepta `React.ChangeEvent<HTMLInputElement>` (ya debería, pues los otros inputs de texto lo usan así).

**Step 4: Verificar en el navegador**

```bash
npm run dev
```

- Abrir el formulario
- Verificar que los campos "R.A." y "Emite" aparecen al final, antes del botón, con valores `MGA` y `mga`
- Modificar los valores y generar un decreto de prueba (PA o FL)
- Verificar que el PDF generado usa los valores modificados (no los defaults)
- Limpiar/resetear el formulario y verificar que los campos vuelven a `MGA`/`mga`

**Step 5: Commit**

```bash
git add components/PermitForm.tsx docs/plans/2026-03-05-ra-emite-editables.md docs/plans/2026-03-05-ra-emite-editables-design.md
git commit -m "feat: agregar campos R.A. y Emite editables en formulario"
```
