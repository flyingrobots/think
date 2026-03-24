import Foundation

public enum PromptUXTriggerSource: String, Codable, Equatable, Sendable {
    case hotkey
    case menu
}

public enum PromptUXDismissalOutcome: String, Codable, Equatable, Sendable {
    case submitted
    case abandonedEmpty = "abandoned_empty"
    case abandonedStarted = "abandoned_started"
}

public enum PromptUXCaptureOutcome: String, Codable, Equatable, Sendable {
    case succeeded
    case failed
}

public struct PromptUXMetricsEvent: Codable, Equatable, Sendable {
    public let ts: String
    public let event: String
    public let sessionId: String
    public let trigger: PromptUXTriggerSource?
    public let dismissalOutcome: PromptUXDismissalOutcome?
    public let captureOutcome: PromptUXCaptureOutcome?
    public let startedTyping: Bool?
    public let editCount: Int?
    public let triggerToVisibleMs: Int?
    public let typingDurationMs: Int?
    public let submitToHideMs: Int?
    public let submitToLocalCaptureMs: Int?
    public let backupState: String?

    public init(
        ts: String,
        event: String,
        sessionId: String,
        trigger: PromptUXTriggerSource? = nil,
        dismissalOutcome: PromptUXDismissalOutcome? = nil,
        captureOutcome: PromptUXCaptureOutcome? = nil,
        startedTyping: Bool? = nil,
        editCount: Int? = nil,
        triggerToVisibleMs: Int? = nil,
        typingDurationMs: Int? = nil,
        submitToHideMs: Int? = nil,
        submitToLocalCaptureMs: Int? = nil,
        backupState: String? = nil
    ) {
        self.ts = ts
        self.event = event
        self.sessionId = sessionId
        self.trigger = trigger
        self.dismissalOutcome = dismissalOutcome
        self.captureOutcome = captureOutcome
        self.startedTyping = startedTyping
        self.editCount = editCount
        self.triggerToVisibleMs = triggerToVisibleMs
        self.typingDurationMs = typingDurationMs
        self.submitToHideMs = submitToHideMs
        self.submitToLocalCaptureMs = submitToLocalCaptureMs
        self.backupState = backupState
    }
}

public protocol PromptUXMetricsRecording: Sendable {
    func record(_ event: PromptUXMetricsEvent) async
}

public enum PromptUXMetricsPathResolver {
    public static func defaultFileURL(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        fileManager: FileManager = .default
    ) -> URL {
        if let explicit = environment["THINK_PROMPT_METRICS_FILE"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !explicit.isEmpty {
            return URL(fileURLWithPath: explicit).standardizedFileURL
        }

        let homePath = environment["HOME"] ?? fileManager.homeDirectoryForCurrentUser.path
        return URL(fileURLWithPath: homePath, isDirectory: true)
            .appendingPathComponent(".think", isDirectory: true)
            .appendingPathComponent("metrics", isDirectory: true)
            .appendingPathComponent("prompt-ux.jsonl", isDirectory: false)
    }
}

public actor PromptUXMetricsRecorder: PromptUXMetricsRecording {
    private let fileURL: URL
    private let fileManager: FileManager
    private let encoder: JSONEncoder

    public init(
        fileURL: URL = PromptUXMetricsPathResolver.defaultFileURL(),
        fileManager: FileManager = .default
    ) {
        self.fileURL = fileURL
        self.fileManager = fileManager
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        self.encoder = encoder
    }

    public func record(_ event: PromptUXMetricsEvent) async {
        let directoryURL = fileURL.deletingLastPathComponent()

        do {
            try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
            if !fileManager.fileExists(atPath: fileURL.path) {
                fileManager.createFile(atPath: fileURL.path, contents: nil)
            }

            var line = try encoder.encode(event)
            line.append(0x0A)

            let handle = try FileHandle(forWritingTo: fileURL)
            try handle.seekToEnd()
            try handle.write(contentsOf: line)
            try handle.close()
        } catch {
            return
        }
    }
}

public final class PromptUXMetricsTracker {
    public typealias Clock = () -> Date
    public typealias Emit = (PromptUXMetricsEvent) -> Void

