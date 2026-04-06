import Foundation

public protocol MCPTransport: Sendable {
    func send(_ data: Data) throws
    func receive() throws -> Data
    func start() throws
    func stop()
}

public final class ThinkMCPAdapter: ThinkCapturing, @unchecked Sendable {
    private let transport: MCPTransport
    private let environment: [String: String]
    private var nextRequestId: Int = 1
    private var initialized = false
    private let lock = NSLock()

    public init(transport: MCPTransport, environment: [String: String] = [:]) {
        self.transport = transport
        self.environment = environment
    }

    public func capture(text: String) async throws -> CaptureResult {
        try await Task.detached(priority: .userInitiated) { [self] in
            do {
                try ensureInitialized()
                return try callCaptureTool(text: text)
            } catch let error as CaptureFailure where !error.isTransportError {
                // Application-level MCP error (e.g., validation) — don't retry
                throw error
            } catch {
                // Transport failed — attempt one reconnection
                reconnect()
                do {
                    try ensureInitialized()
                    return try callCaptureTool(text: text)
                } catch {
                    throw CaptureFailure(message: "MCP capture failed after reconnection: \(error.localizedDescription)")
                }
            }
        }.value
    }

    private func reconnect() {
        lock.lock()
        defer { lock.unlock() }

        transport.stop()
        initialized = false
    }

    private func ensureInitialized() throws {
        lock.lock()
        defer { lock.unlock() }

        if initialized { return }

        try transport.start()

        let initRequest = JSONRPCRequest(
            jsonrpc: "2.0",
            id: nextId(),
            method: "initialize",
            params: InitializeParams(
                protocolVersion: "2025-03-26",
                capabilities: ClientCapabilities(),
                clientInfo: ClientInfo(name: "think-macos", version: "0.5.0")
            )
        )
        try sendRequest(initRequest)
        let _ = try receiveResponse()

        let notification = JSONRPCNotification(
            jsonrpc: "2.0",
            method: "notifications/initialized"
        )
        let notificationData = try JSONEncoder().encode(notification)
        try transport.send(notificationData)

        initialized = true
    }

    private func callCaptureTool(text: String) throws -> CaptureResult {
        lock.lock()
        let requestId = nextId()
        lock.unlock()

        let request = JSONRPCRequest(
            jsonrpc: "2.0",
            id: requestId,
            method: "tools/call",
            params: ToolCallParams(
                name: "capture",
                arguments: ["text": text]
            )
        )
        try sendRequest(request)
        let response = try receiveResponse()

        guard let result = response.result else {
            let message = response.error?.message ?? "MCP capture failed"
            throw CaptureFailure(message: message)
        }

        guard let structured = result.structuredContent else {
            throw CaptureFailure(message: "MCP capture returned no structured content")
        }

        guard structured.status == "saved_locally" else {
            throw CaptureFailure(message: "MCP capture failed: \(structured.status ?? "unknown")")
        }

        return CaptureResult(backupState: mapBackupStatus(structured.backupStatus))
    }

    private func mapBackupStatus(_ status: String?) -> BackupState {
        switch status {
        case "backed_up": return .backedUp
        case "pending": return .pending
        default: return .skipped
        }
    }

    private func nextId() -> Int {
        let id = nextRequestId
        nextRequestId += 1
        return id
    }

    private func sendRequest<T: Encodable>(_ request: T) throws {
        let data = try JSONEncoder().encode(request)
        try transport.send(data)
    }

    private func receiveResponse() throws -> JSONRPCResponse {
        let data = try transport.receive()
        return try JSONDecoder().decode(JSONRPCResponse.self, from: data)
    }

    public func shutdown() {
        transport.stop()
    }
}

// MARK: - JSON-RPC Types

struct JSONRPCRequest<P: Encodable>: Encodable {
    let jsonrpc: String
    let id: Int
    let method: String
    let params: P
}

struct JSONRPCNotification: Encodable {
    let jsonrpc: String
    let method: String
}

struct InitializeParams: Encodable {
    let protocolVersion: String
    let capabilities: ClientCapabilities
    let clientInfo: ClientInfo
}

struct ClientCapabilities: Encodable {}

struct ClientInfo: Encodable {
    let name: String
    let version: String
}

struct ToolCallParams: Encodable {
    let name: String
    let arguments: [String: String]
}

struct JSONRPCResponse: Decodable {
    let jsonrpc: String
    let id: Int?
    let result: ToolResult?
    let error: RPCError?
}

struct ToolResult: Decodable {
    let structuredContent: StructuredCaptureContent?
}

struct StructuredCaptureContent: Decodable {
    let entryId: String?
    let status: String?
    let backupStatus: String?
}

struct RPCError: Decodable {
    let code: Int?
    let message: String?
}
