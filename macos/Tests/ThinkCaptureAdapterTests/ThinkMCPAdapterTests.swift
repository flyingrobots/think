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