    private var session: PromptSession?
    private let clock: Clock
    private let emit: Emit

    public init(
        clock: @escaping Clock = Date.init,
        emit: @escaping Emit
    ) {
        self.clock = clock
        self.emit = emit
    }

    public func beginPrompt(trigger: PromptUXTriggerSource) {
        session = PromptSession(
            id: UUID().uuidString,
            trigger: trigger,
            triggerAt: clock()
        )
    }

    public func markVisible() {
        guard var session else { return }
        guard session.visibleAt == nil else { return }

        let visibleAt = clock()
        session.visibleAt = visibleAt
        self.session = session

        emit(
            PromptUXMetricsEvent(
                ts: isoString(for: visibleAt),
                event: "prompt.visible",
                sessionId: session.id,
                trigger: session.trigger,
                triggerToVisibleMs: milliseconds(from: session.triggerAt, to: visibleAt)
            )
        )
    }

    public func noteTextChange(from oldValue: String, to newValue: String) {
        guard var session else { return }
        guard oldValue != newValue else { return }

        let changedAt = clock()
        if session.firstEditAt == nil {
            session.firstEditAt = changedAt
        }
        session.lastEditAt = changedAt
        session.editCount += 1
        self.session = session
    }

    public func markSubmitInitiated() {
        guard var session else { return }
        guard session.submitAt == nil else { return }

        session.submitAt = clock()
        self.session = session
    }

    public func markHidden() {
        guard var session else { return }

        let hiddenAt = clock()
        session.hiddenAt = hiddenAt
        self.session = session

        let dismissalOutcome = dismissalOutcome(for: session)
        emit(
            PromptUXMetricsEvent(
                ts: isoString(for: hiddenAt),
                event: "prompt.dismissed",
                sessionId: session.id,
                trigger: session.trigger,
                dismissalOutcome: dismissalOutcome,
                startedTyping: session.editCount > 0,
                editCount: session.editCount,
                typingDurationMs: typingDuration(for: session, endingAt: session.submitAt ?? hiddenAt),
                submitToHideMs: session.submitAt.map { milliseconds(from: $0, to: hiddenAt) }
            )
        )

        if dismissalOutcome != .submitted {
            self.session = nil
        }
    }

    public func markCaptureSucceeded(backupState: String) {
        recordCaptureResult(outcome: .succeeded, backupState: backupState)
    }

    public func markCaptureFailed() {
        recordCaptureResult(outcome: .failed, backupState: nil)
    }

    private func recordCaptureResult(outcome: PromptUXCaptureOutcome, backupState: String?) {
        guard let session, let submitAt = session.submitAt else { return }

        let completedAt = clock()
        emit(
            PromptUXMetricsEvent(
                ts: isoString(for: completedAt),
                event: "capture.local_result",
                sessionId: session.id,
                trigger: session.trigger,
                captureOutcome: outcome,
                submitToLocalCaptureMs: milliseconds(from: submitAt, to: completedAt),
                backupState: backupState
            )
        )

        self.session = nil
    }

    private func dismissalOutcome(for session: PromptSession) -> PromptUXDismissalOutcome {
        if session.submitAt != nil {
            return .submitted
        }

        return session.editCount > 0 ? .abandonedStarted : .abandonedEmpty
    }

    private func typingDuration(for session: PromptSession, endingAt end: Date) -> Int? {
        guard let firstEditAt = session.firstEditAt else {
            return nil
        }

        return milliseconds(from: firstEditAt, to: end)
    }

    private func isoString(for date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    private func milliseconds(from start: Date, to end: Date) -> Int {
        max(0, Int((end.timeIntervalSince(start) * 1000).rounded()))
    }
}

private struct PromptSession {
    let id: String
    let trigger: PromptUXTriggerSource
    let triggerAt: Date
    var visibleAt: Date?
    var firstEditAt: Date?
    var lastEditAt: Date?
    var editCount: Int = 0
    var submitAt: Date?
    var hiddenAt: Date?
}
