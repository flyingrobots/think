import Foundation
import XCTest
@testable import ThinkMenuBarSupport

final class PromptUXMetricsTests: XCTestCase {
    func testTrackerEmitsSingleSummaryForImmediateEmptyAbandon() {
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
            sink.records,
            [
                PromptUXMetricsRecord(
                    ts: "1970-01-01T00:00:01.300Z",
                    sessionId: sink.sessionID(at: 0),
                    trigger: .hotkey,
                    dismissalOutcome: .abandonedEmpty,
                    startedTyping: false,
                    editCount: 0,
                    triggerToVisibleMs: 80
                ),
            ]
        )
    }

    func testTrackerEmitsSingleSummaryForTypedAbandonment() {
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

        XCTAssertEqual(sink.records.count, 1)
        XCTAssertEqual(sink.records[0].dismissalOutcome, .abandonedStarted)
        XCTAssertEqual(sink.records[0].startedTyping, true)
        XCTAssertEqual(sink.records[0].editCount, 1)
        XCTAssertEqual(sink.records[0].typingDurationMs, 300)
    }

    func testTrackerWaitsForLocalCaptureResultBeforeEmittingSubmittedSummary() {
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

        XCTAssertTrue(sink.records.isEmpty)

        tracker.markCaptureSucceeded(backupState: "pending")

        XCTAssertEqual(sink.records.count, 1)
        XCTAssertEqual(sink.records[0].dismissalOutcome, .submitted)
        XCTAssertEqual(sink.records[0].captureOutcome, .succeeded)
        XCTAssertEqual(sink.records[0].typingDurationMs, 150)
        XCTAssertEqual(sink.records[0].submitToHideMs, 20)
        XCTAssertEqual(sink.records[0].submitToLocalCaptureMs, 370)
        XCTAssertEqual(sink.records[0].backupState, "pending")
    }

    func testRecorderBuffersWhileFlushesAreSuspended() async throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let fileURL = tempDir.appendingPathComponent("prompt-ux.jsonl", isDirectory: false)
        let recorder = PromptUXMetricsRecorder(
            fileURL: fileURL,
            flushDelayNanoseconds: 1_000_000,
            flushBatchSize: 8
        )

        await recorder.suspendFlushes()
        await recorder.record(
            PromptUXMetricsRecord(
                ts: "2026-03-24T12:00:00.000Z",
                sessionId: "session-1",
                trigger: .hotkey,
                dismissalOutcome: .abandonedEmpty,
                startedTyping: false,
                editCount: 0
            )
        )

        try? await Task.sleep(nanoseconds: 5_000_000)
        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path))

        await recorder.resumeFlushes()
        try? await Task.sleep(nanoseconds: 5_000_000)

        let text = try String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertTrue(text.contains("\"event\":\"prompt.session\""))
        XCTAssertTrue(text.contains("\"sessionId\":\"session-1\""))
    }

    func testRecorderFlushesCompletedSummariesToDisk() async throws {
        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let fileURL = tempDir.appendingPathComponent("prompt-ux.jsonl", isDirectory: false)
        let recorder = PromptUXMetricsRecorder(fileURL: fileURL, flushDelayNanoseconds: 1_000_000)

        await recorder.record(
            PromptUXMetricsRecord(
                ts: "2026-03-24T12:00:00.000Z",
                sessionId: "session-1",
                trigger: .hotkey,
                dismissalOutcome: .submitted,
                captureOutcome: .succeeded,
                startedTyping: true,
                editCount: 3,
                triggerToVisibleMs: 90,
                typingDurationMs: 400,
                submitToHideMs: 25,
                submitToLocalCaptureMs: 180,
                backupState: "skipped"
            )
        )

        try? await Task.sleep(nanoseconds: 5_000_000)
        let text = try String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertTrue(text.contains("\"backupState\":\"skipped\""))
        XCTAssertTrue(text.contains("\"submitToLocalCaptureMs\":180"))
    }
}

private final class RecordingMetricsSink {
    private(set) var records: [PromptUXMetricsRecord] = []

    func record(_ record: PromptUXMetricsRecord) {
        records.append(record)
    }

    func sessionID(at index: Int) -> String {
        records[index].sessionId
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
