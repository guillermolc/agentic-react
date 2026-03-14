# User Story: Routing por proveedor en agent/run

## Summary

**As a** sistema backend,
**I want** enrutar la ejecución de un agente al SDK correcto según el `provider` recibido en el body,
**So that** el mismo endpoint `POST /api/agent/run` soporta múltiples proveedores de forma transparente.

## Description

Actualizar `backend/src/routes/agent.ts` para recibir los campos `provider` y `model` en el body del request y enrutar la lógica de ejecución al runner correspondiente: `runWithCopilot` (usando `CopilotClient` con el PAT de env) o `runWithVertex` (usando `@google/genai`). En ambos casos la respuesta al cliente es SSE con los mismos tipos de eventos. El campo `model` ya no se lee de la configuración del agente en DB — se usa exclusivamente el recibido en el body. Si `provider` o `model` no se incluyen en el body, el backend responde `400`.

## Acceptance Criteria

- [ ] Dado que el body incluye `provider: "copilot"` y `model: "gpt-4.1"`, cuando el backend procesa la petición, entonces usa `CopilotClient` con el PAT de `process.env.GITHUB_PAT` y el modelo especificado.
- [ ] Dado que el body incluye `provider: "vertex"` y `model: "gemini-2.5-pro"`, cuando el backend procesa la petición, entonces usa `@google/genai` con las credenciales de `process.env.VERTEX_SERVICE_ACCOUNT_B64`.
- [ ] Dado que el body no incluye `provider` o `model`, cuando llega el request, entonces el backend responde `400` con un mensaje claro.
- [ ] Dado que el body incluye un `provider` no reconocido (ej. `"openai"`), cuando llega el request, entonces el backend responde `400`.
- [ ] Dado que el proveedor especificado no está configurado en el backend (env var ausente), cuando llega el request, entonces el backend responde `503` con el mensaje `"Provider not configured: <provider>"`.
- [ ] Dado que se usa `provider: "copilot"`, cuando el cliente no envía header `Authorization`, entonces el backend usa el PAT de env sin error (ya no requiere que el cliente lo envíe).
- [ ] El campo `model` de la tabla `agents` en DB ya no se usa para la ejecución del agente.
- [ ] Si el body incluye `spaceRefs` pero `provider` es `"vertex"`, el backend los ignora silenciosamente.

## Tasks

- [ ] Actualizar el tipo del body en `agent.ts` para incluir `provider: string` y `model: string` como campos requeridos
- [ ] Agregar validación al inicio del handler: si `!provider || !model`, responder `400`
- [ ] Agregar validación del valor de `provider`: sólo se acepta `"copilot"` o `"vertex"`
- [ ] Agregar verificación de proveedor configurado: si `provider === "copilot"` y `getCopilotPAT()` es null, responder `503`; igual para `vertex`
- [ ] Crear `backend/src/lib/copilot-runner.ts` con la función `runWithCopilot(opts: CopilotRunOpts, res: Response): Promise<void>` extrayendo la lógica actual de `CopilotClient` de `agent.ts`
- [ ] En `copilot-runner.ts`, leer el PAT desde `getCopilotPAT()` en lugar del header del request
- [ ] En `copilot-runner.ts`, usar el `model` recibido en `opts` en lugar de `agentConfig.model ?? "gpt-4.1"`
- [ ] Actualizar `agent.ts` para llamar a `runWithCopilot` o `runWithVertex` según el valor de `provider`
- [ ] Actualizar `loadAgentConfig()` para no incluir el campo `model` en el objeto retornado (eliminarlo del tipo `AgentRunConfig`)
- [ ] Verificar que el campo `model` del agente en la DB no afecte el flujo de ejecución
- [ ] Verificar que `npx tsc --noEmit` en backend no emite errores

## Dependencies

- Depends on: [backend-provider-config.md](backend-provider-config.md) — requiere `getCopilotPAT()` y `getVertexCredentials()`.
- Depends on: [vertex-sdk-integration.md](vertex-sdk-integration.md) — requiere `runWithVertex()` implementado.

## Out of Scope

- No se modifica la lógica de SSE en sí (headers, `sendEvent`, `finish()`), sólo se mueve a runners separados.
- No se implementa fallback automático entre proveedores si uno falla.

## Notes

- Definir la interfaz compartida `AgentRunOpts` con los campos comunes a ambos runners: `model`, `systemPrompt`, `prompt`, `agentSlug` (para logs).
- La firma del runner: `function runWithCopilot(opts: CopilotRunOpts, res: Response, req: Request): Promise<void>`.
- El bloqueo de `spaceRefs` cuando `provider === "vertex"` se implementa aquí: simplemente no pasar `spaceRefs` al `CopilotRunOpts` cuando el provider es vertex.
- El campo `model` en la DB de agentes puede dejarse en el schema por compatibilidad (como columna opcional), simplemente ya no se usa para ejecutar el agente.
