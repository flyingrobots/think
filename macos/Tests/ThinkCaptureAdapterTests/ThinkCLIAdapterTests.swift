import XCTest
@testable import ThinkCaptureAdapter

final class ThinkCLIAdapterTests: XCTestCase {
    func testCommandResolverFindsCLIBySearchingUpwardsFromBundleDirectory() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let repoRoot = tempRoot.appendingPathComponent("think-repo", isDirectory: true)
        let binDirectory = repoRoot.appendingPathComponent("bin", isDirectory: true)
        let appBundleDirectory = repoRoot
            .appendingPathComponent("macos/.dist/ThinkMenuBarApp.app", isDirectory: true)

        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: appBundleDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: binDirectory.appendingPathComponent("think.js").path,
            contents: Data("console.log('think');".utf8)
        )

        let command = try ThinkCLICommandResolver.makeDefault(
            environment: [:],
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: appBundleDirectory.path,
            processExecutablePath: nil
        )

        XCTAssertEqual(command.baseArguments, ["node", binDirectory.appendingPathComponent("think.js").path])
    }

    func testCaptureUsesConfiguredCommandAndPassesThoughtAsSingleArgument() async throws {
        let runner = RecordingRunner(output: ProcessOutput(
            status: 0,
            stdout: jsonLines(
                ["event": "cli.start"],
                ["event": "capture.status", "status": "saved_locally"],
                ["event": "backup.skipped"],
                ["event": "cli.success"]
            ),
            stderr: ""
        ))
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
        XCTAssertEqual(runner.arguments, ["node", "/repo/bin/think.js", "--json", "one thought"])
        XCTAssertEqual(runner.environment, ["HOME": "/tmp/think-home"])
    }

    func testCapturePassesProvenanceThroughEnvironmentVariables() async throws {
        let runner = RecordingRunner(output: ProcessOutput(
            status: 0,
            stdout: jsonLines(
                ["event": "cli.start"],
                ["event": "capture.status", "status": "saved_locally"],
                ["event": "backup.skipped"],
                ["event": "cli.success"]
            ),
            stderr: ""
        ))
        let adapter = ThinkCLIAdapter(
            runner: runner,
            command: ThinkCLICommand(
                executablePath: "/usr/bin/env",
                baseArguments: ["node", "/repo/bin/think.js"],
                environment: ["HOME": "/tmp/think-home"]
            )
        )

        _ = try await adapter.capture(
            text: "one thought",
            provenance: ThinkCaptureProvenance(
                ingress: .selectedText,
                sourceApp: "Safari",
                sourceURL: URL(string: "https://example.com/article")!
            )
        )

        XCTAssertEqual(runner.environment["THINK_CAPTURE_INGRESS"], "selected_text")
        XCTAssertEqual(runner.environment["THINK_CAPTURE_SOURCE_APP"], "Safari")
        XCTAssertEqual(runner.environment["THINK_CAPTURE_SOURCE_URL"], "https://example.com/article")
    }

    func testCaptureClearsManagedProvenanceKeysWhenIncomingProvenanceIsNil() async throws {
        let runner = RecordingRunner(output: ProcessOutput(
            status: 0,
            stdout: jsonLines(
                ["event": "cli.start"],
                ["event": "capture.status", "status": "saved_locally"],
                ["event": "backup.skipped"],
                ["event": "cli.success"]
            ),
            stderr: ""
        ))
        let adapter = ThinkCLIAdapter(
            runner: runner,
            command: ThinkCLICommand(
                executablePath: "/usr/bin/env",
                baseArguments: ["node", "/repo/bin/think.js"],
                environment: [
                    "HOME": "/tmp/think-home",
                    "THINK_CAPTURE_INGRESS": "share",
                    "THINK_CAPTURE_SOURCE_APP": "Mail",
                    "THINK_CAPTURE_SOURCE_URL": "https://example.com/stale",
                ]
            )
        )

        _ = try await adapter.capture(text: "one thought", provenance: nil)

        XCTAssertNil(runner.environment["THINK_CAPTURE_INGRESS"])
        XCTAssertNil(runner.environment["THINK_CAPTURE_SOURCE_APP"])
        XCTAssertNil(runner.environment["THINK_CAPTURE_SOURCE_URL"])
        XCTAssertEqual(runner.environment["HOME"], "/tmp/think-home")
    }

    func testCaptureClearsStaleManagedProvenanceKeysBeforeApplyingPartialProvenance() async throws {
        let runner = RecordingRunner(output: ProcessOutput(
            status: 0,
            stdout: jsonLines(
                ["event": "cli.start"],
                ["event": "capture.status", "status": "saved_locally"],
                ["event": "backup.skipped"],
                ["event": "cli.success"]
            ),
            stderr: ""
        ))
        let adapter = ThinkCLIAdapter(
            runner: runner,
            command: ThinkCLICommand(
                executablePath: "/usr/bin/env",
                baseArguments: ["node", "/repo/bin/think.js"],
                environment: [
                    "HOME": "/tmp/think-home",
                    "THINK_CAPTURE_INGRESS": "share",
                    "THINK_CAPTURE_SOURCE_APP": "Mail",
                    "THINK_CAPTURE_SOURCE_URL": "https://example.com/stale",
                ]
            )
        )

        _ = try await adapter.capture(
            text: "one thought",
            provenance: ThinkCaptureProvenance(sourceApp: "Safari")
        )

        XCTAssertNil(runner.environment["THINK_CAPTURE_INGRESS"])
        XCTAssertEqual(runner.environment["THINK_CAPTURE_SOURCE_APP"], "Safari")
        XCTAssertNil(runner.environment["THINK_CAPTURE_SOURCE_URL"])
        XCTAssertEqual(runner.environment["HOME"], "/tmp/think-home")
    }

    func testSavedLocallyOnlyMapsToSkippedBackupState() async throws {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(
                status: 0,
                stdout: jsonLines(
                    ["event": "cli.start"],
                    ["event": "capture.status", "status": "saved_locally"],
                    ["event": "backup.skipped"],
                    ["event": "cli.success"]
                ),
                stderr: ""
            )),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        let result = try await adapter.capture(text: "local only")

        XCTAssertEqual(result, CaptureResult(backupState: .skipped))
    }

    func testBackedUpMapsToBackedUpState() async throws {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(
                status: 0,
                stdout: jsonLines(
                    ["event": "cli.start"],
                    ["event": "capture.status", "status": "saved_locally"],
                    ["event": "backup.status", "status": "backed_up"],
                    ["event": "cli.success"]
                ),
                stderr: ""
            )),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        let result = try await adapter.capture(text: "backed up")

        XCTAssertEqual(result, CaptureResult(backupState: .backedUp))
    }

    func testBackupPendingMapsToPendingWithoutFailure() async throws {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(
                status: 0,
                stdout: jsonLines(
                    ["event": "cli.start"],
                    ["event": "capture.status", "status": "saved_locally"],
                    ["event": "backup.start"],
                    ["event": "cli.success"]
                ),
                stderr: jsonLines(
                    ["event": "backup.timeout", "timeoutMs": 1500],
                    ["event": "backup.failure", "reason": "timed out"],
                    ["event": "backup.status", "status": "pending"]
                )
            )),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        let result = try await adapter.capture(text: "pending")

        XCTAssertEqual(result, CaptureResult(backupState: .pending))
    }

    func testNonZeroExitBecomesMinimalCaptureFailure() async {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(
                status: 1,
                stdout: jsonLines(["event": "cli.start"]),
                stderr: jsonLines(
                    ["event": "cli.validation_failed", "message": "Thought cannot be empty"],
                    ["event": "cli.failure", "exitCode": 1]
                )
            )),
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

    func testMalformedJSONBecomesCaptureFailure() async {
        let adapter = ThinkCLIAdapter(
            runner: RecordingRunner(output: ProcessOutput(status: 0, stdout: "Saved locally\n", stderr: "")),
            command: ThinkCLICommand(executablePath: "/usr/bin/env")
        )

        do {
            _ = try await adapter.capture(text: "bad json")
            XCTFail("Expected malformed JSON output to fail")
        } catch let error as CaptureFailure {
            XCTAssertEqual(error.message, "Could not decode think JSON output")
        } catch {
            XCTFail("Expected CaptureFailure, got \(error)")
        }
    }
}

private final class RecordingRunner: ProcessRunning, @unchecked Sendable {
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

private func jsonLines(_ objects: [String: Any]...) -> String {
    objects.map { object in
        let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        return String(decoding: data, as: UTF8.self)
    }
    .joined(separator: "\n") + "\n"
}
