import XCTest
@testable import ThinkCaptureAdapter

final class ThinkCLIAdapterTests: XCTestCase {
    func testCaptureUsesConfiguredCommandAndPassesThoughtAsSingleArgument() async throws {
        let runner = RecordingRunner(output: ProcessOutput(status: 0, stdout: "Saved locally\n", stderr: ""))
        let adapter = ThinkCLIAdapter(
            runner: runner,
            command: ThinkCLICommand(
                executablePath: "/usr/bin/env",
                baseArguments: ["node", "/repo/bin/think.js"],
                environment: ["HOME": "/tmp/think-home"]
            )
        )

        _ = try await adapter.capture(text: "one thought")

        XCTAssertEqual(runner.executablePath, "/usr/bin/env")
        XCTAssertEqual(runner.arguments, ["node", "/repo/bin/think.js", "one thought"])
        XCTAssertEqual(runner.environment, ["HOME": "/tmp/think-home"])
    }

    func testSavedLocallyOnlyMapsToSkippedBackupState() async throws {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(status: 0, stdout: "Saved locally\n", stderr: "")),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        let result = try await adapter.capture(text: "local only")

        XCTAssertEqual(result, CaptureResult(backupState: .skipped))
    }

    func testBackedUpMapsToBackedUpState() async throws {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(status: 0, stdout: "Saved locally\nBacked up\n", stderr: "")),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        let result = try await adapter.capture(text: "backed up")

        XCTAssertEqual(result, CaptureResult(backupState: .backedUp))
    }

    func testBackupPendingMapsToPendingWithoutFailure() async throws {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(status: 0, stdout: "Saved locally\nBackup pending\n", stderr: "")),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        let result = try await adapter.capture(text: "pending")

        XCTAssertEqual(result, CaptureResult(backupState: .pending))
    }

    func testNonZeroExitBecomesMinimalCaptureFailure() async {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(status: 1, stdout: "", stderr: "Thought cannot be empty\n")),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        do {
            _ = try await adapter.capture(text: "")
            XCTFail("Expected capture to fail")
        } catch let error as CaptureFailure {
            XCTAssertEqual(error.message, "Thought cannot be empty")
        } catch {
            XCTFail("Expected CaptureFailure, got \(error)")
        }
    }
}

private final class RecordingRunner: ProcessRunning {
    private let output: ProcessOutput

    private(set) var executablePath = ""
    private(set) var arguments: [String] = []
    private(set) var environment: [String: String] = [:]

    init(output: ProcessOutput) {
        self.output = output
    }

    func run(
        executablePath: String,
        arguments: [String],
        environment: [String: String]
    ) throws -> ProcessOutput {
        self.executablePath = executablePath
        self.arguments = arguments
        self.environment = environment
        return output
    }
}
