import { cpSelectedItem } from '@flyingrobots/bijou-tui';
import { createBrowseModel } from './model.js';
import { applyBrowseAction } from './actions.js';
import { currentEntry } from './resolve.js';
import { renderBrowseModel } from './view.js';
import { styleDim } from './style.js';
import {
  openReflectModel,
  closeReflectModel,
  applyReflectPreviewed,
  applyReflectSaved,
  applyReflectFailed,
} from './reflect.js';
import { formatReflectFailureMessage } from './commands.js';

export async function runBrowseTuiScript({
  entries,
  inspectById,
  initialEntryId = null,
  actions = [],
  previewReflectEntry = null,
  startReflectSession = null,
  saveReflectSessionResponse = null,
  loadInspectEntry = null,
}) {
  let model = createBrowseModel({ entries, inspectCache: inspectById, initialEntryId });
  const frames = [renderBrowseModel(model)];
  let effect = { type: 'quit' };

  for (const rawAction of actions) {
    if (isScriptJumpAction(rawAction)) {
      const opened = applyBrowseAction(model, {
        type: 'open_jump',
        query: rawAction.query ?? '',
      });
      ({ model } = opened);
      frames.push(renderBrowseModel(model));

      const selectedEntryId = rawAction.entryId
        ?? cpSelectedItem(model.jumpPalette)?.id
        ?? null;
      const completed = applyBrowseAction(model, {
        type: 'apply_jump_target',
        entryId: selectedEntryId,
      });
      ({ model } = completed);
      frames.push(renderBrowseModel(model));
      continue;
    }

    if (isScriptReflectAction(rawAction)) {
      // eslint-disable-next-line no-await-in-loop -- sequential action execution in scripted test flow
      const reflectResult = await runScriptReflectAction(model, rawAction, {
        previewReflectEntry,
        startReflectSession,
        saveReflectSessionResponse,
        loadInspectEntry,
      });
      ({ model } = reflectResult);
      frames.push(...reflectResult.frames);
      continue;
    }

    const action = normalizeScriptAction(rawAction);
    const result = applyBrowseAction(model, action);
    ({ model } = result);
    frames.push(renderBrowseModel(model));

    if (result.effect?.type === 'quit') {
      ({ effect } = result);
      break;
    }
  }

  return {
    effect,
    output: frames.join(`\n\n${styleDim(null, '-----')}\n\n`),
  };
}

function normalizeScriptAction(rawAction) {
  if (typeof rawAction === 'object' && rawAction !== null) {
    if (rawAction.type === 'reflect') {
      return {
        type: 'reflect',
        promptType: rawAction.mode ?? null,
      };
    }
    return rawAction;
  }

  switch (rawAction) {
    case 'older':
      return { type: 'move', delta: 1 };
    case 'newer':
      return { type: 'move', delta: -1 };
    case 'session_previous':
      return { type: 'session_move', direction: 'previous' };
    case 'session_next':
      return { type: 'session_move', direction: 'next' };
    case 'inspect':
      return { type: 'toggle_inspect' };
    case 'session':
      return { type: 'toggle_session' };
    case 'log':
      return { type: 'toggle_log' };
    case 'quit':
      return { type: 'quit' };
    case 'reflect':
      return { type: 'reflect', promptType: null };
    default:
      return { type: 'quit' };
  }
}

function isScriptJumpAction(rawAction) {
  return typeof rawAction === 'object'
    && rawAction !== null
    && rawAction.type === 'jump';
}

function isScriptReflectAction(rawAction) {
  return typeof rawAction === 'object'
    && rawAction !== null
    && rawAction.type === 'reflect';
}

async function runScriptReflectAction(model, rawAction, deps) {
  const frames = [];
  const openedModel = openReflectModel(model, rawAction.mode ?? null, deps);
  frames.push(renderBrowseModel(openedModel));

  const previewResult = deps.previewReflectEntry
    ? await deps.previewReflectEntry(currentEntry(openedModel).id, rawAction.mode ?? null)
    : {
        ok: false,
        code: 'seed_not_found',
      };
  let nextModel = applyReflectPreviewed(openedModel, {
    type: 'reflect_previewed',
    entryId: currentEntry(openedModel).id,
    result: previewResult,
  });
  frames.push(renderBrowseModel(nextModel));

  if (!previewResult.ok) {
    return {
      model: nextModel,
      frames,
    };
  }

  nextModel = {
    ...nextModel,
    reflect: {
      ...nextModel.reflect,
      draft: rawAction.response ?? '',
    },
  };
  frames.push(renderBrowseModel(nextModel));

  if ((rawAction.response ?? '').trim() === '') {
    return {
      model: closeReflectModel(nextModel, 'Reflect skipped'),
      frames: [...frames, renderBrowseModel(closeReflectModel(nextModel, 'Reflect skipped'))],
    };
  }

  const session = await deps.startReflectSession(currentEntry(nextModel).id, nextModel.reflect.promptType);
  if (!session?.ok) {
    const failedModel = applyReflectFailed(nextModel, {
      type: 'reflect_failed',
      entryId: currentEntry(nextModel).id,
      message: formatReflectFailureMessage(session),
    });
    return {
      model: failedModel,
      frames: [...frames, renderBrowseModel(failedModel)],
    };
  }

  const saved = await deps.saveReflectSessionResponse(session.sessionId, rawAction.response);
  const inspectEntry = deps.loadInspectEntry
    ? await deps.loadInspectEntry(currentEntry(nextModel).id)
    : null;
  const savedModel = applyReflectSaved(nextModel, {
    type: 'reflect_saved',
    entryId: currentEntry(nextModel).id,
    savedEntryId: saved?.id ?? null,
    sessionId: session.sessionId,
    inspectEntry,
  });

  return {
    model: savedModel,
    frames: [...frames, renderBrowseModel(savedModel)],
  };
}
