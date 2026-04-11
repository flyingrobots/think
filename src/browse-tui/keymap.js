import { createKeyMap } from '@flyingrobots/bijou-tui';

export const browseKeymap = createKeyMap()
  .group('Navigation', (group) => group
    .bind('j', 'Older', { type: 'move', delta: 1 })
    .bind('down', 'Older', { type: 'move', delta: 1 })
    .bind('k', 'Newer', { type: 'move', delta: -1 })
    .bind('up', 'Newer', { type: 'move', delta: -1 })
    .bind('home', 'Newest', { type: 'jump', target: 'newest' })
    .bind('end', 'Oldest', { type: 'jump', target: 'oldest' }))
  .group('Session', (group) => group
    .bind('[', 'Prev session', { type: 'session_move', direction: 'previous' })
    .bind(']', 'Next session', { type: 'session_move', direction: 'next' }))
  .group('View', (group) => group
    .bind('i', 'Inspect', { type: 'toggle_inspect' })
    .bind('s', 'Session', { type: 'toggle_session' })
    .bind('l', 'Log', { type: 'toggle_log' })
    .bind('/', 'Jump', { type: 'open_jump' })
    .bind('pageup', 'Scroll up', { type: 'scroll', direction: 'up' })
    .bind('pagedown', 'Scroll down', { type: 'scroll', direction: 'down' }))
  .group('Actions', (group) => group
    .bind('r', 'Reflect', { type: 'reflect' })
    .bind('m', 'Mind', { type: 'open_mind_switcher' })
    .bind('q', 'Quit', { type: 'quit' })
    .bind('escape', 'Close/Quit', { type: 'escape' }));
