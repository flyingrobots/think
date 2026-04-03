# Capture recovery and quiet backup flushes

## Capture recovery queue

If upstream backup fails, keep a visible but quiet backlog of pending backups that can flush later without bothering the user during capture. No admin-console UX. No network dependency for local success.

## Quiet backup flushes

A quiet background flush path for pending backups: no nagging, no control-panel UX, no impact on local capture success. Related to the capture recovery queue idea but narrower and more operationally grounded.
