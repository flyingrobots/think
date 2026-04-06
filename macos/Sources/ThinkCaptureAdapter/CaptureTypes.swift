import Foundation

public enum BackupState: Equatable, Sendable {
    case skipped
    case backedUp
    case pending
}

public struct CaptureResult: Equatable, Sendable {
    public let backupState: BackupState

    public init(backupState: BackupState) {
        self.backupState = backupState
    }
}

public struct CaptureFailure: Error, Equatable, Sendable {
    public let message: String
    public let isTransportError: Bool

    public init(message: String, isTransportError: Bool = false) {
        self.message = message
        self.isTransportError = isTransportError
    }
}

public protocol ThinkCapturing: Sendable {
    func capture(text: String) async throws -> CaptureResult
}
