---
title: "Multiple minds"
legend: "CORE"
cycle: "0004-multiple-minds"
source_backlog: "docs/method/backlog/cool-ideas/CORE_multiple-minds.md"
---

# Multiple minds

Source backlog item: `docs/method/backlog/cool-ideas/CORE_multiple-minds.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

The browse TUI lets you discover and switch between multiple thought
archives ("minds") — on the splash screen before entering, and from
inside browse without restarting.

## Playback Questions

### Human

- [ ] Can I see which mind I'm about to enter on the splash screen?
- [ ] Can I cycle through minds on splash with Tab and see each one's
      shader change?
- [ ] Can I switch minds inside browse without quitting?

### Agent

- [ ] Does mind discovery find all valid repos under `~/.think/`?
- [ ] Does each mind get a deterministic shader from its name?
- [ ] Does the single-mind case work with zero extra friction?
- [ ] Does `THINK_REPO_DIR` still work as an explicit override?
- [ ] Does `--json` output identify which mind is active?

## Accessibility and Assistive Reading

- Linear truth: the mind name is plain text. The shader is decoration.
  The scripted browse path and `--json` output identify the active mind
  by name, not by visual appearance.
- Non-visual: mind switching is keyboard-driven (Tab on splash, `m` in
  browse). Screen readers see the mind name, not the shader.

## Localization and Directionality

- Mind names are directory names — filesystem encoding, no i18n concern.
- "Mind" is the user-facing term. Keep it in the UI vocabulary.

## Agent Inspectability and Explainability

- `--json` browse output includes `mind` field in bootstrap events.
- MCP tools receive the active mind context when invoked from browse.
- Mind list is discoverable: `think --minds` or equivalent.

## Non-goals

- Capture routing — this cycle is browse-only. Capture still goes to
  the default mind (`~/.think/repo` or `THINK_REPO_DIR`).
- Mind creation — create a mind by making a directory. No CLI scaffolding.
- Shared minds, agent-owned minds, holding areas — future cycles.
- Mind-specific configuration files — not yet.

## Design

### What is a mind?

A directory under `~/.think/` that contains a valid Think repo (a
directory with `.git/` inside it). The directory name is the mind's
display name.

```
~/.think/
  repo/          → mind "default" (backward compatible)
  claude/        → mind "claude"
  work/          → mind "work"
  metrics/       → NOT a mind (no .git/)
```

Special case: `~/.think/repo` displays as **"default"** rather than
"repo", since that's the legacy single-mind path.

### Mind discovery

```js
discoverMinds(thinkDir)  →  [{ name, repoDir, isDefault }]
```

Scan `~/.think/` for subdirectories. For each, check if it contains a
git repo (`hasGitRepo`). Return sorted by name, with the default mind
first.

### Shader assignment

Each mind gets a deterministic shader index derived from its name:

```js
function shaderForMind(name) {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % getShaderCount();
}
```

Same mind → same shader, always. The 5 current shaders (warp, plasma,
ripple, rain, heartbeat) give each mind a distinct visual identity.

Manual override (Left/Right arrows) still works within a session but
doesn't persist.

### Splash screen changes

Current flow: random shader → "Press [ Enter ]" → browse.

New flow:
- Show the active mind's name below the logo (dim text, like the
  current shader name in the upper right).
- Show the mind's deterministic shader.
- **Tab**: cycle to next mind. Shader transitions instantly. Mind name
  updates.
- **Shift+Tab**: cycle to previous mind.
- **Left/Right arrows**: still cycle shaders manually (override).
- **Enter**: open browse for the selected mind.
- **Single mind**: behaves exactly like today. Mind name shown but no
  Tab affordance needed.

### Browse TUI changes

- **Header**: show active mind name (e.g., "default" or "claude").
- **`m` key**: open command palette with discovered minds. Select one
  → browse reloads with that mind's data (fresh bootstrap, entries,
  session context).
- Reloading a mind means calling the same bootstrap pipeline with a
  different `repoDir`. The page model is torn down and rebuilt.

### Path changes

```js
// New export in paths.js
export function getRepoDirForMind(mindName) {
  if (mindName === 'default') return path.join(getThinkDir(), 'repo');
  return path.join(getThinkDir(), mindName);
}
```

`getLocalRepoDir()` remains unchanged — it returns the capture-path
default. Browse uses `getRepoDirForMind()` when a mind is selected.

### THINK_REPO_DIR interaction

If `THINK_REPO_DIR` is set, it becomes the active mind on launch. It
still appears in the mind list with its directory name. Other
discovered minds are still browsable via Tab/`m`.

### Edge cases

- No minds found (empty `~/.think/`) → show "no minds" message, no
  crash.
- One mind → works exactly like today. Tab is a no-op.
- Mind deleted while browsing → handle gracefully on next bootstrap
  attempt (show error in browse, don't crash).
