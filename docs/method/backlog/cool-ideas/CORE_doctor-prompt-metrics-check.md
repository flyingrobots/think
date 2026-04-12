# Doctor: prompt metrics file check

Add a check to `runDiagnostics` that reports whether the prompt
metrics file exists and is readable. Currently doctor checks think
dir, repo, graph model, entry count, and upstream — but not the
macOS telemetry surface.

Noted in cycle 0007 retro as cool idea.
