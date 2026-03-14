# User Story: Build frontend agents CRUD maintenance UI

## Summary

**As an** admin or developer,
**I want** a dedicated page in the app where I can list, create, edit, and delete agents,
**So that** I can manage agent configurations at runtime without touching source files or restarting the server.

## Description

Add an `/admin/agents` page to the existing admin section. The page shows a table of all agents with edit and delete actions. Creating or editing an agent opens a form (inline or separate route) that exposes all configurable fields. Deletions are confirmed with a dialog. All mutations call the corresponding `agents-api.ts` functions and refresh the context after completion.

## Acceptance Criteria

- [ ] Given the user navigates to `/admin/agents`, when agents exist, then a table lists each agent with columns: slug, displayName, model, nextAgent, and action buttons.
- [ ] Given the user clicks "New Agent", when the form is submitted with valid data, then the agent is created and appears in the table.
- [ ] Given the user clicks "Edit" on an agent row, when the form is submitted, then the agent is updated and the table reflects the change.
- [ ] Given the user clicks "Delete" on an agent row, when the confirmation dialog is accepted, then the agent is deleted and removed from the table.
- [ ] Given a required field (`slug`, `name`, `displayName`, `prompt`) is left empty, when the form is submitted, then a validation error is shown and the request is not sent.
- [ ] Given the `slug` field contains invalid characters (not `^[a-z0-9-]+$`), when the form is submitted, then a validation error is shown.
- [ ] Given the form is open in "Edit" mode, when it renders, then all existing field values are pre-populated.
- [ ] Given the page uses the theme tokens, when it renders, then it is visually consistent with the rest of the app.

## Tasks

- [ ] Create `frontend/app/admin/agents/page.tsx` with `"use client"` directive
- [ ] Render a table with columns: Slug, Display Name, Model, Next Agent, Actions
- [ ] Add "New Agent" button that opens the agent form in create mode
- [ ] Create `frontend/components/AgentForm.tsx` — a form component accepting an optional `agent` prop (undefined = create mode, populated = edit mode)
- [ ] In `AgentForm`, render labeled inputs for: `slug` (disabled in edit mode), `name`, `displayName`, `description`, `model`, `tools` (comma-separated text input), `prompt` (textarea, min 12 rows, monospace), `color`, `bgColor`, `borderColor`, `iconColor`, `nextAgent` (text input), `quickPrompt`
- [ ] Add client-side validation: required fields check, slug pattern `^[a-z0-9-]+$`
- [ ] On form submit in create mode, call `createAgent()` from `agents-api.ts`, refresh context, close form
- [ ] On form submit in edit mode, call `updateAgent(slug, data)` from `agents-api.ts`, refresh context, close form
- [ ] Add delete button per row; show a `window.confirm` or inline confirmation before calling `deleteAgent(slug)`
- [ ] After delete, call `fetchAgents()` and update context
- [ ] Add a link to `/admin/agents` in the existing `/admin` page navigation
- [ ] Verify `npx tsc --noEmit` passes in `frontend/`

## Dependencies

- Depends on: `frontend-agents-service.md` (`createAgent`, `updateAgent`, `deleteAgent`, `fetchAgents` must exist)
- Depends on: `backend-crud-api.md` (endpoints must be live)

## Out of Scope

- Drag-and-drop reordering of agents
- Syntax highlighting or validation in the `prompt` textarea
- Preview/test-run of an agent directly from the CRUD UI
- Role-based access control for the admin page

## Notes

- Use existing Tailwind tokens: `bg-surface-2`, `text-text-primary`, `border-border`, `text-accent`, `text-text-secondary`, `bg-background`
- The `tools` field stores an array in the DB; the form should split/join on commas for user convenience
- `slug` should be read-only in edit mode to avoid primary-key changes; if a slug rename is needed, delete + recreate
- Keep the component focused — no need for a dedicated route per agent; an inline expanded row or a modal form is sufficient
