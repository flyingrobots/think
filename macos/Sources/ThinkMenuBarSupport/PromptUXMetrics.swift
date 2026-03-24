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

public struct PromptUXMetricsRecord: Codable, Equatable, Sendable {
    public let ts: String
    public let event: String
    public let sessionId: String
    public let trigger: PromptUXTriggerSource
    public let dismissalOutcome: PromptUXDismissalOutcome
    public let captureOutcome: PromptUXCaptureOutcome?
    public let startedTyping: Bool
    public let editCount: Int
    public let triggerToVisibleMs: Int?
    public let typingDurationMs: Int?
    public let submitToHideMs: Int?
    public let submitToLocalCaptureMs: Int?
    public let backupState: String?

    public init(
        ts: String,
        event: String = "prompt.session",
        sessionId: String,
        trigger: PromptUXTriggerSource,
        dismissalOutcome: PromptUXDismissalOutcome,
        captureOutcome: PromptUXCaptureOutcome? = nil,
        startedTyping: Bool,
        editCount: Int,
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
    func record(_ record: PromptUXMetricsRecord) async
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
    private let flushDelayNanoseconds: UInt64
    private let flushBatchSize: Int

    private var buffer: [PromptUXMetricsRecord] = []
    private var flushSuspendedCount = 0
    private var scheduledFlushTask: Task<Void, Never>?

    public init(
        fileURL: URL = PromptUXMetricsPathResolver.defaultFileURL(),
        fileManager: FileManager = .default,
        flushDelayNanoseconds: UInt64 = 750_000_000,
        flushBatchSize: Int = 8
    ) {
        self.fileURL = fileURL
        self.fileManager = fileManager
        self.flushDelayNanoseconds = flushDelayNanoseconds
        self.flushBatchSize = flushBatchSize
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        self.encoder = encoder
    }

    public func record(_ record: PromptUXMetricsRecord) async {
        buffer.append(record)
        scheduleFlushIfNeeded()
    }

    public func suspendFlushes() {
        flushSuspendedCount += 1
    }

    public func resumeFlushes() async {
        if flushSuspendedCount > 0 {
            flushSuspendedCount -= 1
        }

        scheduleFlushIfNeeded()
    }

    public func flushNow() async {
        await flushBufferIfPossible()
    }

    private var isFlushSuspended: Bool {
        flushSuspendedCount > 0
    }

    private func scheduleFlushIfNeeded() {
        guard !buffer.isEmpty, !isFlushSuspended else { return }

        if buffer.count >= flushBatchSize {
            scheduledFlushTask?.cancel()
            scheduledFlushTask = nil
            Task {
                await flushBufferIfPossible()
            }
            return
        }

        guard scheduledFlushTask == nil else { return }
        let delay = flushDelayNanoseconds

        scheduledFlushTask = Task {
            try? await Task.sleep(nanoseconds: delay)
            await flushBufferIfPossible()
            clearScheduledFlushTask()
        }
    }

    private func clearScheduledFlushTask() {
        scheduledFlushTask = nil
    }

    private func flushBufferIfPossible() async {
        guard !buffer.isEmpty, !isFlushSuspended else { return }

        let records = buffer
        buffer.removeAll(keepingCapacity: true)

        do {
            try persist(records)
        } catch {
            buffer.insert(contentsOf: records, at: 0)
        }
    }

    private func persist(_ records: [PromptUXMetricsRecord]) throws {
        let directoryURL = fileURL.deletingLastPathComponent()

        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        if !fileManager.fileExists(atPath: fileURL.path) {
            fileManager.createFile(atPath: fileURL.path, contents: nil)
        }

        var payload = Data()
        for record in records {
            var line = try encoder.encode(record)
            line.append(0x0A)
            payload.append(line)
        }

        let handle = try FileHandle(forWritingTo: fileURL)
        try handle.seekToEnd()
        try handle.write(contentsOf: payload)
        try handle.close()
    }
}

public final class PromptUXMetricsTracker {
    public typealias Clock = () -> Date
    public typealias Emit = (PromptUXMetricsRecord) -> Void

    private let clock: Clock
    private let emit: Emit
    private var session: PromptSession?

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

        session.visibleAt = clock()
        self.session = session
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

        session.hiddenAt = clock()
        self.session = session

        if session.submitAt == nil {
            emit(makeRecord(from: session, captureOutcome: nil, backupState: nil, completedAt: session.hiddenAt!))
            self.session = nil
        }
    }

    public func markCaptureSucceeded(backupState: String) {
        emitCaptureResult(outcome: .succeeded, backupState: backupState)
    }

    public func markCaptureFailed() {
        emitCaptureResult(outcome: .failed, backupState: nil)
    }

    private func emitCaptureResult(outcome: PromptUXCaptureOutcome, backupState: String?) {
        guard let session, let hiddenAt = session.hiddenAt else { return }

        let completedAt = clock()
        let record = makeRecord(
            from: session,
            captureOutcome: outcome,
            backupState: backupState,
            completedAt: completedAt,
            hiddenAtOverride: hiddenAt
        )
        emit(record)
        self.session = nil
    }

    private func makeRecord(
        from session: PromptSession,
        captureOutcome: PromptUXCaptureOutcome?,
        backupState: String?,
        completedAt: Date,
        hiddenAtOverride: Date? = nil
    ) -> PromptUXMetricsRecord {
        let hiddenAt = hiddenAtOverride ?? session.hiddenAt
        let dismissalOutcome = dismissalOutcome(for: session)
        let typingEnd = session.submitAt ?? hiddenAt ?? completedAt

        return PromptUXMetricsRecord(
            ts: isoString(for: completedAt),
            sessionId: session.id,
            trigger: session.trigger,
            dismissalOutcome: dismissalOutcome,
            captureOutcome: captureOutcome,
            startedTyping: session.editCount > 0,
            editCount: session.editCount,
            triggerToVisibleMs: session.visibleAt.map { milliseconds(from: session.triggerAt, to: $0) },
            typingDurationMs: session.firstEditAt.map { milliseconds(from: $0, to: typingEnd) },
            submitToHideMs: hiddenAt.flatMap { hidden in
                session.submitAt.map { milliseconds(from: $0, to: hidden) }
            },
            submitToLocalCaptureMs: captureOutcome == nil
                ? nil
                : session.submitAt.map { milliseconds(from: $0, to: completedAt) },
            backupState: backupState
        )
    }

    private func dismissalOutcome(for session: PromptSession) -> PromptUXDismissalOutcome {
        if session.submitAt != nil {
            return .submitted
        }

        return session.editCount > 0 ? .abandonedStarted : .abandonedEmpty
    }

    private func isoString(for date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
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
