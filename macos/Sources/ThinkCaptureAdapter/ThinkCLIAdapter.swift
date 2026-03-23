import Foundation

public struct ProcessOutput: Equatable, Sendable {
    public let status: Int32
    public let stdout: String
    public let stderr: String

    public init(status: Int32, stdout: String, stderr: String) {
        self.status = status
        self.stdout = stdout
        self.stderr = stderr
    }
}

public protocol ProcessRunning: Sendable {
    func run(
        executablePath: String,
        arguments: [String],
        environment: [String: String]
    ) throws -> ProcessOutput
}

public struct ThinkCLICommand: Equatable, Sendable {
    public let executablePath: String
    public let baseArguments: [String]
    public let environment: [String: String]

    public init(
        executablePath: String,
        baseArguments: [String] = [],
        environment: [String: String] = [:]
    ) {
        self.executablePath = executablePath
        self.baseArguments = baseArguments
        self.environment = environment
    }
}

public final class ThinkCLIAdapter: ThinkCapturing, @unchecked Sendable {
    private let runner: ProcessRunning
    private let command: ThinkCLICommand

    public init(runner: ProcessRunning, command: ThinkCLICommand) {
        self.runner = runner
        self.command = command
    }

    public func capture(text: String) async throws -> CaptureResult {
        let runner = self.runner
        let command = self.command

        let output = try await Task.detached(priority: .userInitiated) {
            try runner.run(
                executablePath: command.executablePath,
                arguments: command.baseArguments + ["--json", text],
                environment: command.environment
            )
        }.value

        let stdoutEvents = try decodeEvents(from: output.stdout)
        let stderrEvents = try decodeEvents(from: output.stderr)

        if output.status != 0 {
            throw CaptureFailure(message: minimalFailureMessage(stdoutEvents: stdoutEvents, stderrEvents: stderrEvents, output: output))
        }

        guard hasCaptureStatus(in: stdoutEvents) else {
            throw CaptureFailure(message: "Capture failed")
        }

        if let backupState = backupState(stdoutEvents: stdoutEvents, stderrEvents: stderrEvents) {
            return CaptureResult(backupState: backupState)
        }

        return CaptureResult(backupState: .skipped)
    }

    private func hasCaptureStatus(in events: [CLIEvent]) -> Bool {
        events.contains { $0.event == "capture.status" }
    }

    private func backupState(stdoutEvents: [CLIEvent], stderrEvents: [CLIEvent]) -> BackupState? {
        let events = stdoutEvents + stderrEvents

        if events.contains(where: { $0.event == "backup.status" && $0.status == "backed_up" }) {
            return .backedUp
        }

        if events.contains(where: { $0.event == "backup.status" && $0.status == "pending" }) {
            return .pending
        }

        if events.contains(where: { $0.event == "backup.skipped" }) {
            return .skipped
        }

        return nil
    }

    private func minimalFailureMessage(
        stdoutEvents: [CLIEvent],
        stderrEvents: [CLIEvent],
        output: ProcessOutput
    ) -> String {
        let message = (stderrEvents + stdoutEvents)
            .compactMap(\.message)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }

        if let message {
            return message
        }

        let rawMessage = [output.stderr, output.stdout]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }

        return rawMessage ?? "Capture failed"
    }

    private func decodeEvents(from text: String) throws -> [CLIEvent] {
        let lines = text
            .split(separator: "\n")
            .map(String.init)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !lines.isEmpty else {
            return []
        }

        return try lines.map { line in
            let data = Data(line.utf8)
            do {
                return try JSONDecoder().decode(CLIEvent.self, from: data)
            } catch {
                throw CaptureFailure(message: "Could not decode think JSON output")
            }
        }
    }
}

private struct CLIEvent: Decodable {
    let event: String
    let message: String?
    let status: String?
}
