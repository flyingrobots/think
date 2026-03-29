# Milestone 2 Retrospective: macOS Capture Surface

Date: 2026-03-22
Status: complete

## Milestone Summary

Milestone 2 delivered the first native macOS capture surface for `think`:

- a menu bar app exists
- a global hotkey exists
- a transient capture panel exists
- the panel uses the same capture core as the CLI
- the panel is centered and focus-ready on open
- save feedback now lives in the menu bar instead of slowing the panel down
- the app can detect when a newer local build exists and recommend a restart
- the M2 Swift tests-as-spec suite is green

This is enough to close the milestone.

Milestone 2 did not exist to prove storage, sync, or reflection ideas. It existed to prove a narrower thing:

the hotkey path becomes the preferred capture path on a Mac.

Based on live use and direct feedback, that bar is met.

## What We Set Out To Prove

Milestone 2 existed to prove:

- the CLI is not the only viable capture surface
- a native macOS adapter can stay thin without duplicating capture logic
- hotkey capture can feel more like a reflex than opening a tool
- the menu bar app can remain a supporting presence instead of becoming a control panel

## What Shipped

Implementation:

- native menu bar app in [`macos/Sources/ThinkMenuBarApp/ThinkMenuBarApp.swift`](../../macos/Sources/ThinkMenuBarApp/ThinkMenuBarApp.swift)
- transient `NSPanel` controller in [`macos/Sources/ThinkMenuBarApp/CapturePanelController.swift`](../../macos/Sources/ThinkMenuBarApp/CapturePanelController.swift)
- SwiftUI panel view in [`macos/Sources/ThinkMenuBarApp/CapturePanelView.swift`](../../macos/Sources/ThinkMenuBarApp/CapturePanelView.swift)
- global hotkey integration in [`macos/Sources/ThinkMenuBarApp/GlobalHotKeyMonitor.swift`](../../macos/Sources/ThinkMenuBarApp/GlobalHotKeyMonitor.swift)
- shared adapter boundary through [`macos/Sources/ThinkCaptureAdapter/ThinkCLIAdapter.swift`](../../macos/Sources/ThinkCaptureAdapter/ThinkCLIAdapter.swift)

Specification:

- panel-model behavior tests in [`macos/Tests/ThinkCaptureAdapterTests/CapturePanelModelTests.swift`](../../macos/Tests/ThinkCaptureAdapterTests/CapturePanelModelTests.swift)
- CLI adapter tests in [`macos/Tests/ThinkCaptureAdapterTests/ThinkCLIAdapterTests.swift`](../../macos/Tests/ThinkCaptureAdapterTests/ThinkCLIAdapterTests.swift)
- build-update tracking tests in [`macos/Tests/ThinkMenuBarSupportTests/BuildUpdateTrackerTests.swift`](../../macos/Tests/ThinkMenuBarSupportTests/BuildUpdateTrackerTests.swift)

Operational behavior:

- `npm run macos` launches the app shell
- the current default hotkey is `Command` + `Shift` + `I`
- the menu bar surface now carries saving, success, failure, and restart-needed cues

## What Went Well

- The thin-adapter decision held. The macOS app still shells through the existing `think` CLI path instead of growing a second capture implementation.
- Native SwiftUI plus AppKit was the right stack for this milestone. The panel feels appropriately fast and integrated.
- Focus and placement work mattered immediately. They were not cosmetic; they were the milestone.
- The restart cue ended up solving a real problem instead of being a speculative convenience.
- Tests-as-spec worked again. Once the interaction contract was clear, the UI shell could change without losing product intent.

## What Changed During Implementation

The original M2 design was correct in spirit but wrong in a few specifics.

Most importantly:

- the panel could not stay as an empty gray box
- save feedback did not belong inside the panel
- “panel disappears after success” was too late; it needed to disappear on submit

Real use forced three changes:

1. The panel needed lightweight affordances:
   - visible identity
   - a placeholder
   - an obvious send affordance
2. The panel needed to be vertically centered, not merely “near the top”
3. Save lifecycle needed to move to the menu bar surface:
   - panel = input
   - menu bar = quiet save status

Those changes improved the product rather than bloating it.

## What We Learned

- “Thin” does not mean “empty.” An empty box was technically minimal but behaviorally ambiguous.
- Real latency is not the only issue. Perceived latency is strongly shaped by where feedback lives.
- If the panel hangs around while save work completes, it feels slow even if the underlying save path is reasonable.
- The menu bar is the right place for small status cues because it can reassure without interrupting the capture moment.
- A restart cue for new local builds is worth having when the development loop involves a long-lived menu bar process.

## Where We Were Right

- choosing SwiftUI plus `NSPanel` was right
- keeping the app as a thin adapter was right
- keeping retrieval-before-write out of the panel was right
- resisting settings-screen creep was right
- letting real use overrule a few overly-pure design constraints was right

## What M2 Did Not Try To Solve

These remain outside the milestone:

- configurable hotkeys
- brainstorm mode
- reflection mode
- x-ray mode
- any clustering or embeddings
- latency instrumentation in stats or a benchmark harness

Those are real future concerns. They are not reasons to reopen M2.

## Risks Carried Forward

- If M3 leaks brainstorming behavior into plain capture, it will undo the discipline that made M2 work.
- If we chase more menu bar features without a hill, the app could still drift into admin-console energy.
- If we keep judging latency only by feel, we may miss regressions later.

## Recommendation

Close Milestone 2.

The product outcome is now real:

- the hotkey path is preferable to the CLI in normal desktop use
- the menu bar app stays thin
- the panel behaves like a capture trapdoor rather than a mini app

The next step is not more M2 polish. The next step is Milestone 3.

## Next Milestone Readiness

Milestone 3 can begin.

The discipline to keep:

- capture remains sacred
- capture UI stays dumb
- smarter behavior lives in explicit later modes
- menu bar and panel do not become a backdoor for early reflection features
