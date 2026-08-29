# dsh-clear-session-history

Adds destructive "clear session history" affordances to the dsh web GUI, each
behind an are-you-sure dialog that shows exactly what will be deleted:

1. **Clear session history.** A red row inside a workspace's own "…" menu in
   the sidebar (next to Rename / Delete workspace). Deletes every session log
   stored on disk for that one workspace, then removes the workspace itself
   from the sidebar.
2. **Clear all session history.** A red button directly below the New Session
   button. Deletes every session log on disk across all workspaces, then
   removes every workspace from the sidebar (a full reset to the blank state).
3. **Delete session.** A red row (trash icon) inside any session's own "…"
   menu in the sidebar (next to Rename / Fork / Archive). Deletes that one
   session's log from disk. The workspace and its other sessions are
   untouched. Works on open (attached) sessions too: the log is removed and
   the row leaves the sidebar immediately. The only thing it refuses is a
   session whose agent is actively running (a turn in flight), since deleting
   that would break the write in progress; the dialog says so and the delete
   stays disabled until it finishes.
## What "delete" means

Session logs live under `$DSH_HOME/sessions/<project-key>/<session-id>/`. The
plugin deletes those directories through the host's own session persistence
backend (`locate()` resolves each session's directory, no slug reimplementation),
so what disappears from disk is exactly what the sidebar lists. Effects:

- After a fully successful clear the GUI reloads the page, which closes the
  confirm dialog and repulls both lists fresh: deleted sessions and removed
  workspaces leave the sidebar in one step. (The harness has no "session
  deleted" push event, so a reload is the reliable way for a third-party
  plugin to reflect the change; it is the same result as the manual reload
  that originally confirmed the delete.)
- Empty project directories are pruned afterwards.
- The cleared workspace is removed from the registration registry
  (`$DSH_HOME/storages/workspace.json`), so its row disappears from the
  sidebar. A clear-all removes every workspace registration. Any
  currently-open session that belonged to a removed workspace moves to the
  Ungrouped bucket, matching the app's own Delete workspace behavior.
- A partial clear (some logs could not be resolved to safe directories) keeps
  the workspace, so the leftover sessions stay grouped instead of being
  orphaned; the dialog reports how many were and were not deleted.
- For workspaces that are kept, the registry's stored session ids may go
  stale until the next host start. Harmless: the sidebar joins membership
  against `session.list` and skips ids without a summary.

The plugin is home-agnostic by construction: it never resolves a path itself
(no `~/.dsh` literal, no home lookup), and every path it touches comes from
host services whose wiring is `$DSH_HOME`-derived (`dshHomePath('sessions')`).
Verified against a harness booted with a custom `DSH_HOME`: previews read that
home's sessions, a clear removed them, and the default home stayed untouched.

### What is deliberately kept

The rule depends on the action:

- **Workspace and clear-all** keep **sessions the host currently holds**
  (attached/open) plus cold subagent logs whose lineage reaches one (fixpoint
  over `parentSession` chains): deleting an attached log underneath its writer
  would leave a recreated, headerless file. The dialog reports the kept count.
- **Delete session (single)** is the "make this one gone" action: it deletes
  the log even for an attached-but-idle session. Because the host still holds
  that session in memory (so it would linger in the sidebar after a reload),
  the clear first archives it — the host's own archive hides the row and
  clears the selection if it was the current session — then removes the log.
  The only session it refuses is one whose agent is **actively running** (a
  turn is in flight and the log is being appended), plus cold subagents of
  running parents.
- Anything the persistence backend cannot resolve to a well-shaped session
  directory (basename must equal the session id, parent must match the
  project-key shape). Such entries are counted as unresolved and reported
  back instead of deleted.

The dialog states the kept count before the user acknowledges.

## How it fits the GUI

None of the three surfaces declares a plugin slot. The workspace and session
row menus belong to `ui-workspace`'s browser and the New Session button to the
sidebar shell, so the browser half integrates at the DOM level:

- A body-level observer recognizes a portal menu by its item set when it
  opens: the Rename + Delete-workspace pair is a workspace menu (a "Clear
  session history" danger row is cloned in), the Rename + Fork + Archive set
  is a session menu (a red "Delete session" row with a trash icon is cloned
  in). The cloned rows reuse the menu's own classes and the theme's danger
  color.
- The target is captured from the anchor button's aria-label at
  pointerdown/keydown: a workspace row (title + occurrence among same-titled
  rows, so same-basename workspaces resolve deterministically) or a session
  row (title, enclosing workspace group, and the row's index within the
  group). The session id never reaches the DOM, so the plugin resolves it
  from the click by addressing `workspace.sessionIds` at the group-relative
  row index, mirroring the sidebar's own render order (skip archived and
  summary-less ids), and double-checks the session title before acting. An
  ungrouped row matches by title among sessions no workspace owns.
- The New Session button gets a cloned red sibling below it (wide sidebar
  only; the 56px rail is left alone).

Every hook degrades to a no-op on a template mismatch (unknown locale,
restructured DOM) rather than breaking the sidebar. Both shipped locales
(English and 简体中文) are matched.

The dialog is the harness's own `RiskConfirmation` primitive (checkbox-gated),
hosted on the plugin's private React root. All calls round-trip through the
Typert remote (`/api/clearSessionHistory/*`):

- `preview(input)` / `clear(input)` → workspace scope
  `{ workspaceTitle, titleOccurrence }` (empty title = every workspace);
  returns `{ targets, kept }` / `{ deleted, targets, kept, removed }`.
- `previewSession(input)` / `clearSession(input)` → single session
  `{ sessionId }`; preview reports whether the log is deletable, clear
  returns `{ deleted, targets, kept, removed }` and never removes a workspace.

Workspace titles are resolved through `workspaceRegistry` (registry display
order), matching the order the sidebar renders them.

## Install

```sh
dsh plugin --profile web add /path/to/deepseek-harness-plugins/clear-session-history
```

Restart the GUI. Verify:

```sh
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:3080/plugins/dsh-clear-session-history/client.js   # 200
```

## Safety notes

- The plugin operates underneath the host's append-only persistence service.
  It only ever removes directories the backend itself locates for a listed
  session, and only after re-checking the directory shape on disk.
- Workspace registrations are only removed by the host's own
  `workspaceRegistry.delete()`, and only after a fully successful clear (every
  targeted log gone), so a partial failure never orphans sessions.
- There is no trash or undo: deletion is permanent. The checkbox in the
  dialog exists for that reason.

## Verification

- `pnpm test` (node half against stubbed services + temp sessions root):
  scope matching, live/subagent keep rules, occurrence resolution, unknown
  workspace soft failure, workspace-registration removal (per-workspace and
  clear-all), partial-clear keeps the workspace, single-session delete
  (cold deletes, attached-but-idle deletes and archives to hide, running
  agent refused, unknown id fails, workspace never removed), degenerate
  `locate()` refusal, missing-service failure.
- `node tests/client-session-flow.mjs` (built client bundle under the harness
  checkout's jsdom): drives the real pointerdown → session-menu → Delete
  session → id-resolution path against a simulated grouped sidebar and asserts
  the dialog acts on the resolved session id.
- Live probe against a running instance (non-destructive):

  ```sh
  curl -s -X POST http://127.0.0.1:3080/api/clearSessionHistory/preview \
    -H 'content-type: application/json' \
    -d '{"type":"client-request","rpcId":"probe","method":"clearSessionHistory/preview",
         "payload":{"args":{"input":{"workspaceTitle":"","titleOccurrence":0}}}}'
  ```

  The returned `targets` count matches `find ~/.dsh/sessions -mindepth 2
  -maxdepth 2 -type d | wc -l` (minus currently-open sessions).
