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

    func testSharedTextHandlerRoutesExactTextThroughExistingCaptureCore() async throws {
        let client = RecordingCapturer(result: CaptureResult(backupState: .backedUp))
        let handler = ThinkCaptureSharedTextHandler(client: client)
        let request = try ThinkCaptureSharedTextRequest(
            item: .text("line one\nline two\n"),
            ingress: .selectedText,
            sourceApp: "Safari"
        )

        let result = try await handler.handle(request: request)

        XCTAssertEqual(result, CaptureResult(backupState: .backedUp))
        XCTAssertEqual(client.capturedTexts, ["line one\nline two\n"])
    }
}

private final class RecordingCapturer: ThinkCapturing, @unchecked Sendable {
    private let result: CaptureResult

    private(set) var capturedTexts: [String] = []

    init(result: CaptureResult) {
        self.result = result
    }

    func capture(text: String) async throws -> CaptureResult {
        capturedTexts.append(text)
        return result
    }
}
