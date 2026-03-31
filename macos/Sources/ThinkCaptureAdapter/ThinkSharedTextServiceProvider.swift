import AppKit
import Foundation

public final class ThinkSharedTextServiceProvider: NSObject {
    private let onRequest: @Sendable (ThinkCaptureSharedTextRequest) -> Void
    private let sourceAppProvider: @Sendable () -> String?

    public init(
        onRequest: @escaping @Sendable (ThinkCaptureSharedTextRequest) -> Void,
        sourceAppProvider: @escaping @Sendable () -> String? = {
            NSWorkspace.shared.frontmostApplication?.localizedName
        }
    ) {
        self.onRequest = onRequest
        self.sourceAppProvider = sourceAppProvider
    }

    @objc(captureSelectedText:userData:error:)
    public func captureSelectedText(
        _ pasteboard: NSPasteboard,
        userData: String?,
        error errorPointer: AutoreleasingUnsafeMutablePointer<NSString?>
    ) {
        do {
            let request = try makeRequest(from: pasteboard, ingress: .selectedText)
            onRequest(request)
        } catch let failure as CaptureFailure {
            errorPointer.pointee = failure.message as NSString
        } catch {
            errorPointer.pointee = "Shared-text capture failed" as NSString
        }
    }

    func makeRequest(
        from pasteboard: NSPasteboard,
        ingress: ThinkCaptureIngress
    ) throws -> ThinkCaptureSharedTextRequest {
        guard let text = pasteboard.string(forType: .string) else {
            return try ThinkCaptureSharedTextRequest(
                item: .unsupported(typeIdentifier: primaryTypeIdentifier(from: pasteboard) ?? "unknown"),
                ingress: ingress,
                sourceApp: sourceAppProvider(),
                sourceURL: extractSourceURL(from: pasteboard)
            )
        }

        return try ThinkCaptureSharedTextRequest(
            item: .text(text),
            ingress: ingress,
            sourceApp: sourceAppProvider(),
            sourceURL: extractSourceURL(from: pasteboard)
        )
    }

    private func primaryTypeIdentifier(from pasteboard: NSPasteboard) -> String? {
        pasteboard.types?.first?.rawValue
    }

    private func extractSourceURL(from pasteboard: NSPasteboard) -> URL? {
        let candidates: [NSPasteboard.PasteboardType] = [.URL, .fileURL]

        for type in candidates {
            guard let rawValue = pasteboard.string(forType: type) else {
                continue
            }

            if let url = URL(string: rawValue) {
                return url
            }
        }

        return nil
    }
}
