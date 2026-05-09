import { drawer, modal, toast } from '@flyingrobots/bijou-tui';
import { perfOverlaySurface } from '@flyingrobots/bijou';
import { BG_TOKEN } from './style.js';
import {
  resolveLayout,
  resolveDrawerTitle,
  resolveReflectHint,
} from './resolve.js';
import {
  buildInspectContent,
  buildSessionContent,
  buildLogContent,
  buildJumpContent,
  buildMindContent,
} from './panels.js';
import { capitalize, wrapParagraphs } from './format.js';

export { BG_TOKEN };

export function buildBrowseOverlays(model, screenRect, ctx) {
  const overlays = [];
  const layout = resolveLayout(model);

  if (model.panelMode !== 'none' && model.panelMode !== 'reflect') {
    const innerWidth = Math.max(1, screenRect.width - 4);

    let content;
    switch (model.panelMode) {
      case 'inspect':
        content = buildInspectContent(model, innerWidth, ctx);
        break;
      case 'session':
        content = buildSessionContent(model, innerWidth, ctx);
        break;
      case 'log':
        content = buildLogContent(model, innerWidth, ctx);
        break;
      case 'jump':
        content = buildJumpContent(model, innerWidth, ctx);
        break;
      case 'mind':
        content = buildMindContent(model, innerWidth, ctx);
        break;
      default:
        content = '';
    }

    overlays.push(drawer({
      anchor: 'bottom',
      title: resolveDrawerTitle(model.panelMode),
      content,
      screenWidth: screenRect.width,
      screenHeight: screenRect.height,
      ctx,
      bgToken: BG_TOKEN,
      region: {
        row: 1,
        col: 0,
        width: screenRect.width,
        height: layout.bodyHeight,
      },
      height: layout.panelHeight,
    }));
  }

  if (model.panelMode === 'reflect') {
    const modalWidth = Math.max(48, Math.min(screenRect.width - 8, 92));
    overlays.push(modal({
      title: 'REFLECT',
      body: renderReflectModalBody(model, modalWidth),
      hint: resolveReflectHint(model),
      screenWidth: screenRect.width,
      screenHeight: screenRect.height,
      width: modalWidth,
      ctx,
      bgToken: BG_TOKEN,
    }));
  }

  // Transient notice overlay (session boundary, theme change, perf toggle, etc.)
  if (model.notice) {
    overlays.push(toast({
      title: 'THINK',
      message: model.notice,
      tone: 'INFO',
      anchor: 'bottom-right',
      ctx,
    }));
  }

  // Performance stream overlay
  if (model.perfStreamEnabled) {
    const stats = ctx?.perf?.getStats?.() ?? {
      fps: 60,
      frameTimeMs: 16.6,
      frameTimeHistory: [],
      width: screenRect.width,
      height: screenRect.height,
    };
    overlays.push(perfOverlaySurface(stats, {
      ctx,
      anchor: 'top-right',
      title: 'Perf Stream',
    }));
  }

  return overlays;
}

function renderReflectModalBody(model, width) {
  const lines = [];

  if (model.reflect.status === 'loading') {
    lines.push('Preparing reflect prompt...');
    return lines.join('\n');
  }

  if (model.reflect.status === 'saving') {
    lines.push('Saving reflect response...');
    return lines.join('\n');
  }

  lines.push(`Mode: ${capitalize(model.reflect.promptType ?? 'challenge')}`);
  lines.push('');
  lines.push('Question:');
  lines.push(wrapParagraphs(model.reflect.question, width - 4));
  lines.push('');
  lines.push('Response:');
  lines.push(
    wrapParagraphs(
      model.reflect.draft.length > 0 ? model.reflect.draft : '(type your reflect response)',
      width - 4
    )
  );

  return lines.join('\n');
}
