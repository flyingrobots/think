import { drawer, modal } from '@flyingrobots/bijou-tui';
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

  // Transient notice overlay (session boundary, etc.)
  if (model.notice) {
    const pad = 2;
    const text = ` ${model.notice} `;
    const noticeWidth = text.length + pad * 2;
    const col = Math.max(0, Math.floor((screenRect.width - noticeWidth) / 2));
    overlays.push({
      content: `╭${'─'.repeat(text.length)}╮\n│${text}│\n╰${'─'.repeat(text.length)}╯`,
      row: 1,
      col,
    });
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
