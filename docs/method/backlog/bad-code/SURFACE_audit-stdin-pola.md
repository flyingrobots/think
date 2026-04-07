# Plain `think` silently ignores piped stdin

`think` intentionally requires `--ingest` for stdin capture, but the current no-diagnostic behavior still violates normal shell expectations. The docs explain it, but the interface itself does not help the surprised caller.

Keep the safety property. Improve the affordance.
