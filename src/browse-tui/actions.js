import { cpFilter, createScrollState, pageDown, pageUp } from '@flyingrobots/bijou-tui';
import { clamp } from './format.js';
import {
  currentEntry,
  resolveNeighbors,
  resolveSessionTraversal,
  resolveJumpEntries,
  resolveLayout,
  createJumpPalette,
} from './resolve.js';
import { buildThoughtContent } from './view.js';
import { openReflectModel } from './reflect.js';
import { queueBrowseWindowLoad, queueChronologyLoad } from './loaders.js';

export function applyBrowseAction(model, action) {
  switch (action.type) {
    case 'move': {
      if (model.mode === 'windowed') {
        const neighbors = resolveNeighbors(model);
        const targetEntry = action.delta > 0 ? neighbors.older : neighbors.newer;

        if (!targetEntry) {
          return {
            model,
            effect: null,
          };
        }

        return queueBrowseWindowLoad(model, targetEntry.id);
      }

      const nextIndex = clamp(model.currentIndex + action.delta, 0, model.entries.length - 1);
      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
        },
        effect: null,
      };
    }
    case 'jump': {
      if (model.mode === 'windowed') {
        if (!model.chronologyLoaded) {
          return queueChronologyLoad({
            ...model,
            panelMode: model.panelMode === 'jump' ? 'jump' : model.panelMode,
            notice: action.target === 'oldest'
              ? 'Loading chronology to jump to the oldest thought...'
              : 'Loading chronology to jump to the newest thought...',
          });
        }

        const targetEntry = action.target === 'oldest'
          ? model.entries.at(-1)
          : model.entries[0];

        if (!targetEntry) {
          return {
            model,
            effect: null,
          };
        }

        return queueBrowseWindowLoad(model, targetEntry.id, { panelMode: 'none' });
      }

      const nextIndex = action.target === 'oldest' ? model.entries.length - 1 : 0;
      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    }
    case 'session_move': {
      const sessionTraversal = resolveSessionTraversal(model);
      const targetEntry = action.direction === 'previous'
        ? sessionTraversal.previous
        : sessionTraversal.next;

      if (!targetEntry) {
        return {
          model: {
            ...model,
            notice: action.direction === 'previous'
              ? 'No previous thought in this session.'
              : 'No next thought in this session.',
          },
          effect: null,
        };
      }

      if (model.mode === 'windowed') {
        return queueBrowseWindowLoad(model, targetEntry.id);
      }

      const nextIndex = model.entries.findIndex((entry) => entry.id === targetEntry.id);
      if (nextIndex === -1) {
        return {
          model,
          effect: null,
        };
      }

      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    }
    case 'toggle_inspect':
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'inspect' ? 'none' : 'inspect',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'toggle_session':
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'session' ? 'none' : 'session',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'toggle_log':
      if (model.mode === 'windowed' && model.panelMode !== 'log' && !model.chronologyLoaded) {
        return queueChronologyLoad({
          ...model,
          panelMode: 'log',
          contentScrollY: 0,
          notice: null,
        });
      }
      return {
        model: {
          ...model,
          panelMode: model.panelMode === 'log' ? 'none' : 'log',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'open_jump':
      if (model.mode === 'windowed' && !model.chronologyLoaded) {
        return queueChronologyLoad({
          ...model,
          panelMode: 'jump',
          contentScrollY: 0,
          notice: null,
        }, action.query ?? '');
      }
      return {
        model: {
          ...model,
          panelMode: 'jump',
          jumpPalette: cpFilter(createJumpPalette(resolveJumpEntries(model)), action.query ?? ''),
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    case 'apply_jump_target': {
      if (!action.entryId) {
        return {
          model,
          effect: null,
        };
      }

      if (model.mode === 'windowed') {
        return queueBrowseWindowLoad(model, action.entryId, { panelMode: 'none' });
      }

      const nextIndex = model.entries.findIndex((entry) => entry.id === action.entryId);
      if (nextIndex === -1) {
        return {
          model,
          effect: null,
        };
      }

      return {
        model: {
          ...model,
          currentIndex: nextIndex,
          panelMode: 'none',
          contentScrollY: 0,
          notice: null,
        },
        effect: null,
      };
    }
    case 'close_panel':
      return {
        model: {
          ...model,
          panelMode: 'none',
          notice: null,
        },
        effect: null,
      };
    case 'scroll': {
      const layout = resolveLayout(model);
      const content = buildThoughtContent(model, layout.bodyWidth);
      const state = createScrollState(content, layout.thoughtHeight);
      const nextState = action.direction === 'down'
        ? pageDown(state)
        : pageUp(state);
      return {
        model: {
          ...model,
          contentScrollY: nextState.y,
          notice: null,
        },
        effect: null,
      };
    }
    case 'reflect':
      return {
        model: openReflectModel(model, action.promptType ?? null),
        effect: null,
        cmds: action.previewReflectEntry
          ? [createReflectPreviewCmd(currentEntry(model).id, action.promptType ?? null, action.previewReflectEntry)]
          : [],
      };
    case 'escape':
      if (model.panelMode !== 'none') {
        return {
          model: {
            ...model,
            panelMode: 'none',
          },
          effect: null,
        };
      }
      return {
        model,
        effect: { type: 'quit' },
      };
    case 'quit':
      return {
        model,
        effect: { type: 'quit' },
      };
    default:
      return {
        model,
        effect: null,
      };
  }
}

function createReflectPreviewCmd(entryId, promptType, previewReflectEntry) {
  return async (emit) => {
    const result = await previewReflectEntry(entryId, promptType);
    emit({
      type: 'reflect_previewed',
      entryId,
      result,
    });
  };
}
