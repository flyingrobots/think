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

    func testServiceProviderReportsErrorForEmptyPasteboard() {
        let pasteboard = NSPasteboard.withUniqueName()
        pasteboard.clearContents()

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

    func testServiceProviderRoutesSourceAppLookupAndRequestDeliveryOntoMainThread() {
        let pasteboard = NSPasteboard.withUniqueName()
        pasteboard.clearContents()
        pasteboard.setString("selected text from Safari", forType: .string)

        let recorder = SharedTextRequestRecorder()
        let sourceAppExpectation = expectation(description: "source app provider runs on main thread")
        let requestExpectation = expectation(description: "request delivery runs on main thread")
        let provider = ThinkSharedTextServiceProvider(
            onRequest: { request in
                XCTAssertTrue(Thread.isMainThread)
                recorder.record(request)
                requestExpectation.fulfill()
            },
            sourceAppProvider: {
                XCTAssertTrue(Thread.isMainThread)
                sourceAppExpectation.fulfill()
                return "Safari"
            }
        )
        let providerBox = SendableBox(provider)
        let pasteboardBox = SendableBox(pasteboard)

        let invocationExpectation = expectation(description: "background invocation completes")
        Thread.detachNewThread {
            autoreleasepool {
            var errorMessage: NSString?
            providerBox.value.captureSelectedText(pasteboardBox.value, userData: nil, error: &errorMessage)
            XCTAssertNil(errorMessage)
            invocationExpectation.fulfill()
            }
        }

        wait(for: [sourceAppExpectation, requestExpectation, invocationExpectation], timeout: 2)
        XCTAssertEqual(recorder.requests.count, 1)
    }
}

private struct SendableBox<Value>: @unchecked Sendable {
    let value: Value

    init(_ value: Value) {
        self.value = value
    }
}

private final class SharedTextRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [ThinkCaptureSharedTextRequest] = []

    var requests: [ThinkCaptureSharedTextRequest] {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }

    func record(_ request: ThinkCaptureSharedTextRequest) {
        lock.lock()
        storage.append(request)
        lock.unlock()
    }
}
