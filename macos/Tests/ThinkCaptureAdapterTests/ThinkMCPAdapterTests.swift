import XCTest
@testable import ThinkCaptureAdapter

final class ThinkMCPAdapterTests: XCTestCase {
    func testCaptureInitializesTransportOnFirstCall() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:abc", backupStatus: "skipped"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try await adapter.capture(text: "first thought")

        XCTAssertTrue(transport.started, "Expected transport to be started on first capture.")
        XCTAssertEqual(transport.sentMessages.count, 3, "Expected 3 messages: initialize, initialized notification, capture.")
    }

    func testCaptureReusesInitializedTransport() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:1", backupStatus: "skipped"),
            captureResponse(entryId: "entry:2", backupStatus: "skipped"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try await adapter.capture(text: "first")
        _ = try await adapter.capture(text: "second")

        XCTAssertEqual(transport.startCount, 1, "Expected transport to start only once.")
        XCTAssertEqual(transport.sentMessages.count, 4, "Expected 4 messages: init + notification + 2 captures.")
    }

    func testSavedLocallyMapsToSkippedBackupState() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:abc", backupStatus: "skipped"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        let result = try await adapter.capture(text: "local only")

        XCTAssertEqual(result, CaptureResult(backupState: .skipped))
    }

    func testBackedUpMapsToBackedUpState() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:abc", backupStatus: "backed_up"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        let result = try await adapter.capture(text: "backed up")

        XCTAssertEqual(result, CaptureResult(backupState: .backedUp))
    }

    func testPendingMapsToPendingState() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:abc", backupStatus: "pending"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        let result = try await adapter.capture(text: "pending backup")

        XCTAssertEqual(result, CaptureResult(backupState: .pending))
    }

    func testCapturePassesTextInToolCallArguments() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:abc", backupStatus: "skipped"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try await adapter.capture(text: "my exact thought")

        let captureMessage = transport.sentMessages.last!
        let decoded = try JSONSerialization.jsonObject(with: captureMessage) as! [String: Any]
        let params = decoded["params"] as! [String: Any]
        let arguments = params["arguments"] as! [String: String]

        XCTAssertEqual(params["name"] as? String, "capture")
        XCTAssertEqual(arguments["text"], "my exact thought")
    }

    func testMCPErrorBecomesACaptureFailure() async {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            errorResponse(code: -32600, message: "Thought cannot be empty"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        do {
            _ = try await adapter.capture(text: "")
            XCTFail("Expected capture to fail")
        } catch let error as CaptureFailure {
            XCTAssertEqual(error.message, "Thought cannot be empty")
        } catch {
            XCTFail("Expected CaptureFailure, got \(error)")
        }
    }

    func testReconnectsAfterTransportDiesMidSession() async throws {
        let transport = CrashRecoveryMockTransport(
            responses: [
                initializeResponse(),
                captureResponse(entryId: "entry:1", backupStatus: "skipped"),
                // After reconnect: fresh init + capture
                initializeResponse(),
                captureResponse(entryId: "entry:2", backupStatus: "skipped"),
            ],
            failOnSendAtCallIndex: 4 // fail on the first send of the second capture
        )
        let adapter = ThinkMCPAdapter(transport: transport)

        let result1 = try await adapter.capture(text: "before crash")
        XCTAssertEqual(result1, CaptureResult(backupState: .skipped))

        // Transport dies on next send, adapter should reconnect and succeed
        let result2 = try await adapter.capture(text: "after crash")
        XCTAssertEqual(result2, CaptureResult(backupState: .skipped))
        XCTAssertEqual(transport.startCount, 2, "Expected transport to be started twice (initial + reconnect).")
    }

    func testFailsGracefullyAfterReconnectionAlsoFails() async {
        let transport = CrashRecoveryMockTransport(
            responses: [
                initializeResponse(),
                captureResponse(entryId: "entry:1", backupStatus: "skipped"),
            ],
            failOnSendAtCallIndex: 4, // fail on second capture
            failPermanently: true      // keep failing after reconnect too
        )
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try? await adapter.capture(text: "before crash")

        do {
            _ = try await adapter.capture(text: "after double crash")
            XCTFail("Expected capture to fail after reconnection failure")
        } catch let error as CaptureFailure {
            XCTAssertTrue(error.message.contains("reconnection"),
                "Expected a reconnection failure message, got: \(error.message)")
        } catch {
            XCTFail("Expected CaptureFailure, got \(error)")
        }
    }

    func testReconnectionResetsInitializedState() async throws {
        let transport = CrashRecoveryMockTransport(
            responses: [
                initializeResponse(),
                captureResponse(entryId: "entry:1", backupStatus: "skipped"),
                // After reconnect
                initializeResponse(),
                captureResponse(entryId: "entry:2", backupStatus: "skipped"),
            ],
            failOnSendAtCallIndex: 4
        )
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try await adapter.capture(text: "first")
        _ = try await adapter.capture(text: "after reconnect")

        // Two full init+notification+capture sequences = 6 successful sends
        XCTAssertEqual(transport.successfulSendCount, 6, "Expected 6 successful sends: two full init+capture sequences.")
    }

    func testShutdownStopsTransport() async throws {
        let transport = MockMCPTransport(responses: [
            initializeResponse(),
            captureResponse(entryId: "entry:abc", backupStatus: "skipped"),
        ])
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try await adapter.capture(text: "test")
        adapter.shutdown()

        XCTAssertTrue(transport.stopped, "Expected transport to be stopped on shutdown.")
    }
}

