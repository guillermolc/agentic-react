# User Story: Configuración de proveedores en backend vía env vars

## Summary

**As a** administrador de backend,
**I want** configurar las credenciales de los proveedores de LLM exclusivamente mediante variables de entorno,
**So that** las credenciales nunca se exponen en el cliente y puedo activar o desactivar proveedores sin modificar código.

## Description

El backend debe ser capaz de leer y validar las credenciales de cada proveedor al arrancar. Para Copilot, la variable `GITHUB_PAT` contiene el token directamente. Para Vertex AI, la variable `VERTEX_SERVICE_ACCOUNT_B64` contiene un string Base64 que al decodificarse produce un JSON de cuenta de servicio de Google. El backend debe decodificar ese JSON en memoria, validar que tiene los campos necesarios (`project_id`, `client_email`, `private_key`), y exponerlos a través de un módulo interno `providers.ts` para uso en otras partes del sistema.

Un proveedor se considera "disponible" únicamente si su variable de entorno está configurada y es válida. Si no lo está, se omite silenciosamente.

## Acceptance Criteria

- [ ] Dado que `GITHUB_PAT` está definido en `.env`, cuando el backend arranca, entonces el proveedor `copilot` está disponible internamente.
- [ ] Dado que `GITHUB_PAT` no está definido, cuando el backend arranca, entonces el proveedor `copilot` no aparece en ningún listado ni genera error de arranque.
- [ ] Dado que `VERTEX_SERVICE_ACCOUNT_B64` está definido con un base64 válido, cuando el backend arranca, entonces el JSON se decodifica correctamente y los campos `project_id`, `client_email`, `private_key` están disponibles en memoria.
- [ ] Dado que `VERTEX_SERVICE_ACCOUNT_B64` contiene un base64 inválido o un JSON con campos faltantes, cuando el backend arranca, entonces se loguea un warning claro y el proveedor `vertex` se marca como no disponible (sin crashear).
- [ ] Dado que el módulo de providers está inicializado, cuando otro módulo llama `getVertexCredentials()`, entonces recibe el objeto decodificado o `null` si no está configurado.
- [ ] Las credenciales decodificadas **nunca** aparecen en logs ni en respuestas HTTP.

## Tasks

- [ ] Crear `backend/src/lib/providers.ts` con las funciones `getCopilotPAT(): string | null` y `getVertexCredentials(): VertexCredentials | null`
- [ ] En `providers.ts`, implementar la decodificación: `Buffer.from(process.env.VERTEX_SERVICE_ACCOUNT_B64, "base64").toString("utf-8")` → `JSON.parse(...)` con try/catch y validación de campos
- [ ] Definir la interfaz `VertexCredentials` con los campos: `project_id`, `client_email`, `private_key`, `type` (y opcionalmente el resto del JSON de cuenta de servicio)
- [ ] Agregar logging de arranque que indique qué proveedores están activos (sin imprimir el valor de las credenciales)
- [ ] Actualizar `backend/.env.example` (o `README.md` de backend) con las nuevas variables de entorno documentadas
- [ ] Actualizar `backend/src/routes/kdb.ts` para leer el PAT desde `getCopilotPAT()` en lugar de recibirlo del header `Authorization` del cliente
- [ ] Actualizar `backend/src/routes/agent.ts` para leer el PAT desde `getCopilotPAT()` cuando el proveedor es Copilot
- [ ] Verificar que `npx tsc --noEmit` en backend no emite errores

## Dependencies

- Depends on: ninguna story previa (es la base del sistema de proveedores).

## Out of Scope

- No se implementa recarga en caliente de variables de entorno (requeriría reinicio del servidor para aplicar cambios).
- No se crea UI alguna para gestionar las credenciales.

## Notes

- El módulo `providers.ts` debe ser importado como singleton — ejecutar la decodificación una vez al cargar el módulo y cachear el resultado.
- Las variables de entorno se leen con `process.env` estándar vía `dotenv` ya configurado en `index.ts`.
- El JSON de cuenta de servicio de Google tiene el formato:
  ```json
  {
    "type": "service_account",
    "project_id": "...",
    "private_key_id": "...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "...@....iam.gserviceaccount.com",
    "client_id": "...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "...",
    "client_x509_cert_url": "..."
  }
  ```
