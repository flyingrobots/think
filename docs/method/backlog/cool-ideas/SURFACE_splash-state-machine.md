# Pure splash state machine

Extract the splash animation logic into a pure function:
`nextSplashState(state, elapsed, input) → { nextState, frame }`.
This makes the shader transitions, mind cycling, and fade
logic testable without terminal I/O. Could enable splash
rendering in non-terminal contexts (web, recording).