// MARK: - Mock Transport

private final class MockMCPTransport: MCPTransport, @unchecked Sendable {
    private var responses: [Data]
    private var responseIndex = 0
    private(set) var sentMessages: [Data] = []
    private(set) var started = false
    private(set) var stopped = false
    private(set) var startCount = 0

    init(responses: [Data]) {
        self.responses = responses
    }

    func start() throws {
        started = true
        startCount += 1
    }

    func send(_ data: Data) throws {
        sentMessages.append(data)
    }

    func receive() throws -> Data {
        guard responseIndex < responses.count else {
            throw CaptureFailure(message: "No more mock responses")
        }
        let response = responses[responseIndex]
        responseIndex += 1
        return response
    }

    func stop() {
        stopped = true
    }
}

// MARK: - Response Builders

private func initializeResponse() -> Data {
    return try! JSONSerialization.data(withJSONObject: [
        "jsonrpc": "2.0",
        "id": 1,
        "result": [
            "protocolVersion": "2025-03-26",
            "capabilities": [:] as [String: Any],
            "serverInfo": ["name": "think", "version": "0.5.0"],
        ] as [String: Any],
    ])
}

private func captureResponse(entryId: String, backupStatus: String) -> Data {
    return try! JSONSerialization.data(withJSONObject: [
        "jsonrpc": "2.0",
        "id": 2,
        "result": [
            "structuredContent": [
                "entryId": entryId,
                "status": "saved_locally",
                "backupStatus": backupStatus,
            ] as [String: Any],
        ] as [String: Any],
    ])
}

private func errorResponse(code: Int, message: String) -> Data {
    return try! JSONSerialization.data(withJSONObject: [
        "jsonrpc": "2.0",
        "id": 2,
        "error": [
            "code": code,
            "message": message,
        ] as [String: Any],
    ])
}

// MARK: - Crash Recovery Mock Transport

private final class CrashRecoveryMockTransport: MCPTransport, @unchecked Sendable {
    private let responses: [Data]
    private var responseIndex = 0
    private let failOnSendAtCallIndex: Int
    private let failPermanently: Bool
    private var sendCallCount = 0
    private var crashed = false
    private var recovered = false
    private(set) var startCount = 0
    private(set) var successfulSendCount = 0

    init(responses: [Data], failOnSendAtCallIndex: Int, failPermanently: Bool = false) {
        self.responses = responses
        self.failOnSendAtCallIndex = failOnSendAtCallIndex
        self.failPermanently = failPermanently
    }

    func start() throws {
        startCount += 1
        if startCount > 1 {
            if failPermanently {
                crashed = true
            } else {
                recovered = true
                crashed = false
            }
        }
    }

    func send(_ data: Data) throws {
        sendCallCount += 1
        if crashed || (sendCallCount >= failOnSendAtCallIndex && !recovered) {
            crashed = true
            throw CaptureFailure(message: "Mock transport crashed", isTransportError: true)
        }
        successfulSendCount += 1
    }

    func receive() throws -> Data {
        guard responseIndex < responses.count else {
            throw CaptureFailure(message: "No more mock responses", isTransportError: true)
        }
        let response = responses[responseIndex]
        responseIndex += 1
        return response
    }

    func stop() {
        crashed = false
    }

}
