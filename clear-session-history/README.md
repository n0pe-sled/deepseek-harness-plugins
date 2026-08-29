# dsh-clear-session-history

Adds two destructive "clear session history" affordances to the dsh web GUI,
each behind an are-you-sure dialog that shows exactly how many session logs
will be deleted:

1. **Clear session history.** A red row inside a workspace's own "…" menu in
   the sidebar (next to Rename / Delete workspace). Deletes every session log
   stored on disk for that one workspace.
2. **Clear all session history.** A red button directly below the New Session
   button. Deletes every session log on disk across all workspaces.
## What "delete" means

Session logs live under `$DSH_HOME/sessions/<project-key>/<session-id>/`. The
plugin deletes those directories through the host's own session persistence
backend (`locate()` resolves each session's directory, no slug reimplementation),
so what disappears from disk is exactly what the sidebar lists. Effects:

- Deleted sessions vanish from the sidebar immediately (the plugin repulls the
  session list after a clear; `session.list` reads persistence fresh).
- Empty project directories are pruned afterwards.
- The workspace itself stays registered; only its history is removed.
- The registry's stored session ids become stale until the next host start.
  Harmless: the sidebar joins membership against `session.list` and skips ids
  without a summary.

### What is deliberately kept

- **Sessions that are currently open** in the running host: deleting an
  attached log underneath its writer would leave a recreated, headerless file.
- **Cold subagent logs whose lineage reaches a live session** (fixpoint over
  `parentSession` chains): an open session's trajectory replay needs them.
- Anything the persistence backend cannot resolve to a well-shaped session
  directory (basename must equal the session id, parent must match the
  project-key shape). Such entries are counted as unresolved and reported
  back instead of deleted.

The dialog states the kept count before the user acknowledges.

## How it fits the GUI

Neither target surface declares a plugin slot. The workspace row menu belongs
to `ui-workspace`'s browser and the New Session button to the sidebar shell, so
the browser half integrates at the DOM level:

- A body-level observer recognizes the workspace menu by its Rename +
  Delete-workspace item pair when it portals open, and clones the danger row
  into a "Clear session history" row (same classes, same trash icon, red).
  The target workspace is captured from the anchor button's aria-label at
  pointerdown/keydown, with an occurrence index among same-titled rows so
  same-basename workspaces resolve deterministically.
- The New Session button gets a cloned red sibling below it (wide sidebar
  only; the 56px rail is left alone).

Every hook degrades to a no-op on a template mismatch (unknown locale,
restructured DOM) rather than breaking the sidebar. Both shipped locales
(English and 简体中文) are matched.

The dialog is the harness's own `RiskConfirmation` primitive (checkbox-gated),
hosted on the plugin's private React root. Both calls round-trip through the
Typert remote (`/api/clearSessionHistory/preview|clear`):

- `preview(input)` → `{ targets, kept }` for the scope, nothing touched.
  The dialog's counts and button label come from this.
- `clear(input)` → deletes and returns `{ deleted, targets, kept }`.

Scope input is `{ workspaceTitle, titleOccurrence }`; an empty title means
every workspace. Titles are resolved through `workspaceRegistry` (registry
display order), so the DOM order the sidebar shows is the order the node half
sees.

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
- There is no trash or undo: deletion is permanent. The checkbox in the
  dialog exists for that reason.
- Deleting logs does not edit `workspace.json`; stale ids are display-filtered
  and disappear from the stored record the next time the registry itself
  writes that workspace.

## Verification

- `pnpm test` (node half against stubbed services + temp sessions root):
  scope matching, live/subagent keep rules, occurrence resolution, unknown
  workspace soft failure, degenerate `locate()` refusal, missing-service
  failure.
- Live probe against a running instance (non-destructive):

  ```sh
  curl -s -X POST http://127.0.0.1:3080/api/clearSessionHistory/preview \
    -H 'content-type: application/json' \
    -d '{"type":"client-request","rpcId":"probe","method":"clearSessionHistory/preview",
         "payload":{"args":{"input":{"workspaceTitle":"","titleOccurrence":0}}}}'
  ```

  The returned `targets` count matches `find ~/.dsh/sessions -mindepth 2
  -maxdepth 2 -type d | wc -l` (minus currently-open sessions).
