import Foundation

public final class StdioMCPTransport: MCPTransport, @unchecked Sendable {
    private let executablePath: String
    private let arguments: [String]
    private let environment: [String: String]
    private var process: Process?
    private var stdinPipe: Pipe?
    private var stdoutPipe: Pipe?
    private let lock = NSLock()

    public init(executablePath: String, arguments: [String], environment: [String: String] = [:]) {
        self.executablePath = executablePath
        self.arguments = arguments
        self.environment = environment
    }

    public func start() throws {
        lock.lock()
        defer { lock.unlock() }

        let proc = Process()
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()

        proc.executableURL = URL(fileURLWithPath: executablePath)
        proc.arguments = arguments
        proc.environment = environment
        proc.standardInput = stdin
        proc.standardOutput = stdout
        proc.standardError = stderr

        try proc.run()

        self.process = proc
        self.stdinPipe = stdin
        self.stdoutPipe = stdout
    }

    public func send(_ data: Data) throws {
        guard let stdinPipe else {
            throw CaptureFailure(message: "MCP transport not started", isTransportError: true)
        }

        var message = data
        message.append(contentsOf: [0x0A]) // newline delimiter
        try stdinPipe.fileHandleForWriting.write(contentsOf: message)
    }

    public func receive() throws -> Data {
        guard let stdoutPipe else {
            throw CaptureFailure(message: "MCP transport not started", isTransportError: true)
        }

        let handle = stdoutPipe.fileHandleForReading
        var buffer = Data()

        while true {
            let byte = handle.readData(ofLength: 1)
            if byte.isEmpty {
                if let process, !process.isRunning {
                    throw CaptureFailure(message: "MCP process exited unexpectedly", isTransportError: true)
                }
                throw CaptureFailure(message: "MCP transport read failed", isTransportError: true)
            }
            if byte[0] == 0x0A {
                break
            }
            buffer.append(byte)
        }

        return buffer
    }

    public func stop() {
        lock.lock()
        defer { lock.unlock() }

        stdinPipe?.fileHandleForWriting.closeFile()
        process?.terminate()
        process = nil
        stdinPipe = nil
        stdoutPipe = nil
    }

    public var isRunning: Bool {
        process?.isRunning ?? false
    }
}
