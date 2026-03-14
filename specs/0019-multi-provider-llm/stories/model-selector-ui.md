# User Story: Selector de modelos en el chat

## Summary

**As a** usuario del chat de agentes,
**I want** un selector de modelos visible en el chat que me permita elegir el proveedor y modelo a usar,
**So that** puedo controlar con qué LLM trabaja el agente antes de enviar cada mensaje.

## Description

Crear el componente `ModelSelector` que se inserta en el área de input del chat de cada agente. Al montar, consulta `GET /api/providers/models` para obtener el listado dinámico. Muestra los modelos agrupados por proveedor. La selección activa se propaga al componente padre (`ChatInterface`) y se incluye en el body de cada petición a `/api/agent/run` como los campos `provider` y `model`. Mientras no haya una selección, el botón de envío está deshabilitado.

## Acceptance Criteria

- [ ] Dado que el usuario abre el chat de un agente, cuando el componente monta, entonces se llama a `/api/providers/models` y se muestran los modelos disponibles agrupados por proveedor.
- [ ] Dado que hay modelos disponibles, cuando el usuario abre el selector, entonces ve secciones separadas por proveedor (ej. "Copilot" y "Vertex").
- [ ] Dado que el usuario no ha seleccionado un modelo, cuando intenta enviar un mensaje, entonces el botón de envío está deshabilitado y hay un placeholder que indica que debe seleccionar un modelo.
- [ ] Dado que el usuario selecciona un modelo, cuando hace clic en enviar, entonces la petición incluye `provider` y `model` en el body con los valores correctos.
- [ ] Dado que el endpoint de modelos falla o no hay proveedores configurados, cuando el selector carga, entonces muestra un mensaje de error o estado vacío sin romper la UI.
- [ ] Dado que el usuario selecciona un modelo, cuando cambia a otro agente y vuelve, entonces el modelo seleccionado se preserva durante la sesión del navegador.

## Tasks

- [ ] Crear `frontend/components/ModelSelector.tsx` como componente cliente con `"use client"`
- [ ] Implementar el fetch a `GET /api/backend/providers/models` al montar el componente (sin parámetros de auth)
- [ ] Crear `frontend/app/api/backend/providers/models/route.ts` como proxy Next.js hacia `http://localhost:3001/api/providers/models`
- [ ] Renderizar modelos agrupados por proveedor con un indicador visual del proveedor activo
- [ ] Emitir `onSelectionChange(provider: string, model: string)` cuando el usuario selecciona un modelo
- [ ] Integrar `ModelSelector` en `frontend/components/ChatInterface.tsx`, pasando la selección al hook `handleSubmit`
- [ ] Deshabilitar el botón de envío cuando `selectedProvider` o `selectedModel` sean nulos
- [ ] Mostrar un estado de loading mientras carga el listado de modelos
- [ ] Mostrar un estado de error si el fetch falla, con opción de reintentar
- [ ] Persistir la última selección `{ provider, model }` en `sessionStorage` bajo la clave `web_spec_selected_model` para mantenerla entre navegaciones dentro de la sesión
- [ ] Eliminar el campo `model` del formulario de edición de agentes en `frontend/app/admin/page.tsx`
- [ ] Verificar que `npx tsc --noEmit` en frontend no emite errores

## Dependencies

- Depends on: [provider-models-endpoint.md](provider-models-endpoint.md) — el endpoint debe existir para que el componente pueda cargar los modelos.
- Depends on: [remove-frontend-pat.md](remove-frontend-pat.md) — el selector no debe depender del PAT del contexto.

## Out of Scope

- No se implementa persistencia en `localStorage` (sólo `sessionStorage` durante la sesión activa).
- No se muestran metadatos adicionales de los modelos (descripción, límite de contexto, etc.).
- No se implementa búsqueda o filtro de modelos.

## Notes

- El componente debe usar los tokens de Tailwind del proyecto: `bg-surface-2`, `border-border`, `text-text-primary`, `text-accent`, etc.
- Íconos sugeridos de `lucide-react`: `Cpu` o `Zap` para el selector general, `ChevronDown` para el dropdown.
- La selección de modelo persiste en `sessionStorage` (no `localStorage`) para que se resetee al cerrar el navegador y no conflictúe con futuras instancias.
- Cuando el backend no tiene ningún proveedor configurado, mostrar: *"No hay proveedores de LLM configurados. Contacta al administrador."*
