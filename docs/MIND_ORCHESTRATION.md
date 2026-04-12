# Mind Orchestration

Think supports multiple **minds** — separate thought archives that
live side by side under `~/.think/`. Each mind is a self-contained
git-backed repository with its own captures, sessions, and derived
artifacts.

## What is a mind?

Any directory under `~/.think/` that contains a git repository
(a `.git/` subdirectory) is a mind. The directory name is the
mind's display name.

```
~/.think/
  repo/          → "default" mind (the original single-mind path)
  claude/        → "claude" mind
  work/          → "work" mind
  metrics/       → NOT a mind (no .git/)
```

The special directory `~/.think/repo` displays as **"default"** for
backward compatibility — it's the mind Think uses when no other is
selected.

## Creating a mind

```bash
mkdir ~/.think/work
cd ~/.think/work
git init
```

That's it. Think discovers it automatically on the next browse launch.
No configuration files, no registration step. The filesystem is the
registry.

## Discovery

`discoverMinds()` in `src/minds.js` scans `~/.think/` for directories
containing a valid git repo. Results are sorted: default first, then
alphabetical by name. Non-directory entries and directories without
`.git/` are ignored.

## Browsing minds

### Splash screen

When you launch `think --browse`, the splash screen shows the active
mind's name (e.g., `◀ default ▶`). If multiple minds exist:

- **Tab** — cycle to the next mind
- **Shift+Tab** — cycle to the previous mind
- **Left/Right arrows** — cycle shaders manually (within the current mind)
- **Enter** — open the selected mind

Each mind gets a **deterministic shader** derived from its name via
a djb2 hash. The same mind always looks the same visually.

When only one mind exists, the splash behaves exactly as before —
no mind label, Tab cycles shaders.

### Browse TUI

Inside the browse TUI, press **`m`** to open the mind switcher — a
command palette listing all discovered minds. Select one to switch.
The browse session tears down and re-bootstraps with the new mind's
data.

The header shows the active mind name when multiple minds exist
(e.g., `THINK BROWSE [claude]`).

## Capture

Capture always goes to the default mind (`~/.think/repo`) or
whatever `THINK_REPO_DIR` points to. Mind selection in browse is
read-only — it does not change which mind receives new captures.

To capture into a specific mind, set the environment variable:

```bash
THINK_REPO_DIR=~/.think/work think "work thought"
```

## THINK_REPO_DIR interaction

When `THINK_REPO_DIR` is set, it overrides the default mind for
both capture and browse. The mind switcher in the TUI is limited to
a single-element list containing the overridden path.

When `THINK_REPO_DIR` is not set, Think discovers all minds under
`~/.think/` and uses `~/.think/repo` as the default.

## Agent isolation

Agents can maintain their own thought archives by using separate
mind directories:

```bash
# Create a mind for an agent
mkdir -p ~/.think/claude && cd ~/.think/claude && git init

# Agent captures into its own mind
THINK_REPO_DIR=~/.think/claude think "agent thought"

# Human browses the agent's mind in the TUI (press m to switch)
think --browse
```

This keeps human and agent thought streams separate without
configuration files or process isolation — just filesystem
boundaries.

## Limitations

- **No cross-mind search** — `think --remember` searches the default
  mind only. Cross-mind recall is a backlog item.
- **No mind creation from CLI** — `think --mind=<name>` is a backlog
  item. For now, use `mkdir + git init`.
- **No per-mind themes** — all minds share the same plum palette.
  Per-mind color themes are a backlog item.
