import { currentEntry } from './resolve.js';
import { formatReflectFailureMessage } from './commands.js';

export function openReflectModel(model, promptType = null, deps = {}) {
  return {
    ...model,
    previousPanelMode: model.panelMode === 'reflect' ? model.previousPanelMode : model.panelMode,
    panelMode: 'reflect',
    notice: null,
    reflect: {
      status: 'loading',
      entryId: currentEntry(model).id,
      promptType,
      question: '',
      draft: '',
      previewReflectEntry: deps.previewReflectEntry ?? model.reflect.previewReflectEntry ?? null,
      startReflectSession: deps.startReflectSession ?? model.reflect.startReflectSession ?? null,
      saveReflectSessionResponse: deps.saveReflectSessionResponse ?? model.reflect.saveReflectSessionResponse ?? null,
      loadInspectEntry: deps.loadInspectEntry ?? model.reflect.loadInspectEntry ?? null,
    },
  };
}

export function closeReflectModel(model, notice = null) {
  return {
    ...model,
    panelMode: model.previousPanelMode ?? 'none',
    previousPanelMode: 'none',
    notice,
    reflect: {
      status: 'idle',
      entryId: null,
      promptType: null,
      question: '',
      draft: '',
      previewReflectEntry: model.reflect.previewReflectEntry ?? null,
      startReflectSession: model.reflect.startReflectSession ?? null,
      saveReflectSessionResponse: model.reflect.saveReflectSessionResponse ?? null,
      loadInspectEntry: model.reflect.loadInspectEntry ?? null,
    },
  };
}

export function applyReflectPreviewed(model, msg) {
  if (!msg.result?.ok) {
    return closeReflectModel(model, formatReflectFailureMessage(msg.result));
  }

  return {
    ...model,
    panelMode: 'reflect',
    reflect: {
      ...model.reflect,
      status: 'ready',
      promptType: msg.result.promptType,
      question: msg.result.question,
    },
  };
}

export function applyReflectSaved(model, msg) {
  let nextModel = closeReflectModel(model, 'Reflect saved');
  if (msg.inspectEntry) {
    const nextCache = new Map(nextModel.inspectCache);
    nextCache.set(msg.entryId, msg.inspectEntry);
    nextModel = {
      ...nextModel,
      inspectCache: nextCache,
    };
  }
  return nextModel;
}

export function applyReflectFailed(model, msg) {
  return closeReflectModel(model, msg.message ?? 'Reflect failed');
}
