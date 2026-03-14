# User Story: Endpoint de listado de modelos por proveedor

## Summary

**As a** frontend del chat de agentes,
**I want** poder consultar al backend qué modelos están disponibles y de qué proveedor,
**So that** puedo mostrar un selector preciso con sólo los modelos que realmente se pueden usar.

## Description

Crear un nuevo endpoint `GET /api/providers/models` en el backend que devuelva la lista de modelos disponibles agrupados por proveedor. Sólo se incluyen los proveedores cuyas variables de entorno estén configuradas y sean válidas. El listado de modelos puede obtenerse dinámicamente desde cada proveedor o desde una lista curada hardcoded como fallback. La respuesta debe ser estable y rápida (caché en memoria).

## Acceptance Criteria

- [ ] Dado que `GITHUB_PAT` está configurado, cuando el cliente llama `GET /api/providers/models`, entonces la respuesta incluye un objeto `{ provider: "copilot", models: [...] }`.
- [ ] Dado que `VERTEX_SERVICE_ACCOUNT_B64` está configurado, cuando el cliente llama `GET /api/providers/models`, entonces la respuesta incluye un objeto `{ provider: "vertex", models: [...] }`.
- [ ] Dado que ninguna variable de entorno está configurada, cuando el cliente llama `GET /api/providers/models`, entonces la respuesta es un array vacío `[]` con status 200.
- [ ] Dado que sólo una de las dos variables está configurada, cuando el cliente llama al endpoint, entonces la respuesta contiene sólo ese proveedor.
- [ ] Dado que el endpoint fue llamado recientemente, cuando se vuelve a llamar dentro del TTL de caché, entonces la respuesta usa el valor cacheado sin repetir llamadas externas.
- [ ] La respuesta tiene el formato: `[{ "provider": "copilot", "models": ["gpt-4.1", "claude-sonnet-4.6"] }, ...]`

## Tasks

- [ ] Crear `backend/src/routes/providers.ts` con el router `providersRouter` y el endpoint `GET /models`
- [ ] Registrar el router en `backend/src/index.ts` bajo `/api/providers`
- [ ] Implementar `listCopilotModels(pat: string): Promise<string[]>` que llama a `GET https://api.githubcopilot.com/models` con el PAT y extrae los nombres de modelos; con fallback hardcoded si la llamada falla
- [ ] Definir la lista fallback de modelos Copilot: `["gpt-4.1", "gpt-4o", "claude-sonnet-4.6"]`
- [ ] Implementar `listVertexModels(credentials: VertexCredentials): Promise<string[]>` que intenta listar modelos de Vertex; con fallback hardcoded si la API no está disponible
- [ ] Definir la lista fallback de modelos Vertex: `["gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"]`
- [ ] Implementar caché en memoria con TTL de 5 minutos para los resultados del listado
- [ ] Establecer header `Cache-Control: no-store` (la caché es server-side, el cliente no debe cachear)
- [ ] Verificar que `npx tsc --noEmit` en backend no emite errores

## Dependencies

- Depends on: [backend-provider-config.md](backend-provider-config.md) — requiere `getCopilotPAT()` y `getVertexCredentials()`.

## Out of Scope

- No se implementa filtrado de modelos por capacidades (ej. sólo modelos con streaming).
- No se expone metadata adicional de los modelos (contexto máximo, precio, etc.).

## Notes

- La API de Copilot para listar modelos: `GET https://api.githubcopilot.com/models` con header `Authorization: Bearer <pat>`. La respuesta tiene la forma `{ data: [{ id: "gpt-4o", ... }, ...] }`.
- Para Vertex, si la API de listado de modelos requiere permisos especiales que la cuenta de servicio no tiene, el fallback garantiza que el endpoint siempre responde con algo útil.
- El endpoint no requiere autenticación del cliente — el backend ya tiene las credenciales internamente. Si se requiere protección futura, se puede agregar un middleware de API key separado.
