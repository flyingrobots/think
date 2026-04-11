import {
  cpFilter,
  cpFocusNext,
  cpFocusPrev,
  cpPageDown,
  cpPageUp,
  cpSelectedItem,
} from '@flyingrobots/bijou-tui';
import { createJumpPalette, createMindPalette, currentEntry, resolveJumpEntries } from './resolve.js';
import { closeReflectModel } from './reflect.js';
import { createReflectSaveCommand } from './commands.js';
import { applyBrowseAction } from './actions.js';

export function handleJumpKey(model, msg) {
  if (model.panelMode !== 'jump') {
    return null;
  }

  if (msg.key === 'escape') {
    return applyBrowseAction(model, { type: 'close_panel' });
  }

  if (msg.key === 'enter') {
    return applyBrowseAction(model, {
      type: 'apply_jump_target',
      entryId: cpSelectedItem(model.jumpPalette)?.id ?? null,
    });
  }

  if (msg.key === 'backspace') {
    return {
      model: {
        ...model,
        jumpPalette: cpFilter(
          createJumpPalette(resolveJumpEntries(model)),
          model.jumpPalette.query.slice(0, -1)
        ),
      },
      effect: null,
    };
  }

  if (msg.key === 'down' || (msg.ctrl && msg.key === 'n')) {
    return {
      model: {
        ...model,
        jumpPalette: cpFocusNext(model.jumpPalette),
      },
      effect: null,
    };
  }

  if (msg.key === 'up' || (msg.ctrl && msg.key === 'p')) {
    return {
      model: {
        ...model,
        jumpPalette: cpFocusPrev(model.jumpPalette),
      },
      effect: null,
    };
  }

  if (msg.key === 'pagedown' || (msg.ctrl && msg.key === 'd')) {
    return {
      model: {
        ...model,
        jumpPalette: cpPageDown(model.jumpPalette),
      },
      effect: null,
    };
  }

  if (msg.key === 'pageup' || (msg.ctrl && msg.key === 'u')) {
    return {
      model: {
        ...model,
        jumpPalette: cpPageUp(model.jumpPalette),
      },
      effect: null,
    };
  }

  const character = keyMsgToPrintableChar(msg);
  if (!character) {
    return {
      model,
      effect: null,
    };
  }

  return {
    model: {
      ...model,
      jumpPalette: cpFilter(
        createJumpPalette(resolveJumpEntries(model)),
        `${model.jumpPalette.query}${character}`
      ),
    },
    effect: null,
  };
}

export function handleMindKey(model, msg) {
  if (model.panelMode !== 'mind') {
    return null;
  }

  if (msg.key === 'escape') {
    return applyBrowseAction(model, { type: 'close_panel' });
  }

  if (msg.key === 'enter') {
    return applyBrowseAction(model, {
      type: 'apply_mind_switch',
      mindName: cpSelectedItem(model.mindPalette)?.id ?? null,
    });
  }

  if (msg.key === 'backspace') {
    return {
      model: {
        ...model,
        mindPalette: cpFilter(
          createMindPalette(model.minds),
          model.mindPalette.query.slice(0, -1)
        ),
      },
      effect: null,
    };
  }

  if (msg.key === 'down' || (msg.ctrl && msg.key === 'n')) {
    return { model: { ...model, mindPalette: cpFocusNext(model.mindPalette) }, effect: null };
  }

  if (msg.key === 'up' || (msg.ctrl && msg.key === 'p')) {
    return { model: { ...model, mindPalette: cpFocusPrev(model.mindPalette) }, effect: null };
  }

  if (msg.key === 'pagedown' || (msg.ctrl && msg.key === 'd')) {
    return { model: { ...model, mindPalette: cpPageDown(model.mindPalette) }, effect: null };
  }

  if (msg.key === 'pageup' || (msg.ctrl && msg.key === 'u')) {
    return { model: { ...model, mindPalette: cpPageUp(model.mindPalette) }, effect: null };
  }

  const character = keyMsgToPrintableChar(msg);
  if (!character) {
    return { model, effect: null };
  }

  return {
    model: {
      ...model,
      mindPalette: cpFilter(
        createMindPalette(model.minds),
        `${model.mindPalette.query}${character}`
      ),
    },
    effect: null,
  };
}

export function handleReflectKey(model, msg) {
  if (model.panelMode !== 'reflect') {
    return null;
  }

  if (model.reflect.status === 'loading' || model.reflect.status === 'saving') {
    return {
      model,
      effect: null,
      cmds: [],
    };
  }

  if (msg.key === 'escape') {
    return {
      model: closeReflectModel(model, null),
      effect: null,
      cmds: [],
    };
  }

  if (msg.key === 'backspace') {
    return {
      model: {
        ...model,
        reflect: {
          ...model.reflect,
          draft: model.reflect.draft.slice(0, -1),
        },
      },
      effect: null,
      cmds: [],
    };
  }

  if (msg.key === 'enter') {
    if (model.reflect.draft.trim() === '') {
      return {
        model: closeReflectModel(model, 'Reflect skipped'),
        effect: null,
        cmds: [],
      };
    }

    if (!model.reflect.startReflectSession || !model.reflect.saveReflectSessionResponse) {
      return {
        model: closeReflectModel(model, 'Reflect is not available in this shell'),
        effect: null,
        cmds: [],
      };
    }

    return {
      model: {
        ...model,
        reflect: {
          ...model.reflect,
          status: 'saving',
        },
      },
      effect: null,
      cmds: [
        createReflectSaveCommand(
          currentEntry(model).id,
          model.reflect.promptType,
          model.reflect.draft,
          model.reflect.startReflectSession,
          model.reflect.saveReflectSessionResponse,
          model.reflect.loadInspectEntry
        ),
      ],
    };
  }

  const character = keyMsgToPrintableChar(msg);
  if (!character) {
    return {
      model,
      effect: null,
      cmds: [],
    };
  }

  return {
    model: {
      ...model,
      reflect: {
        ...model.reflect,
        draft: `${model.reflect.draft}${character}`,
      },
    },
    effect: null,
    cmds: [],
  };
}

export function keyMsgToPrintableChar(msg) {
  if (msg.ctrl || msg.alt) {
    return null;
  }

  if (msg.key === 'space') {
    return ' ';
  }

  if (msg.key.length !== 1) {
    return null;
  }

  if (msg.shift && /^[a-z]$/.test(msg.key)) {
    return msg.key.toUpperCase();
  }

  return msg.key;
}

export function clearNoticeOnKey(model) {
  if (!model.notice) {
    return model;
  }

  return {
    ...model,
    notice: null,
  };
}
