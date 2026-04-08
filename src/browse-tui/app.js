import { initDefaultContext } from '@flyingrobots/bijou-node';
import { quit, run } from '@flyingrobots/bijou-tui';
import { selectLogo } from '../splash.js';
import { shaderFrame, compositeAndRender, buildLogoMask, buildDistanceField, BG } from '../splash-shader.js';
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
  const splashResult = await showSplash();
  if (splashResult === 'quit') {
    return { type: 'quit' };
  }

  let effect = { type: 'quit' };

  const app = {
    init() {
      const model = createWindowedBrowseModel({
        bootstrap,
        inspectCache: new Map(),
        loadBrowseWindow,
        loadChronologyEntries,
      });
      return [{ ...model, phase: 'browse' }, []];
    },
    update(msg, model) {
      if (msg.type === 'resize') {
        return [resizeBrowseModel(model, msg.columns, msg.rows), []];
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
      return renderBrowseView(model, ctx);
    },
  };

  await run(app, { ctx: initDefaultContext() });
  return effect;
}

function showSplash() {
  let cols = process.stdout.columns || 80;
  let rows = process.stdout.rows || 24;
  let mode = 2; // 1=normal, 2=distance fade, 3=mask only
  const startTime = Date.now();

  function rebuildLayout() {
    const logo = selectLogo(cols, rows);
    const logoInfo = buildLogoMask(logo, cols, rows);
    const alphaField = buildDistanceField(logoInfo.mask, cols, rows);
    return { logoInfo, alphaField };
  }

  let layout = rebuildLayout();

  process.stdout.write('\x1b[?1049h'); // enter alt screen
  process.stdout.write('\x1b[?25l');   // hide cursor
  process.stdout.write(`\x1b[48;2;${BG[0]};${BG[1]};${BG[2]}m`);
  process.stdout.write('\x1b[2J');     // clear screen

  let hueAngle = 0;

  function renderFrame() {
    const elapsed = Date.now() - startTime;
    hueAngle = elapsed * 0.0001; // slow color drift
    const grid = shaderFrame(cols, rows, elapsed, hueAngle);
    const result = compositeAndRender(grid, layout.logoInfo, layout.alphaField, cols, rows, mode, elapsed);
    process.stdout.write('\x1b[H');    // move to top-left
    process.stdout.write(result.frame);
  }

  renderFrame();
  const interval = setInterval(renderFrame, 50); // ~20fps

  function onResize() {
    cols = process.stdout.columns || 80;
    rows = process.stdout.rows || 24;
    layout = rebuildLayout();
    process.stdout.write('\x1b[2J');   // clear screen on resize
  }

  process.stdout.on('resize', onResize);

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function onData(data) {
      const key = data[0];
      if (key === 13) {                           // Enter
        cleanup();
        resolve('enter');
      } else if (key === 113 || key === 27) {     // q / Escape
        cleanup();
        process.stdout.write('\x1b[?25h');
        process.stdout.write('\x1b[?1049l');
        resolve('quit');
      } else if (key === 49) {                     // 1
        mode = 1;
      } else if (key === 50) {                     // 2
        mode = 2;
      } else if (key === 51) {                     // 3
        mode = 3;
      }
    }

    function cleanup() {
      clearInterval(interval);
      process.stdout.removeListener('resize', onResize);
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    process.stdin.on('data', onData);
  });
}
