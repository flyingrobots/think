import { initDefaultContext } from '@flyingrobots/bijou-node';
import { quit, run } from '@flyingrobots/bijou-tui';
import { renderSplashView } from '../splash.js';
import { createWindowedBrowseModel, resizeBrowseModel } from './model.js';
import { handleJumpKey, handleReflectKey, clearNoticeOnKey } from './keys.js';
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
import { renderBrowseView } from './view.js';
import { browseKeymap } from './keymap.js';

export async function runBrowseTui({
  bootstrap,
  loadBrowseWindow = null,
  loadChronologyEntries = null,
  loadInspectEntry = null,
  previewReflectEntry = null,
  startReflectSession = null,
  saveReflectSessionResponse = null,
}) {
  let effect = { type: 'quit' };

  const app = {
    init() {
      return [createWindowedBrowseModel({
        bootstrap,
        inspectCache: new Map(),
        loadBrowseWindow,
        loadChronologyEntries,
      }), []];
    },
    update(msg, model) {
      if (msg.type === 'resize') {
        return [resizeBrowseModel(model, msg.columns, msg.rows), []];
      }

      if (model.phase === 'splash') {
        if (msg.type === 'key' && msg.key === 'enter') {
          return [{ ...model, phase: 'browse' }, []];
        }
        if (msg.type === 'key' && (msg.key === 'q' || msg.key === 'escape')) {
          return [model, [quit()]];
        }
        return [model, []];
      }

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
        const [windowModel, windowCmds] = applyBrowseWindowLoaded(model, msg, loadInspectEntry);
        return [windowModel, windowCmds];
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

      if (msg.type !== 'key') {
        return [model, []];
      }

      const maybeCleared = clearNoticeOnKey(model);
      model = maybeCleared;

      const jumpResult = handleJumpKey(model, msg);
      if (jumpResult) {
        const [jumpModel, jumpCmds] = maybeQueueInspectLoad(jumpResult.model, loadInspectEntry);
        return [jumpModel, jumpCmds];
      }

      const reflectResult = handleReflectKey(model, msg);
      if (reflectResult) {
        const [reflectModel, reflectCmds] = maybeQueueInspectLoad(reflectResult.model, loadInspectEntry);
        return [reflectModel, [...(reflectResult.cmds ?? []), ...reflectCmds]];
      }

      let action = browseKeymap.handle(msg);
      if (!action) {
        return [model, []];
      }

      if (action.type === 'reflect') {
        action = {
          ...action,
          previewReflectEntry,
          startReflectSession,
          saveReflectSessionResponse,
          loadInspectEntry,
        };
      }

      const result = applyBrowseAction(model, action);
      if (result.effect?.type === 'quit') {
        ({ effect } = result);
        return [result.model, [quit()]];
      }

      const [nextModel, cmds] = maybeQueueInspectLoad(result.model, loadInspectEntry);
      return [nextModel, [...(result.cmds ?? []), ...cmds]];
    },
    view(model) {
      const ctx = initDefaultContext();
      if (model.phase === 'splash') {
        return renderSplashView(model.columns, model.rows, ctx);
      }
      return renderBrowseView(model, ctx);
    },
  };

  await run(app, { ctx: initDefaultContext() });
  return effect;
}
