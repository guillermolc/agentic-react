# User Story: Eliminar PAT del frontend

## Summary

**As a** usuario del chat de agentes,
**I want** que la aplicación funcione sin tener que configurar ni ingresar un GitHub PAT en el navegador,
**So that** puedo usar los agentes directamente sin preocuparme por exponer credenciales desde el cliente.

## Description

Actualmente, al abrir la aplicación por primera vez, se muestra `PATModal.tsx` para que el usuario ingrese su GitHub Personal Access Token. Este token se almacena en `localStorage` y se envía como `Authorization: Bearer <pat>` en cada petición al backend. Con la migración a credenciales gestionadas por el backend, este flujo debe eliminarse completamente del frontend. El backend pasará a leer el PAT desde sus propias variables de entorno.

## Acceptance Criteria

- [ ] Dado que la app carga, cuando el usuario abre por primera vez la aplicación, entonces NO aparece ningún modal de PAT ni campo para ingresarlo.
- [ ] Dado que el código del frontend existe, cuando se buscan referencias a `pat`, `username`, `PATModal`, `getPat`, `savePat`, `clearPat`, `getUsername`, `saveUsername`, entonces no se encuentra ninguna en archivos de componentes o lib del frontend.
- [ ] Dado que existe un `activeRepo` guardado en localStorage, cuando el usuario abre la app, entonces la sesión se restaura correctamente sin necesidad de PAT.
- [ ] Dado que el usuario accede a `/agents/[slug]`, cuando envía un mensaje, entonces la petición a `/api/agent/run` no incluye el header `Authorization` con un PAT desde el cliente.
- [ ] Dado que no hay PAT en el cliente, cuando `SpaceSelector` y `kdb` page se cargan, entonces no dependen del PAT del contexto del frontend para funcionar.

## Tasks

- [ ] Eliminar el componente `frontend/components/PATModal.tsx`
- [ ] Eliminar los campos `pat` y `username` del estado en `frontend/lib/context.tsx` (`AppContextValue`, `AppProvider` state, `setPat`, `clearAuth` parcial)
- [ ] Eliminar las funciones `getPat`, `savePat`, `clearPat`, `getUsername`, `saveUsername` de `frontend/lib/storage.ts`
- [ ] Eliminar las referencias a `PATModal` en `frontend/app/layout.tsx` o wherever se renderice
- [ ] Actualizar `frontend/components/RepoSelectorModal.tsx` para eliminar el uso de `pat` del contexto (ya no se usa para la llamada a `/api/repos/clone`)
- [ ] Actualizar `frontend/components/SpaceSelector.tsx` para eliminar la guarda `if (!pat) return null`
- [ ] Actualizar `frontend/app/kdb/page.tsx` para eliminar la dependencia del `pat` del contexto
- [ ] Actualizar `frontend/components/Nav.tsx` y `frontend/components/SettingsDropdown.tsx` para eliminar cualquier indicador de estado del PAT
- [ ] Eliminar el import y uso de `pat` en `frontend/app/agents/[slug]/page.tsx` (actualmente se usa en el header `Authorization` del fetch)
- [ ] Verificar que `npx tsc --noEmit` en frontend no emite errores tras los cambios

## Dependencies

- Depends on: [backend-provider-config.md](backend-provider-config.md) — el backend debe tener `GITHUB_PAT` en env antes de que el frontend deje de enviarlo.

## Out of Scope

- No se modifica la lógica de autenticación de la GitHub API para listar repos (esta llamada se hace directo desde el cliente a `api.github.com` con el PAT del usuario — si se quiere migrar también, es una historia separada).
- No se elimina `activeRepo` ni ningún otro estado de `localStorage`.

## Notes

- La eliminación del campo `username` del contexto puede afectar la lógica de clonado si el `repoPath` se construía con él. Verificar que `backend/src/routes/repos.ts` obtiene el username del `repoFullName` del body, no del cliente.
- `clearAuth()` puede simplificarse a sólo limpiar `activeRepo` y cachés.
