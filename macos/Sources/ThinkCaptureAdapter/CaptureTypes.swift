import Foundation

public enum BackupState: Equatable {
    case skipped
    case backedUp
    case pending
}

public struct CaptureResult: Equatable {
    public let backupState: BackupState

    public init(backupState: BackupState) {
        self.backupState = backupState
    }
}

public struct CaptureFailure: Error, Equatable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

public protocol ThinkCapturing {
    func capture(text: String) async throws -> CaptureResult
}
