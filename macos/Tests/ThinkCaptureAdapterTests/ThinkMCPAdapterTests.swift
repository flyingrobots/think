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
        let transport = ReconnectableMockTransport(
            phases: [
                // Phase 1: initialize + first capture succeeds
                .success(responses: [initializeResponse(), captureResponse(entryId: "entry:1", backupStatus: "skipped")]),
                // Phase 2: transport dies on send (simulates crashed process)
                .failOnSend,
                // Phase 3: reconnect — fresh initialize + capture succeeds
                .success(responses: [initializeResponse(), captureResponse(entryId: "entry:2", backupStatus: "skipped")]),
            ]
        )
        let adapter = ThinkMCPAdapter(transport: transport)

        let result1 = try await adapter.capture(text: "before crash")
        XCTAssertEqual(result1, CaptureResult(backupState: .skipped))

        // Transport dies, adapter should reconnect and succeed
        let result2 = try await adapter.capture(text: "after crash")
        XCTAssertEqual(result2, CaptureResult(backupState: .skipped))
        XCTAssertEqual(transport.startCount, 2, "Expected transport to be started twice (initial + reconnect).")
    }

    func testFailsGracefullyAfterReconnectionAlsoFails() async {
        let transport = ReconnectableMockTransport(
            phases: [
                // Phase 1: initialize + first capture succeeds
                .success(responses: [initializeResponse(), captureResponse(entryId: "entry:1", backupStatus: "skipped")]),
                // Phase 2: transport dies
                .failOnSend,
                // Phase 3: reconnect also dies
                .failOnSend,
            ]
        )
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try? await adapter.capture(text: "before crash")

        do {
            _ = try await adapter.capture(text: "after double crash")
            XCTFail("Expected capture to fail after reconnection failure")
        } catch let error as CaptureFailure {
            XCTAssertTrue(error.message.contains("failed") || error.message.contains("transport"),
                "Expected a descriptive failure message, got: \(error.message)")
        } catch {
            XCTFail("Expected CaptureFailure, got \(error)")
        }
    }

    func testReconnectionResetsInitializedState() async throws {
        let transport = ReconnectableMockTransport(
            phases: [
                .success(responses: [initializeResponse(), captureResponse(entryId: "entry:1", backupStatus: "skipped")]),
                .failOnSend,
                .success(responses: [initializeResponse(), captureResponse(entryId: "entry:2", backupStatus: "skipped")]),
            ]
        )
        let adapter = ThinkMCPAdapter(transport: transport)

        _ = try await adapter.capture(text: "first")
        _ = try await adapter.capture(text: "after reconnect")

        // After reconnect, should have sent: init+notification+capture (phase 1) + init+notification+capture (phase 3) = 6
        XCTAssertEqual(transport.totalSentCount, 6, "Expected 6 total messages: two full init+capture sequences.")
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

// MARK: - Reconnectable Mock Transport

private enum MockPhase {
    case success(responses: [Data])
    case failOnSend
}

private final class ReconnectableMockTransport: MCPTransport, @unchecked Sendable {
    private let phases: [MockPhase]
    private var phaseIndex = 0
    private var responseIndex = 0
    private var currentPhaseResponses: [Data] = []
    private var shouldFailOnSend = false
    private(set) var startCount = 0
    private(set) var totalSentCount = 0

    init(phases: [MockPhase]) {
        self.phases = phases
        advancePhase()
    }

    func start() throws {
        startCount += 1
        advancePhase()
    }

    func send(_ data: Data) throws {
        if shouldFailOnSend {
            throw CaptureFailure(message: "Mock transport failed on send")
        }
        totalSentCount += 1
    }

    func receive() throws -> Data {
        guard responseIndex < currentPhaseResponses.count else {
            throw CaptureFailure(message: "No more mock responses in current phase")
        }
        let response = currentPhaseResponses[responseIndex]
        responseIndex += 1
        return response
    }

    func stop() {}

    private func advancePhase() {
        guard phaseIndex < phases.count else { return }
        let phase = phases[phaseIndex]
        phaseIndex += 1
        responseIndex = 0

        switch phase {
        case .success(let responses):
            currentPhaseResponses = responses
            shouldFailOnSend = false
        case .failOnSend:
            currentPhaseResponses = []
            shouldFailOnSend = true
        }
    }
}
