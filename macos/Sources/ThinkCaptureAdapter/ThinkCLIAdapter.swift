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
                arguments: command.baseArguments + [text],
                environment: command.environment
            )
        }.value

        if output.status != 0 {
            throw CaptureFailure(message: minimalFailureMessage(from: output))
        }

        if output.stdout.contains("Backed up") {
            return CaptureResult(backupState: .backedUp)
        }

        if output.stdout.contains("Backup pending") {
            return CaptureResult(backupState: .pending)
        }

        return CaptureResult(backupState: .skipped)
    }

    private func minimalFailureMessage(from output: ProcessOutput) -> String {
        let message = [output.stderr, output.stdout]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }

        return message ?? "Capture failed"
    }
}
