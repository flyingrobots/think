import AppKit
import XCTest
@testable import ThinkCaptureAdapter

final class ThinkSharedTextServiceProviderTests: XCTestCase {
    func testServiceProviderRoutesSelectedTextFromPasteboardIntoRequestHandler() {
        let pasteboard = NSPasteboard.withUniqueName()
        pasteboard.clearContents()
        pasteboard.setString("selected text from Safari", forType: .string)

        let recorder = SharedTextRequestRecorder()
        let provider = ThinkSharedTextServiceProvider(
            onRequest: { recorder.record($0) },
            sourceAppProvider: { "Safari" }
        )
        var errorMessage: NSString?

        provider.captureSelectedText(pasteboard, userData: nil, error: &errorMessage)

        XCTAssertNil(errorMessage)
        XCTAssertEqual(recorder.requests.count, 1)
        XCTAssertEqual(recorder.requests.first?.text, "selected text from Safari")
        XCTAssertEqual(recorder.requests.first?.ingress, .selectedText)
        XCTAssertEqual(recorder.requests.first?.sourceApp, "Safari")
    }

    func testServiceProviderCarriesSourceURLWhenPasteboardIncludesOne() {
        let pasteboard = NSPasteboard.withUniqueName()
        let sourceURL = URL(string: "https://example.com/article")!
        pasteboard.clearContents()
        pasteboard.setString("selected text", forType: .string)
        pasteboard.setString(sourceURL.absoluteString, forType: .URL)

        let recorder = SharedTextRequestRecorder()
        let provider = ThinkSharedTextServiceProvider(
            onRequest: { recorder.record($0) },
            sourceAppProvider: { "Safari" }
        )
        var errorMessage: NSString?

        provider.captureSelectedText(pasteboard, userData: nil, error: &errorMessage)

        XCTAssertNil(errorMessage)
        XCTAssertEqual(recorder.requests.first?.sourceURL, sourceURL)
    }

    func testServiceProviderReportsErrorForUnsupportedPasteboardTypes() {
        let pasteboard = NSPasteboard.withUniqueName()
        pasteboard.clearContents()
        pasteboard.setString("https://example.com/article", forType: .URL)

        let recorder = SharedTextRequestRecorder()
        let provider = ThinkSharedTextServiceProvider(
            onRequest: { recorder.record($0) },
            sourceAppProvider: { "Safari" }
        )
        var errorMessage: NSString?

        provider.captureSelectedText(pasteboard, userData: nil, error: &errorMessage)

        XCTAssertTrue(recorder.requests.isEmpty)
        XCTAssertEqual(errorMessage as String?, "Shared-text capture requires plain text")
    }
}

private final class SharedTextRequestRecorder: @unchecked Sendable {
    private(set) var requests: [ThinkCaptureSharedTextRequest] = []

    func record(_ request: ThinkCaptureSharedTextRequest) {
        requests.append(request)
    }
}
