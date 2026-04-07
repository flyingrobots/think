import Foundation

public enum ThinkCaptureIngress: String, Equatable, Sendable {
    case url
    case shortcut
    case selectedText = "selected_text"
    case share = "share"
}

public struct ThinkCaptureURLRequest: Equatable, Sendable {
    public let text: String
    public let ingress: ThinkCaptureIngress
    public let sourceApp: String?

    public init(url: URL) throws {
        guard url.scheme?.lowercased() == "think" else {
            throw CaptureFailure(message: "Unsupported think URL")
        }

        let route = if let host = url.host, !host.isEmpty {
            host.lowercased()
        } else {
            url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
        }

        guard route == "capture" else {
            throw CaptureFailure(message: "Unsupported think URL")
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw CaptureFailure(message: "Unsupported think URL")
        }

        let queryItems = components.queryItems ?? []
        let rawText = queryItems.first(where: { $0.name == "text" })?.value ?? ""
        guard !rawText.isEmpty else {
            throw CaptureFailure(message: "URL capture requires text")
        }

        let rawIngress = queryItems.first(where: { $0.name == "ingress" })?.value?.lowercased()
        let ingress = ThinkCaptureIngress(rawValue: rawIngress ?? "") ?? .url
        let sourceApp = queryItems.first(where: { $0.name == "sourceApp" })?.value

        self.text = rawText
        self.ingress = ingress
        self.sourceApp = sourceApp
    }
}

public struct ThinkCaptureURLHandler: Sendable {
    private let client: ThinkCapturing

    public init(client: ThinkCapturing) {
        self.client = client
    }

    public func handle(url: URL) async throws -> CaptureResult {
        let request = try ThinkCaptureURLRequest(url: url)
        return try await handle(request: request)
    }

    public func handle(request: ThinkCaptureURLRequest) async throws -> CaptureResult {
        return try await client.capture(
            text: request.text,
            provenance: ThinkCaptureProvenance(
                ingress: request.ingress,
                sourceApp: request.sourceApp
            )
        )
    }
}
