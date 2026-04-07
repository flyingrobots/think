# Raise SSJR grades for `src/cli/interactive.js`

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`, `P7 B`.

The interactive shell helpers are structurally fine, but they still pass around a lot of loose prompt/render state. Keep the host concerns here, while moving reusable interaction semantics into runtime-backed forms where they matter.
