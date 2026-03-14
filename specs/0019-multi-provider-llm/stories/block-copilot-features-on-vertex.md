# User Story: Bloqueo de funciones Copilot-only cuando se usa Vertex

## Summary

**As a** usuario del chat de agentes,
**I want** que las funciones exclusivas de Copilot (como Copilot Spaces) se deshabiliten visualmente cuando selecciono un modelo de Vertex,
**So that** entiendo claramente qué funcionalidades están disponibles según el proveedor activo y no se envían datos que el backend ignorará.

## Description

Cuando el usuario selecciona un modelo de Vertex AI en el `ModelSelector`, el `SpaceSelector` debe deshabilitarse visualmente con un tooltip explicativo, y no debe enviar `spaceRefs` en el body del request. El WorkIQ context no está afectado por el proveedor (funciona con ambos). El backend también debe ignorar `spaceRefs` aunque lleguen cuando el provider es `vertex` (doble protección).

## Acceptance Criteria

- [ ] Dado que el usuario selecciona un modelo de Vertex, cuando el `SpaceSelector` se renderiza, entonces aparece con opacidad reducida y el cursor `not-allowed`.
- [ ] Dado que el usuario selecciona un modelo de Vertex y hace hover sobre el `SpaceSelector`, cuando el tooltip aparece, entonces muestra el texto: *"Copilot Spaces no está disponible con este proveedor"*.
- [ ] Dado que el usuario selecciona un modelo de Vertex, cuando hace clic en el `SpaceSelector`, entonces no se abre el dropdown y no se puede seleccionar ningún space.
- [ ] Dado que el usuario tenía spaces seleccionados y cambia a un modelo de Vertex, cuando se procesa el cambio de proveedor, entonces la selección de spaces se limpia automáticamente.
- [ ] Dado que el usuario tiene activo un modelo de Copilot, cuando el `SpaceSelector` se renderiza, entonces funciona con normalidad (comportamiento actual).
- [ ] Dado que el body del request incluye `spaceRefs` pero `provider === "vertex"`, cuando el backend procesa la petición, entonces `spaceRefs` se ignora y no se configura ningún MCP server de Copilot Spaces.
- [ ] El WorkIQ selector NO se deshabilita cuando se usa Vertex — sigue disponible independientemente del proveedor.

## Tasks

- [ ] Agregar la prop `providerIsVertex: boolean` a `SpaceSelectorProps` en `frontend/components/SpaceSelector.tsx`
- [ ] En `SpaceSelector`, aplicar la clase `opacity-40 cursor-not-allowed` y `pointer-events-none` cuando `providerIsVertex === true`
- [ ] Agregar un wrapper con `title` o un componente de tooltip en el `SpaceSelector` que muestre el mensaje cuando `providerIsVertex === true`
- [ ] Al recibir `providerIsVertex === true`, limpiar la selección interna llamando a `clearSelection()` y notificar al padre con `onSelectionChange([])`
- [ ] En `frontend/components/ChatInterface.tsx`, pasar `providerIsVertex={selectedProvider === "vertex"}` al `SpaceSelector`
- [ ] En `frontend/app/agents/[slug]/page.tsx`, asegurarse de que cuando `selectedProvider === "vertex"`, el array `selectedSpaces` se pase como `[]` al body del request (independientemente de lo que tenga el estado)
- [ ] En `backend/src/routes/agent.ts` (o en `copilot-runner.ts`), agregar la verificación: si `provider === "vertex"`, forzar `spaceRefs = []` antes de cualquier procesamiento
- [ ] Verificar que `npx tsc --noEmit` en frontend y backend no emite errores

## Dependencies

- Depends on: [model-selector-ui.md](model-selector-ui.md) — requiere que el `ModelSelector` exista y propague `selectedProvider` al componente padre.
- Depends on: [provider-aware-agent-run.md](provider-aware-agent-run.md) — el backend ya debe tener el routing por proveedor para ignorar `spaceRefs` correctamente.

## Out of Scope

- No se bloquea el WorkIQ context cuando se usa Vertex.
- No se oculta el `SpaceSelector` completamente — se muestra deshabilitado para que el usuario entienda que existe pero no está disponible con ese proveedor.
- No se revisa si otros componentes futuros también deberían bloquearse (esto se evalúa en iteraciones posteriores).

## Notes

- El `SpaceSelector` actualmente tiene una guarda `if (!pat) return null` que se eliminará en [remove-frontend-pat.md](remove-frontend-pat.md). En esta historia, el componente siempre renderiza (cuando el proveedor Copilot está configurado en el backend), pero puede estar deshabilitado según el proveedor activo.
- Si el backend no tiene Copilot configurado como proveedor, el `SpaceSelector` debería ya no mostrarse — esto se puede derivar del listado de proveedores: si `copilot` no está en la lista, no renderizar el `SpaceSelector` en absoluto.
- El tooltip puede implementarse como un atributo `title` HTML simple para esta iteración, sin necesidad de una librería de tooltips.
