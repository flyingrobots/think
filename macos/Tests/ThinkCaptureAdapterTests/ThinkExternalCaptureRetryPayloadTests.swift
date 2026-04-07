import Foundation
import XCTest
@testable import ThinkCaptureAdapter

final class ThinkExternalCaptureRetryPayloadTests: XCTestCase {
    func testURLRetryPayloadReplaysOriginalURLRequest() async throws {
        let client = RetryPayloadRecordingCapturer(result: CaptureResult(backupState: .skipped))
        let urlHandler = ThinkCaptureURLHandler(client: client)
        let sharedTextHandler = ThinkCaptureSharedTextHandler(client: client)
        let request = try ThinkCaptureURLRequest(
            url: URL(string: "think://capture?text=from%20shortcut&ingress=shortcut&sourceApp=Shortcuts")!
        )
        let payload = ThinkExternalCaptureRetryPayload.url(request)

        let result = try await payload.retry(using: urlHandler, sharedTextHandler: sharedTextHandler)
        let capturedCalls = await client.capturedCalls

        XCTAssertEqual(result, CaptureResult(backupState: .skipped))
        XCTAssertEqual(payload.retryText, "from shortcut")
        XCTAssertEqual(
            capturedCalls,
            [
                RetryPayloadCaptureCall(
                    text: "from shortcut",
                    provenance: ThinkCaptureProvenance(
                        ingress: .shortcut,
                        sourceApp: "Shortcuts"
                    )
                ),
            ]
        )
    }

    func testSharedTextRetryPayloadReplaysOriginalSharedTextRequest() async throws {
        let client = RetryPayloadRecordingCapturer(result: CaptureResult(backupState: .backedUp))
        let urlHandler = ThinkCaptureURLHandler(client: client)
        let sharedTextHandler = ThinkCaptureSharedTextHandler(client: client)
        let sourceURL = URL(string: "https://example.com/article")!
        let request = try ThinkCaptureSharedTextRequest(
            item: .text("selected text"),
            ingress: .selectedText,
            sourceApp: "Safari",
            sourceURL: sourceURL
        )
        let payload = ThinkExternalCaptureRetryPayload.sharedText(request)

        let result = try await payload.retry(using: urlHandler, sharedTextHandler: sharedTextHandler)
        let capturedCalls = await client.capturedCalls

        XCTAssertEqual(result, CaptureResult(backupState: .backedUp))
        XCTAssertEqual(payload.retryText, "selected text")
        XCTAssertEqual(
            capturedCalls,
            [
                RetryPayloadCaptureCall(
                    text: "selected text",
                    provenance: ThinkCaptureProvenance(
                        ingress: .selectedText,
                        sourceApp: "Safari",
                        sourceURL: sourceURL
                    )
                ),
            ]
        )
    }
}

private actor RetryPayloadRecordingCapturer: ThinkCapturing {
    private let result: CaptureResult

    private(set) var capturedCalls: [RetryPayloadCaptureCall] = []

    init(result: CaptureResult) {
        self.result = result
    }

    func capture(text: String, provenance: ThinkCaptureProvenance?) async throws -> CaptureResult {
        capturedCalls.append(RetryPayloadCaptureCall(text: text, provenance: provenance))
        return result
    }
}

private struct RetryPayloadCaptureCall: Equatable {
    let text: String
    let provenance: ThinkCaptureProvenance?
}
