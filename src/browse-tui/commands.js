export function createBrowseWindowLoadCommand(entryId, loadBrowseWindow) {
  return async (emit) => {
    const browseWindow = await loadBrowseWindow(entryId);
    emit({
      type: 'browse_window_loaded',
      entryId,
      browseWindow,
    });
  };
}

export function createChronologyLoadCommand(loadChronologyEntries, query) {
  return async (emit) => {
    const entries = await loadChronologyEntries();
    emit({
      type: 'chronology_loaded',
      entries,
      query,
    });
  };
}

export function createInspectLoadCommand(entryId, loadInspectEntry) {
  return async (emit) => {
    const inspectEntry = await loadInspectEntry(entryId);
    emit({
      type: 'inspect_loaded',
      entryId,
      inspectEntry,
    });
  };
}

export function createReflectPreviewCommand(entryId, promptType, previewReflectEntry) {
  return async (emit) => {
    const result = await previewReflectEntry(entryId, promptType);
    emit({
      type: 'reflect_previewed',
      entryId,
      result,
    });
  };
}

export function createReflectSaveCommand(
  entryId,
  promptType,
  response,
  startReflectSession,
  saveReflectSessionResponse,
  loadInspectEntry
) {
  return async (emit) => {
    const session = await startReflectSession(entryId, promptType);
    if (!session?.ok) {
      emit({
        type: 'reflect_failed',
        entryId,
        message: formatReflectFailureMessage(session),
      });
      return;
    }

    const saved = await saveReflectSessionResponse(session.sessionId, response);
    if (!saved) {
      emit({
        type: 'reflect_failed',
        entryId,
        message: 'Reflect session could not be saved',
      });
      return;
    }

    const inspectEntry = loadInspectEntry ? await loadInspectEntry(entryId) : null;
    emit({
      type: 'reflect_saved',
      entryId,
      sessionId: session.sessionId,
      savedEntryId: saved.id,
      inspectEntry,
    });
  };
}

export function formatReflectFailureMessage(result) {
  if (!result) {
    return 'Reflect failed';
  }

  if (result.code === 'seed_not_found') {
    return 'Seed entry not found';
  }

  if (result.code === 'seed_ineligible') {
    return result.eligibility?.text ?? 'This thought is not a good reflect seed';
  }

  return 'Reflect failed';
}
