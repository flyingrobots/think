export function createAppContentReader(app) {
  if (typeof app?.getContent === 'function') {
    return async (nodeId) => await app.getContent(nodeId);
  }

  const core = typeof app?.core === 'function' ? app.core() : null;
  if (typeof core?.getContent === 'function') {
    return async (nodeId) => await core.getContent(nodeId);
  }

  throw new Error('Installed @git-stunts/git-warp does not expose a public content reader');
}
