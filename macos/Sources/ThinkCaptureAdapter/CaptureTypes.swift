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

public struct ThinkCaptureProvenance: Equatable, Sendable {
    public let ingress: ThinkCaptureIngress?
    public let sourceApp: String?
    public let sourceURL: URL?

    public init(
        ingress: ThinkCaptureIngress? = nil,
        sourceApp: String? = nil,
        sourceURL: URL? = nil
    ) {
        self.ingress = ingress
        self.sourceApp = sourceApp
        self.sourceURL = sourceURL
    }
}

public protocol ThinkCapturing: Sendable {
    func capture(text: String, provenance: ThinkCaptureProvenance?) async throws -> CaptureResult
}

public extension ThinkCapturing {
    func capture(text: String) async throws -> CaptureResult {
        try await capture(text: text, provenance: nil)
    }
}
