import { quit } from '@flyingrobots/bijou-tui';
import { createWindowedBrowseModel, resizeBrowseModel } from './model.js';
import { handleJumpKey, handleMindKey, handleReflectKey, clearNoticeOnKey } from './keys.js';
import { applyBrowseAction } from './actions.js';
import {
  applyBrowseWindowLoaded,
  applyChronologyLoaded,
  maybeQueueInspectLoad,
} from './loaders.js';
import {
  applyReflectPreviewed,
  applyReflectSaved,
  applyReflectFailed,
} from './reflect.js';
import { browseKeymap } from './keymap.js';
import { browseLayout } from './view.js';

export function createBrowsePage({
  bootstrap,
  minds = [],
  activeMind = null,
  modelRef = null,
  loadBrowseWindow,
  loadChronologyEntries,
  loadInspectEntry,
  previewReflectEntry,
  startReflectSession,
  saveReflectSessionResponse,
  ctx,
}) {
  const title = minds.length > 1 && activeMind
    ? `THINK BROWSE [${activeMind.name}]`
    : 'THINK BROWSE';

  return {
    id: 'browse',
    title,

    init() {
      const model = createWindowedBrowseModel({
        bootstrap,
        inspectCache: new Map(),
        loadBrowseWindow,
        loadChronologyEntries,
        minds,
        activeMind,
      });
      const initModel = { ...model, phase: 'browse' };
      if (modelRef) { modelRef.current = initModel; }
      return [initModel, []];
    },

    update(msg, model) {
      // Resize from the frame
      if (msg.type === 'resize') {
        return [resizeBrowseModel(model, msg.columns, msg.rows), []];
      }

      // Async data messages
      if (msg.type === 'inspect_loaded') {
        const nextCache = new Map(model.inspectCache);
        if (msg.inspectEntry) {
          nextCache.set(msg.entryId, msg.inspectEntry);
        }
        return [{
          ...model,
          inspectCache: nextCache,
          inspectLoadingEntryId: model.inspectLoadingEntryId === msg.entryId
            ? null
            : model.inspectLoadingEntryId,
        }, []];
      }

      if (msg.type === 'browse_window_loaded') {
        return applyBrowseWindowLoaded(model, msg, loadInspectEntry);
      }

      if (msg.type === 'chronology_loaded') {
        return [applyChronologyLoaded(model, msg), []];
      }

      if (msg.type === 'reflect_previewed') {
        return [applyReflectPreviewed(model, msg), []];
      }

      if (msg.type === 'reflect_saved') {
        return [applyReflectSaved(model, msg), []];
      }

      if (msg.type === 'reflect_failed') {
        return [applyReflectFailed(model, msg), []];
      }

      // Raw key forwarded from observeKey (unhandled by keymaps)
      if (msg.type === 'raw_key') {
        return handleRawKey(msg.key, model, {
          loadInspectEntry,
          previewReflectEntry,
          startReflectSession,
          saveReflectSessionResponse,
          modelRef,
        });
      }

      // Keymap-dispatched actions arrive as direct messages
      // (browseKeymap.handle() returns action objects like { type: 'move', delta: 1 })
      if (msg.type && msg.type !== 'key' && msg.type !== 'mouse' && msg.type !== 'pulse') {
        return handleKeymapAction(msg, model, {
          loadInspectEntry,
          previewReflectEntry,
          startReflectSession,
          saveReflectSessionResponse,
          modelRef,
        });
      }

      return [model, []];
    },

    layout(model) {
      return browseLayout(model, ctx);
    },

    keyMap: browseKeymap,
    helpSource: browseKeymap,
  };
}

function handleRawKey(keyMsg, model, deps) {
  const maybeCleared = clearNoticeOnKey(model);
  model = maybeCleared;

  const mindResult = handleMindKey(model, keyMsg);
  if (mindResult) {
    if (mindResult.effect?.type === 'switch_mind') {
      const switchModel = { ...mindResult.model, switchTarget: mindResult.effect.mind };
      if (deps.modelRef) { deps.modelRef.current = switchModel; }
      return [switchModel, [quit()]];
    }
    if (deps.modelRef) { deps.modelRef.current = mindResult.model; }
    return [mindResult.model, []];
  }

  const jumpResult = handleJumpKey(model, keyMsg);
  if (jumpResult) {
    const [jumpModel, jumpCmds] = maybeQueueInspectLoad(jumpResult.model, deps.loadInspectEntry);
    return [jumpModel, jumpCmds];
  }

  const reflectResult = handleReflectKey(model, keyMsg);
  if (reflectResult) {
    const [reflectModel, reflectCmds] = maybeQueueInspectLoad(reflectResult.model, deps.loadInspectEntry);
    return [reflectModel, [...(reflectResult.cmds ?? []), ...reflectCmds]];
  }

  // Try the browse keymap for keys that observeKey forwarded
  // (keys not bound in the page keymap but maybe in a panel-specific context)
  const action = browseKeymap.handle(keyMsg);
  if (action) {
    return handleKeymapAction(enrichReflectAction(action, deps), model, deps);
  }

  return [model, []];
}

function handleKeymapAction(action, model, deps) {
  const maybeCleared = clearNoticeOnKey(model);
  model = maybeCleared;

  const enriched = enrichReflectAction(action, deps);

  const result = applyBrowseAction(model, enriched);
  if (result.effect?.type === 'quit') {
    return [result.model, [quit()]];
  }
  if (result.effect?.type === 'switch_mind') {
    const switchModel = { ...result.model, switchTarget: result.effect.mind };
    if (deps.modelRef) { deps.modelRef.current = switchModel; }
    return [switchModel, [quit()]];
  }

  const [nextModel, cmds] = maybeQueueInspectLoad(result.model, deps.loadInspectEntry);
  return [nextModel, [...(result.cmds ?? []), ...cmds]];
}

function enrichReflectAction(action, deps) {
  if (action.type === 'reflect') {
    return {
      ...action,
      previewReflectEntry: deps.previewReflectEntry,
      startReflectSession: deps.startReflectSession,
      saveReflectSessionResponse: deps.saveReflectSessionResponse,
      loadInspectEntry: deps.loadInspectEntry,
    };
  }
  return action;
}
