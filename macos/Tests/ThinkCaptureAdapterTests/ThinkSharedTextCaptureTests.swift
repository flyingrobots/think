import Foundation
import XCTest
@testable import ThinkCaptureAdapter

final class ThinkSharedTextCaptureTests: XCTestCase {
    func testSharedTextRequestPreservesExactTextAndOptionalProvenance() throws {
        let sourceURL = URL(string: "https://example.com/article")!

        let request = try ThinkCaptureSharedTextRequest(
            item: .text(" keep leading space\nand trailing space "),
            ingress: .selectedText,
            sourceApp: "Safari",
            sourceURL: sourceURL
        )

        XCTAssertEqual(request.text, " keep leading space\nand trailing space ")
        XCTAssertEqual(request.ingress, .selectedText)
        XCTAssertEqual(request.sourceApp, "Safari")
        XCTAssertEqual(request.sourceURL, sourceURL)
    }

    func testSharedTextRequestSupportsShareIngress() throws {
        let request = try ThinkCaptureSharedTextRequest(
            item: .text("Shared from Mail"),
            ingress: .share,
            sourceApp: "Mail"
        )

        XCTAssertEqual(request.text, "Shared from Mail")
        XCTAssertEqual(request.ingress, .share)
        XCTAssertEqual(request.sourceApp, "Mail")
        XCTAssertNil(request.sourceURL)
    }

    func testSharedTextRequestRejectsEmptyText() {
        XCTAssertThrowsError(
            try ThinkCaptureSharedTextRequest(
                item: .text(""),
                ingress: .selectedText
            )
        ) { error in
            XCTAssertEqual(
                error as? CaptureFailure,
                CaptureFailure(message: "Shared-text capture requires text")
            )
        }
    }

    func testSharedTextRequestRejectsWhitespaceOnlyText() {
        XCTAssertThrowsError(
            try ThinkCaptureSharedTextRequest(
                item: .text("   \n\t  "),
                ingress: .selectedText
            )
        ) { error in
            XCTAssertEqual(
                error as? CaptureFailure,
                CaptureFailure(message: "Shared-text capture requires text")
            )
        }
    }

    func testSharedTextRequestRejectsUnsupportedSharedItem() {
        XCTAssertThrowsError(
            try ThinkCaptureSharedTextRequest(
                item: .unsupported(typeIdentifier: "public.jpeg"),
                ingress: .share,
                sourceApp: "Preview"
            )
        ) { error in
            XCTAssertEqual(
                error as? CaptureFailure,
                CaptureFailure(message: "Shared-text capture requires plain text")
            )
        }
    }

    func testSharedTextHandlerRoutesExactTextAndProvenanceThroughExistingCaptureCore() async throws {
        let client = RecordingCapturer(result: CaptureResult(backupState: .backedUp))
        let handler = ThinkCaptureSharedTextHandler(client: client)
        let sourceURL = URL(string: "https://example.com/article")!
        let request = try ThinkCaptureSharedTextRequest(
            item: .text("line one\nline two\n"),
            ingress: .selectedText,
            sourceApp: "Safari",
            sourceURL: sourceURL
        )

        let result = try await handler.handle(request: request)
        let capturedCalls = await client.capturedCalls

        XCTAssertEqual(result, CaptureResult(backupState: .backedUp))
        XCTAssertEqual(
            capturedCalls,
            [
                CaptureCall(
                    text: "line one\nline two\n",
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

private actor RecordingCapturer: ThinkCapturing {
    private let result: CaptureResult

    private(set) var capturedCalls: [CaptureCall] = []

    init(result: CaptureResult) {
        self.result = result
    }

    func capture(text: String, provenance: ThinkCaptureProvenance?) async throws -> CaptureResult {
        capturedCalls.append(CaptureCall(text: text, provenance: provenance))
        return result
    }
}

private struct CaptureCall: Equatable {
    let text: String
    let provenance: ThinkCaptureProvenance?
}
