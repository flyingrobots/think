import AppKit
import Foundation

public final class ThinkSharedTextServiceProvider: NSObject {
    private let onRequest: @Sendable (ThinkCaptureSharedTextRequest) -> Void
    private let sourceAppProvider: @Sendable () -> String?

    public init(
        onRequest: @escaping @Sendable (ThinkCaptureSharedTextRequest) -> Void,
        sourceAppProvider: @escaping @Sendable () -> String? = {
            if Thread.isMainThread {
                return NSWorkspace.shared.frontmostApplication?.localizedName
            }

            return DispatchQueue.main.sync {
                NSWorkspace.shared.frontmostApplication?.localizedName
            }
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
            if Thread.isMainThread {
                onRequest(request)
            } else {
                DispatchQueue.main.sync { [onRequest] in
                    onRequest(request)
                }
            }
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
        let sourceApp = resolveSourceApp()
        let sourceURL = extractSourceURL(from: pasteboard)

        guard let text = pasteboard.string(forType: .string) else {
            return try ThinkCaptureSharedTextRequest(
                item: .unsupported(typeIdentifier: primaryTypeIdentifier(from: pasteboard) ?? "unknown"),
                ingress: ingress,
                sourceApp: sourceApp,
                sourceURL: sourceURL
            )
        }

        return try ThinkCaptureSharedTextRequest(
            item: .text(text),
            ingress: ingress,
            sourceApp: sourceApp,
            sourceURL: sourceURL
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

    private func resolveSourceApp() -> String? {
        if Thread.isMainThread {
            return sourceAppProvider()
        }

        return DispatchQueue.main.sync { [sourceAppProvider] in
            sourceAppProvider()
        }
    }
}
