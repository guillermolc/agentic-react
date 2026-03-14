# Feature: Multi-Provider LLM

## Overview

Migrar el sistema de ejecución de agentes desde un modelo donde el GitHub PAT se configuraba en el frontend hacia uno completamente gestionado por el backend vía variables de entorno. Se agrega soporte para múltiples proveedores de LLM (GitHub Copilot y Vertex AI), con un selector de modelos dinámico en el chat de cada agente. El proveedor y modelo seleccionados determinan qué SDK y lógica de streaming se usa en el backend.

## Problem Statement

Actualmente el PAT de GitHub se almacena en el navegador del usuario y se envía en cada petición. Esto expone credenciales del lado del cliente y obliga a cada usuario a configurar su propio acceso. Además, el modelo de cada agente está hardcodeado en su YAML/DB, por lo que no hay forma de cambiar el proveedor o modelo de forma dinámica. El sistema sólo soporta Copilot como proveedor de LLM, limitando la flexibilidad operativa.

## Goals

- [ ] Eliminar completamente la configuración del PAT de GitHub del frontend
- [ ] Gestionar las credenciales de todos los proveedores de LLM exclusivamente en el backend vía variables de entorno
- [ ] Agregar soporte para Vertex AI como segundo proveedor usando `@google/genai`
- [ ] Exponer un endpoint que liste los modelos disponibles por proveedor configurado
- [ ] Agregar un selector de modelos dinámico en el chat de cada agente
- [ ] Enrutar la ejecución del agente al SDK correcto según el proveedor seleccionado, manteniendo el SSE streaming
- [ ] Bloquear automáticamente las funcionalidades exclusivas de Copilot cuando se usa Vertex

## Non-Goals

- No se agrega soporte para otros proveedores más allá de Copilot y Vertex AI en esta iteración
- No se implementa persistencia de la preferencia de modelo por usuario (queda en memoria de sesión del cliente)
- No se modifica la lógica de herramientas/tools disponibles para cada agente más allá de lo requerido por el proveedor
- No se implementa un panel de administración de credenciales desde la UI (sólo env vars)

## Target Users / Personas

| Persona | Description |
|---|---|
| Administrador de backend | Desarrollador que configura y opera el servidor. Gestiona credenciales vía `.env` y necesita poder activar/desactivar proveedores sin tocar código. |
| Usuario del chat de agentes | Cualquier usuario que interactúa con los agentes. Necesita poder seleccionar el modelo con el que quiere trabajar y recibir feedback claro sobre qué funcionalidades están disponibles según el proveedor. |

## Functional Requirements

1. El sistema **no deberá** almacenar ni leer el PAT de GitHub desde el navegador; el backend lo leerá desde la variable de entorno `GITHUB_PAT`.
2. El sistema deberá leer credenciales de Vertex AI desde la variable de entorno `VERTEX_SERVICE_ACCOUNT_B64`, cuyo valor es un base64 que al decodificarse produce un JSON de cuenta de servicio de Google.
3. El backend deberá decodificar el base64, extraer `project_id`, `client_email` y `private_key`, y usarlos para autenticar con `@google/genai`.
4. El backend deberá exponer `GET /api/providers/models` que devuelva los modelos disponibles agrupados por proveedor, incluyendo sólo los proveedores cuyas variables de entorno estén configuradas.
5. El frontend deberá mostrar un componente `ModelSelector` en el chat de cada agente, cargando los modelos desde el endpoint anterior.
6. El usuario deberá seleccionar un proveedor y modelo antes de poder enviar un mensaje; el chat estará bloqueado hasta que se realice una selección.
7. El `POST /api/agent/run` deberá recibir los campos `provider` y `model` en el body y enrutar la ejecución al SDK correspondiente.
8. Cuando `provider === "copilot"`, el backend deberá usar `CopilotClient` de `@github/copilot-sdk` con el PAT leído de `process.env.GITHUB_PAT`.
9. Cuando `provider === "vertex"`, el backend deberá usar `@google/genai` y emitir los mismos eventos SSE (`chunk`, `reasoning`, `done`, `error`) que el flujo de Copilot.
10. Cuando el proveedor activo es `vertex`, el `SpaceSelector` del frontend deberá mostrarse deshabilitado con un tooltip explicativo y no se enviarán `spaceRefs` en el body.
11. El backend deberá ignorar `spaceRefs` si el `provider` recibido es `vertex`.
12. El campo `model` en la configuración del agente (YAML/DB) deberá eliminarse; el modelo ya no tiene valor por defecto ni hardcoded: el usuario debe elegirlo explícitamente.
13. El admin panel deberá actualizarse para eliminar el campo `model` del formulario de edición de agentes.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | El PAT y las credenciales de Vertex nunca deben llegar al cliente ni aparecer en logs. El base64 se decodifica sólo en memoria. |
| Security | El backend debe validar que `provider` sea uno de los valores permitidos (`copilot`, `vertex`) antes de enrutar. |
| Performance | El endpoint `GET /api/providers/models` debe responder en menos de 5 segundos; los modelos de Vertex se pueden cachear en memoria durante la vida del proceso. |
| Reliability | Si un proveedor no está configurado (env var ausente), se lo omite del listado sin romper el servidor. |
| Compatibility | El streaming SSE para Vertex debe emitir exactamente los mismos tipos de eventos que Copilot para no requerir cambios en el frontend de consumo de eventos. |
| UX | El selector de modelos debe indicar visualmente cuándo está cargando y manejar errores de red. |

## UX / Design Considerations

