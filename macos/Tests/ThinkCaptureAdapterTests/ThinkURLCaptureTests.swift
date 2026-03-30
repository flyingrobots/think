import XCTest
@testable import ThinkCaptureAdapter

final class ThinkURLCaptureTests: XCTestCase {
    func testCaptureURLDecodesRequiredTextAndOptionalProvenance() throws {
        let url = URL(string: "think://capture?text=hello%20there%0Afriend&ingress=shortcut&sourceApp=Safari")!

        let request = try ThinkCaptureURLRequest(url: url)

        XCTAssertEqual(request.text, "hello there\nfriend")
        XCTAssertEqual(request.ingress, .shortcut)
        XCTAssertEqual(request.sourceApp, "Safari")
    }

    func testCaptureURLDefaultsIngressToURLWhenParameterIsAbsent() throws {
        let url = URL(string: "think://capture?text=plain%20url%20capture")!

        let request = try ThinkCaptureURLRequest(url: url)

        XCTAssertEqual(request.text, "plain url capture")
        XCTAssertEqual(request.ingress, .url)
        XCTAssertNil(request.sourceApp)
    }

    func testCaptureURLRejectsMissingText() {
        let url = URL(string: "think://capture?sourceApp=Shortcuts")!

        XCTAssertThrowsError(try ThinkCaptureURLRequest(url: url)) { error in
            XCTAssertEqual(error as? CaptureFailure, CaptureFailure(message: "URL capture requires text"))
        }
    }

    func testCaptureURLRejectsUnexpectedRoute() {
        let url = URL(string: "think://reflect?text=wrong")!

        XCTAssertThrowsError(try ThinkCaptureURLRequest(url: url)) { error in
            XCTAssertEqual(error as? CaptureFailure, CaptureFailure(message: "Unsupported think URL"))
        }
    }

    func testURLHandlerRoutesExactDecodedTextThroughExistingCaptureCore() async throws {
        let client = RecordingCapturer(result: CaptureResult(backupState: .pending))
        let handler = ThinkCaptureURLHandler(client: client)
        let url = URL(string: "think://capture?text=%20keep%20leading%20space%0Aand%20newline%20&ingress=shortcut")!

        let result = try await handler.handle(url: url)

        XCTAssertEqual(result, CaptureResult(backupState: .pending))
        XCTAssertEqual(client.capturedTexts, [" keep leading space\nand newline "])
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
