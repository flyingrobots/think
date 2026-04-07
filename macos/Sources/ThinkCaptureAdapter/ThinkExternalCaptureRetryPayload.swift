import Foundation

public enum ThinkExternalCaptureRetryPayload: Equatable, Sendable {
    case url(ThinkCaptureURLRequest)
    case sharedText(ThinkCaptureSharedTextRequest)

    public var retryText: String {
        switch self {
        case .url(let request):
            return request.text
        case .sharedText(let request):
            return request.text
        }
    }

    public func retry(
        using urlHandler: ThinkCaptureURLHandler,
        sharedTextHandler: ThinkCaptureSharedTextHandler
    ) async throws -> CaptureResult {
        switch self {
        case .url(let request):
            return try await urlHandler.handle(request: request)
        case .sharedText(let request):
            return try await sharedTextHandler.handle(request: request)
        }
    }
}