- **Model Selector:** Dropdown/select en el área del chat input, visible en todo momento. Agrupa modelos por proveedor (ej. "Copilot" → `gpt-4.1`, `claude-sonnet-4.6`; "Vertex" → `gemini-2.5-pro`). Mientras no haya una selección activa, el botón de enviar mensaje debe estar deshabilitado con un placeholder explicativo.
- **Copilot Spaces deshabilitado:** Cuando el modelo activo pertenece a Vertex, el ícono del `SpaceSelector` se muestra con opacidad reducida. Al hacer hover aparece un tooltip: *"Copilot Spaces no está disponible con proveedores distintos a Copilot"*.
- **Eliminación del PAT Modal:** El flujo de onboarding elimina completamente el paso de ingresar PAT. Si el usuario abre la app y no hay proveedores configurados en el backend, se muestra un mensaje de error claro en lugar del modal de PAT.
- **Admin Panel:** El campo `model` desaparece del formulario de edición de agentes.

## Technical Considerations

- **`@google/genai`** es el SDK a usar para Vertex AI (`npm install @google/genai`). Se autentica con `GoogleGenAI` pasando las credenciales de la cuenta de servicio.
- La decodificación del base64 se hace con `Buffer.from(process.env.VERTEX_SERVICE_ACCOUNT_B64, "base64").toString("utf-8")` y luego `JSON.parse(...)`.
- Para listar modelos de Vertex disponibles, usar la API de modelos del SDK o mantener una lista curada de modelos Gemini conocidos como fallback si la API de listado no está disponible en el tier utilizado.
- Para listar modelos de Copilot, consultar la API `GET https://api.githubcopilot.com/models` con el PAT, o mantener una lista curada basada en la documentación actual.
- El campo `provider` y `model` se vuelven obligatorios en el body de `POST /api/agent/run`. Si alguno falta, el backend responde `400`.
- El campo `model` en la tabla `agents` de la DB y en los YAML de agentes debe eliminarse en las migraciones/actualizaciones correspondientes.
- El enrutamiento en `agent.ts` debe separarse en funciones: `runWithCopilot(...)` y `runWithVertex(...)`, ambas comparten la misma firma de respuesta SSE.
- El frontend debe eliminar: `PATModal.tsx`, los campos `pat` y `username` de `context.tsx` y `storage.ts`, y todos los usos del PAT en headers de peticiones al backend.
- El `SpaceSelector` y el `kdb` endpoint siguen usando el PAT del backend (via env var) para autenticarse, no el del cliente.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `@google/genai` | External (npm) | SDK de Google para Vertex AI / Gemini. Instalar en `backend/`. |
| `GITHUB_PAT` env var | Internal | Variable de entorno requerida para que el proveedor Copilot funcione. |
| `VERTEX_SERVICE_ACCOUNT_B64` env var | Internal | Variable de entorno requerida para que el proveedor Vertex funcione. |
| `backend/src/routes/kdb.ts` | Internal | Debe actualizarse para leer el PAT desde env en lugar de recibirlo del cliente. |
| `backend/src/routes/admin.ts` | Internal | Debe eliminar el campo `model` del CRUD de agentes. |
| `frontend/components/SpaceSelector.tsx` | Internal | Debe recibir prop `providerIsVertex` para deshabilitar condicionalmente. |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| La API de listado de modelos de Copilot cambia o no está disponible | Med | Med | Mantener una lista curada hardcoded como fallback en el backend. |
| La API de listado de modelos de Vertex no está disponible en el tier gratuito | Med | Med | Mantener una lista curada de modelos Gemini conocidos como fallback. |
| El streaming SSE de Vertex presenta diferencias de formato respecto a Copilot | Med | High | Implementar un wrapper de normalización de eventos antes de emitir al cliente. |
| Usuarios con instancias ya corriendo tienen sessions de `pat` en localStorage | Low | Low | El frontend continúa funcionando aunque tenga datos obsoletos de PAT; al reiniciar sesión se limpia sólo. |
| Credenciales de Vertex en base64 expuestas en el proceso | Low | High | Nunca loguear ni serializar la variable de entorno; decodificar sólo en memoria y no exponer en endpoints. |

## Success Metrics

- El chat de agentes funciona end-to-end con Copilot sin requerir ninguna configuración en el frontend.
- El chat de agentes funciona end-to-end con un modelo de Vertex emitiendo SSE con los mismos eventos.
- El selector de modelos muestra la lista correcta según los proveedores configurados en `.env`.
- El `SpaceSelector` se deshabilita correctamente al seleccionar un modelo de Vertex y ningún `spaceRef` llega al backend.
- No hay referencias al PAT de GitHub en el código del frontend.

## Open Questions

- [ ] ¿Qué lista curada de modelos de Copilot usar como fallback si la API no está disponible?
- [ ] ¿Debe el selector de modelos persistir la última selección en `localStorage`?
- [ ] ¿El endpoint `GET /api/kdb/spaces` sigue requiriendo que el cliente envíe el PAT, o también migra a leerlo del env en el backend?

## User Stories

| Story | File |
|---|---|
| Eliminar PAT del frontend | [stories/remove-frontend-pat.md](stories/remove-frontend-pat.md) |
| Configuración de proveedores en backend vía env vars | [stories/backend-provider-config.md](stories/backend-provider-config.md) |
| Integración del SDK de Vertex AI con streaming SSE | [stories/vertex-sdk-integration.md](stories/vertex-sdk-integration.md) |
| Endpoint de listado de modelos por proveedor | [stories/provider-models-endpoint.md](stories/provider-models-endpoint.md) |
| Selector de modelos en el chat | [stories/model-selector-ui.md](stories/model-selector-ui.md) |
| Routing por proveedor en agent/run | [stories/provider-aware-agent-run.md](stories/provider-aware-agent-run.md) |
| Bloqueo de funciones Copilot-only en Vertex | [stories/block-copilot-features-on-vertex.md](stories/block-copilot-features-on-vertex.md) |
