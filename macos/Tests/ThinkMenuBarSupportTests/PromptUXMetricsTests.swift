import Foundation
import XCTest
@testable import ThinkMenuBarSupport

final class PromptUXMetricsTests: XCTestCase {
    func testTrackerRecordsVisibleAndImmediateDismissalForEmptyAbandon() {
        let clock = StubClock(dates: [
            Date(timeIntervalSince1970: 1.000),
            Date(timeIntervalSince1970: 1.080),
            Date(timeIntervalSince1970: 1.300),
        ])
        let sink = RecordingMetricsSink()
        let tracker = PromptUXMetricsTracker(clock: clock.next, emit: sink.record)

        tracker.beginPrompt(trigger: .hotkey)
        tracker.markVisible()
        tracker.markHidden()

        XCTAssertEqual(
            sink.events,
            [
                PromptUXMetricsEvent(
                    ts: "1970-01-01T00:00:01Z",
                    event: "prompt.visible",
                    sessionId: sink.sessionID(at: 0),
                    trigger: .hotkey,
                    triggerToVisibleMs: 80
                ),
                PromptUXMetricsEvent(
                    ts: "1970-01-01T00:00:01Z",
                    event: "prompt.dismissed",
                    sessionId: sink.sessionID(at: 0),
                    trigger: .hotkey,
                    dismissalOutcome: .abandonedEmpty,
                    startedTyping: false,
                    editCount: 0
                ),
            ]
        )
    }

    func testTrackerDistinguishesTypedAbandonmentFromImmediateDismissal() {
        let clock = StubClock(dates: [
            Date(timeIntervalSince1970: 2.000),
            Date(timeIntervalSince1970: 2.050),
            Date(timeIntervalSince1970: 2.200),
            Date(timeIntervalSince1970: 2.500),
        ])
        let sink = RecordingMetricsSink()
        let tracker = PromptUXMetricsTracker(clock: clock.next, emit: sink.record)

        tracker.beginPrompt(trigger: .menu)
        tracker.markVisible()
        tracker.noteTextChange(from: "", to: "h")
        tracker.markHidden()

        XCTAssertEqual(sink.events.count, 2)
        XCTAssertEqual(sink.events[1].dismissalOutcome, .abandonedStarted)
        XCTAssertEqual(sink.events[1].startedTyping, true)
        XCTAssertEqual(sink.events[1].editCount, 1)
        XCTAssertEqual(sink.events[1].typingDurationMs, 300)
    }

    func testTrackerRecordsSubmitToHideAndLocalCaptureCompletion() {
        let clock = StubClock(dates: [
            Date(timeIntervalSince1970: 3.000),
            Date(timeIntervalSince1970: 3.070),
            Date(timeIntervalSince1970: 3.300),
            Date(timeIntervalSince1970: 3.450),
            Date(timeIntervalSince1970: 3.470),
            Date(timeIntervalSince1970: 3.820),
        ])
        let sink = RecordingMetricsSink()
        let tracker = PromptUXMetricsTracker(clock: clock.next, emit: sink.record)

        tracker.beginPrompt(trigger: .hotkey)
        tracker.markVisible()
        tracker.noteTextChange(from: "", to: "idea")
        tracker.markSubmitInitiated()
        tracker.markHidden()
        tracker.markCaptureSucceeded(backupState: "pending")

        XCTAssertEqual(sink.events.count, 3)
        XCTAssertEqual(sink.events[1].dismissalOutcome, .submitted)
        XCTAssertEqual(sink.events[1].typingDurationMs, 150)
        XCTAssertEqual(sink.events[1].submitToHideMs, 20)
        XCTAssertEqual(sink.events[2].event, "capture.local_result")
        XCTAssertEqual(sink.events[2].captureOutcome, .succeeded)
        XCTAssertEqual(sink.events[2].submitToLocalCaptureMs, 370)
        XCTAssertEqual(sink.events[2].backupState, "pending")
    }

    func testRecorderAppendsJSONLinesToDisk() async throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let fileURL = tempDir.appendingPathComponent("prompt-ux.jsonl", isDirectory: false)
        let recorder = PromptUXMetricsRecorder(fileURL: fileURL)

        await recorder.record(
            PromptUXMetricsEvent(
                ts: "2026-03-24T12:00:00Z",
                event: "prompt.visible",
                sessionId: "session-1",
                trigger: .hotkey,
                triggerToVisibleMs: 90
            )
        )

        let text = try String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertTrue(text.contains("\"event\":\"prompt.visible\""))
        XCTAssertTrue(text.contains("\"sessionId\":\"session-1\""))
    }
}

private final class RecordingMetricsSink {
    private(set) var events: [PromptUXMetricsEvent] = []

    func record(_ event: PromptUXMetricsEvent) {
        events.append(event)
    }

    func sessionID(at index: Int) -> String {
        events[index].sessionId
    }
}

private final class StubClock {
    private var dates: [Date]

    init(dates: [Date]) {
        self.dates = dates
    }

    func next() -> Date {
        dates.removeFirst()
    }
}
