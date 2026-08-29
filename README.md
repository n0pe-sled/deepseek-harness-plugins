# deepseek-harness-plugins

Plugins for the [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness)
web GUI. Each plugin is a dual-half dsh **bundle** — a node half that runs
host-side and a browser half served to the web UI — and is installed by
referencing its directory on a machine that runs `dsh`.

| Plugin | What it does |
|---|---|
| [`dsh-skill-mcp-manager`](skill-mcp-manager/README.md) | **Settings → "Skills & MCP"**. Manage skills in `~/.agents/skills` (list, add by typing or **uploading a `.md` file**, toggle model/user visibility) and MCP servers (add/remove stdio & streamable-http servers with live connection status). MCP changes are written to `~/.dsh/cordis.patch.yml` and **go live without restarting the GUI** via dsh's hot config reload. |
| [`dsh-system-prompt-editor`](system-prompt-editor/README.md) | **Settings → "System Prompt"**. Edit the assembled system prompt of every new session: custom text, persona, and tool-guidance overrides, plus a preview of the full model-visible prompt. Changes apply on the very next request — no restart. |
| [`dsh-web-search-searxng`](web-search-searxng/README.md) | **Web search via SEARXNG.** Registers a SEARXNG-backed `WebSearchProvider` into the `ctx.web` seam so the model's `web_search` tool runs against your own instance instead of the shipped DeepSeek-backed provider. Host-only, no Settings UI. |
| [`dsh-clear-session-history`](clear-session-history/README.md) | **Clear session history from disk.** Red "Clear session history" row in each workspace's "…" menu, red "Clear all session history" button below New Session, and red "Delete session" row in each session's "…" menu. All delete session logs through the host's persistence backend and gate the action behind a checkbox confirm showing the exact scope, then reload. Workspace/all flows keep currently-open sessions and remove the cleared workspace(s); Delete session works on open-but-idle sessions too (only an actively running agent is refused), hiding the row as it goes. |

Each plugin's README documents its behavior, config, and verification in detail.

## Prerequisites

- A working `dsh` install (the plugin targets the same runtime that ships
  `@deepseek-ai/dsh-mcp-client`, so the MCP bridge resolves automatically).
- `pnpm` on `PATH` (used by `dsh plugin` to manage profile dependencies).
- Node 22+.

## Install

Clone the repo somewhere stable (the profile links to this path), then add
each plugin to the profile you run — `web` is the web GUI, replace it with any
other profile name as needed:

```bash
git clone https://github.com/n0pe-sled/deepseek-harness-plugins.git ~/dsh-plugins

dsh plugin --profile web add ~/dsh-plugins/skill-mcp-manager
dsh plugin --profile web add ~/dsh-plugins/system-prompt-editor
dsh plugin --profile web add ~/dsh-plugins/clear-session-history
```

Restart the GUI, then open **Settings** — the new "Skills & MCP" and "System
Prompt" sections will be there:

```bash
dsh web
```

### What `dsh plugin add <dir>` does

It runs `pnpm add <dir>` inside the profile (initializing it first if
needed), then auto-appends the package to the profile's
`dsh.profile.bundles` layer because it declares a `dsh.bundle` patch. The same
patch row also puts the package on the web client roster, so the Settings
sections appear without any extra wiring.

### Verify

```bash
# after restarting the GUI, each plugin should serve its browser bundle:
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:3080/plugins/dsh-skill-mcp-manager/client.js    # 200
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:3080/plugins/dsh-system-prompt-editor/client.js # 200
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:3080/plugins/dsh-clear-session-history/client.js # 200
```

## Updating

All installs are `link:` to your clone, so updates are just `git pull` on each
machine and a GUI restart:

```bash
git -C ~/dsh-plugins pull
# restart dsh web
```

## Notes

- The built `lib/` (node + client halves) is **committed**, so a fresh clone
  works with zero build steps. The `prepare` script rebuilds automatically on
  `npm publish` or git-hosted installs.
- Installing straight from a git URL (`dsh plugin --profile web add
  git+https://github.com/n0pe-sled/deepseek-harness-plugins.git` +
  `<subpath>`/tag) also works; pnpm ≥ 10 may ask you to allowlist the package's
  `prepare` build in the profile's `pnpm-workspace.yaml` (`allowBuilds`) — the
  `dsh plugin` command prints the exact key.
- `system-prompt-editor` also lists install details targeting a single
  checkout containing the plugin; `skill-mcp-manager` documents its
  architecture (settings → home-patch reconcile → hot-applied MCP rows) and
  verified live add/remove flow.
