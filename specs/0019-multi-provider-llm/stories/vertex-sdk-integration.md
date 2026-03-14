# User Story: Integración del SDK de Vertex AI con streaming SSE

## Summary

**As a** usuario del chat de agentes,
**I want** que cuando selecciono un modelo de Vertex AI el agente responda usando ese proveedor,
**So that** puedo utilizar modelos Gemini con la misma experiencia de streaming que tengo con Copilot.

## Description

Implementar en el backend la lógica de ejecución de agentes usando `@google/genai` cuando el proveedor seleccionado es `vertex`. La respuesta debe emitirse como SSE con los mismos tipos de eventos que el flujo de Copilot: `chunk`, `reasoning`, `done`, `error`. Las credenciales se obtienen de `getVertexCredentials()` del módulo `providers.ts`. El streaming debe ser real (token a token) cuando el modelo lo soporte.

## Acceptance Criteria

- [ ] Dado que `VERTEX_SERVICE_ACCOUNT_B64` está configurado y el usuario selecciona un modelo Vertex, cuando envía un mensaje, entonces el backend responde con un SSE stream emitiendo eventos `chunk` con tokens del modelo Gemini.
- [ ] Dado que el agente termina de generar su respuesta, cuando el stream se completa, entonces se emite el evento `done` y la conexión SSE se cierra.
- [ ] Dado que ocurre un error durante la generación (ej. cuota excedida, modelo no disponible), cuando falla la llamada al SDK, entonces se emite un evento `error` con el mensaje correspondiente y se cierra el stream.
- [ ] Dado que el sistema prompt del agente tiene contenido, cuando se llama a Vertex, entonces el `systemPrompt` construido en `agent.ts` (incluyendo context, workiqBlock, THINK_GUIDANCE) se pasa correctamente al SDK de Google.
- [ ] Dado que se usa Vertex, cuando se ejecuta el agente, entonces no se instancia ni se llama a `CopilotClient` en ningún momento.
- [ ] Los tokens y credenciales de Vertex NO aparecen en ningún log del servidor.

## Tasks

- [ ] Instalar la dependencia `@google/genai` en `backend/`: `npm install @google/genai`
- [ ] Crear `backend/src/lib/vertex-runner.ts` con la función `runWithVertex(opts: VertexRunOpts, res: Response): Promise<void>` que encapsula toda la lógica de llamada al SDK de Google y emisión de SSE
- [ ] En `vertex-runner.ts`, inicializar `GoogleGenAI` usando `project_id`, `client_email` y `private_key` de `getVertexCredentials()`
- [ ] Implementar streaming token a token con `generateContentStream` del SDK, emitiendo eventos `chunk` por cada fragmento recibido
- [ ] Implementar el wrapping del system prompt usando el parámetro `systemInstruction` del SDK de Google
- [ ] Manejar bloques de razonamiento si el modelo los soporta (emitir evento `reasoning`), o ignorarlos silenciosamente si no
- [ ] Implementar el event `done` al finalizar el stream y `error` ante excepciones
- [ ] Crear la interfaz `VertexRunOpts` con los campos: `model`, `systemPrompt`, `prompt`, `res` (Response de Express)
- [ ] Añadir tipos TypeScript para las respuestas del SDK (`@google/genai` provee sus propios tipos)
- [ ] Verificar que `npx tsc --noEmit` en backend no emite errores

## Dependencies

- Depends on: [backend-provider-config.md](backend-provider-config.md) — requiere `getVertexCredentials()` disponible.

## Out of Scope

- No se implementa soporte para herramientas/tools de Vertex (function calling) en esta historia — el agente sólo usa el modelo para generación de texto.
- No se implementa caché de respuestas.
- No se soportan archivos o imágenes como input.

## Notes

- El SDK `@google/genai` es el nuevo SDK unificado de Google (`https://github.com/googleapis/js-genai`). No confundir con `@google-cloud/vertexai` (el anterior).
- Autenticación con cuenta de servicio usando el SDK:
  ```typescript
  import { GoogleGenAI } from "@google/genai";
  
  const ai = new GoogleGenAI({
    vertexai: true,
    project: credentials.project_id,
    location: "us-central1", // o la region configurada
    googleAuthOptions: {
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    },
  });
  ```
- Para streaming:
  ```typescript
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: systemPrompt },
  });
  for await (const chunk of stream) {
    const text = chunk.text();
    if (text) sendEvent("chunk", text);
  }
  ```
- La `location` de Vertex puede considerarse configurable vía env var `VERTEX_LOCATION` con default `"us-central1"`.
