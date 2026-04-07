import Foundation

public enum ThinkCaptureSharedItem: Equatable, Sendable {
    case text(String)
    case unsupported(typeIdentifier: String)
}

public struct ThinkCaptureSharedTextRequest: Equatable, Sendable {
    public let text: String
    public let ingress: ThinkCaptureIngress
    public let sourceApp: String?
    public let sourceURL: URL?

    public init(
        item: ThinkCaptureSharedItem,
        ingress: ThinkCaptureIngress,
        sourceApp: String? = nil,
        sourceURL: URL? = nil
    ) throws {
        switch item {
        case .text(let text):
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw CaptureFailure(message: "Shared-text capture requires text")
            }

            self.text = text
        case .unsupported:
            throw CaptureFailure(message: "Shared-text capture requires plain text")
        }

        self.ingress = ingress
        self.sourceApp = sourceApp
        self.sourceURL = sourceURL
    }
}

public struct ThinkCaptureSharedTextHandler: Sendable {
    private let client: ThinkCapturing

    public init(client: ThinkCapturing) {
        self.client = client
    }

    public func handle(request: ThinkCaptureSharedTextRequest) async throws -> CaptureResult {
        try await client.capture(
            text: request.text,
            provenance: ThinkCaptureProvenance(
                ingress: request.ingress,
                sourceApp: request.sourceApp,
                sourceURL: request.sourceURL
            )
        )
    }
}
