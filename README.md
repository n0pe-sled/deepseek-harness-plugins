# deepseek-harness-plugins — retired

**This repository no longer holds the plugins.** They moved into the harness
checkout, which is now the single clone target.

## Where everything went

| What | Where it lives now |
|---|---|
| The 13 plugin repositories | submodules of [`deepseek-harness`](https://github.com/n0pe-sled/deepseek-harness) under `plugins/<name>/` |
| The skills repositories | submodules of the same checkout: `skills/` (with its own `specterops-skills` submodule) |
| Plugin → profile syncing | `dsh-manage.mjs` at the harness root |

Each plugin is still its own repository under
[`n0pe-sled`](https://github.com/n0pe-sled?tab=repositories) — only the wiring
that pointed at them from here moved. The full plugin table that used to be in
this file is in this repository's git history.

## Install

```sh
git clone --recurse-submodules https://github.com/n0pe-sled/deepseek-harness.git
cd deepseek-harness
node dsh-manage.mjs --setup
```

`--setup` initializes the submodules, installs and builds the harness, then
builds each plugin for the local platform. Nothing compiled is version
controlled, so this step is what produces every `lib/` directory.

See [`SETUP.md`](https://github.com/n0pe-sled/deepseek-harness/blob/master/SETUP.md)
in that checkout for the layout, the profile commands, and the directories
deliberately left untracked.

## Why the plugins are listed flat

The plugin repositories are listed directly in the harness `.gitmodules`
rather than nested under an intermediate repository here. Nested submodules do
not initialize under `git clone --recurse-submodules`, so flattening them is
what makes a plain recursive clone produce a complete tree.
