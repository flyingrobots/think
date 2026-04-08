import { createBijou } from '@flyingrobots/bijou';
import { nodeRuntime, nodeIO, chalkStyle } from '@flyingrobots/bijou-node';
import { createFramedApp, run } from '@flyingrobots/bijou-tui';
import { thinkTheme } from './theme.js';
import { selectLogo } from '../splash.js';
import { shaderFrame, compositeAndRender, buildLogoMask, buildInteriorMask, buildDistanceFromOutline, getShaderCount, getShaderName, BG } from '../splash-shader.js';
import { createBrowsePage } from './page.js';
import { buildBrowseOverlays } from './overlays.js';
import { resolveHelpLine } from './resolve.js';

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

  const ctx = createBijou({
    runtime: nodeRuntime(),
    io: nodeIO(),
    style: chalkStyle(),
    theme: thinkTheme,
  });

  const browsePage = createBrowsePage({
    bootstrap,
    loadBrowseWindow,
    loadChronologyEntries,
    loadInspectEntry,
    previewReflectEntry,
    startReflectSession,
    saveReflectSessionResponse,
    ctx,
  });

  const app = createFramedApp({
    pages: [browsePage],
    keyPriority: 'page-first',
    bodyTopRows: 1,
    bodyBottomRows: 1,
    helpLineSource: ({ model }) => {
      const pageModel = model.pageModels?.[browsePage.id];
      if (!pageModel) {
        return browsePage.keyMap;
      }
      return resolveHelpLine(pageModel);
    },
    overlayFactory: (overlayCtx) => buildBrowseOverlays(overlayCtx.pageModel, overlayCtx.screenRect, ctx),
    observeKey: (msg, route) => {
      // Let the frame handle its own bindings (help, quit confirm, etc.)
      if (route === 'frame' || route === 'help' || route === 'palette') {
        return undefined;
      }
      // Forward unhandled keys to the page for jump/reflect handling
      return { type: 'raw_key', key: msg };
    },
  });

  // Workaround for RE-017: frame doesn't fill surface.primary.bg.
  // Set terminal background before bijou enters alt screen.
  process.stdout.write(`\x1b[48;2;${BG[0]};${BG[1]};${BG[2]}m`);

  await run(app, { ctx });
  return { type: 'quit' };
}

function showSplash() {
  let cols = process.stdout.columns || 80;
  let rows = process.stdout.rows || 24;
  const startTime = Date.now();

  function rebuildLayout() {
    const { art, type } = selectLogo(cols, rows);
    const logoInfo = buildLogoMask(art, cols, rows);
    const interiorMask = buildInteriorMask(logoInfo.mask, cols, rows);
    const distField = buildDistanceFromOutline(logoInfo.mask, cols, rows);
    return { logoInfo, interiorMask, distField, logoType: type };
  }

  let layout = rebuildLayout();

  process.stdout.write('\x1b[?1049h'); // enter alt screen
  process.stdout.write('\x1b[?25l');   // hide cursor
  process.stdout.write(`\x1b[48;2;${BG[0]};${BG[1]};${BG[2]}m`);
  process.stdout.write('\x1b[2J');     // clear screen

  let lastFrameTime = Date.now();
  let fps = 0;
  let frameCount = 0;
  let fpsAccum = 0;
  let transition = null;
  let shaderIndex = Math.floor(Math.random() * getShaderCount());

  function renderFrame() {
    const now = Date.now();
    const elapsed = now - startTime;
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    frameCount++;
    fpsAccum += dt;
    if (fpsAccum >= 1000) {
      fps = frameCount;
      frameCount = 0;
      fpsAccum -= 1000;
    }

    if (transition) {
      transition.progress = Math.min(1.0, (now - transition.startTime) / 1500);
    }

    const hueAngle = elapsed * 0.0001;
    const grid = shaderFrame(cols, rows, elapsed, hueAngle, shaderIndex);
    const frame = compositeAndRender(
      grid, layout.logoInfo, layout.interiorMask, layout.distField,
      cols, rows, layout.logoType, elapsed, fps, transition,
      getShaderName(shaderIndex)
    );
    process.stdout.write('\x1b[H');
    process.stdout.write(frame);
  }

  renderFrame();
  const interval = setInterval(renderFrame, 50);

  function onResize() {
    cols = process.stdout.columns || 80;
    rows = process.stdout.rows || 24;
    layout = rebuildLayout();
    process.stdout.write('\x1b[2J');
  }

  process.stdout.on('resize', onResize);

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function onData(data) {
      const seq = data.toString();
      const key = data[0];
      if (key === 13 && !transition) {                    // Enter
        transition = { startTime: Date.now(), progress: 0 };
        const checkDone = setInterval(() => {
          if (transition && transition.progress >= 1.0) {
            clearInterval(checkDone);
            cleanup();
            resolve('enter');
          }
        }, 50);
      } else if (key === 113 || (key === 27 && data.length === 1)) { // q / Escape (not arrow seq)
        cleanup();
        process.stdout.write('\x1b[?25h');
        process.stdout.write('\x1b[?1049l');
        resolve('quit');
      } else if (seq === '\x1b[C' || key === 9) {        // Right / Tab — next shader
        shaderIndex = (shaderIndex + 1) % getShaderCount();
      } else if (seq === '\x1b[D') {                      // Left — previous shader
        shaderIndex = (shaderIndex - 1 + getShaderCount()) % getShaderCount();
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
