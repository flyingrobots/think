import XCTest
@testable import ThinkCaptureAdapter

final class CapturePanelModelTests: XCTestCase {
    func testToggleOpensReadyPanelWithFocusAndNoPlaceholderByDefault() {
        let model = CapturePanelModel(client: FakeCaptureClient())

        model.toggle()

        XCTAssertEqual(model.phase, .ready)
        XCTAssertTrue(model.isTextFieldFocused)
        XCTAssertEqual(model.text, "")
        XCTAssertNil(model.configuration.placeholder)
    }

    func testSecondToggleHidesThePanel() {
        let model = CapturePanelModel(client: FakeCaptureClient())

        model.toggle()
        model.toggle()

        XCTAssertEqual(model.phase, .hidden)
        XCTAssertFalse(model.isTextFieldFocused)
    }

    func testEscapeCancelsWithoutCallingCapture() async {
        let client = FakeCaptureClient()
        let model = CapturePanelModel(client: client)

        model.toggle()
        model.updateText("discard this")
        model.cancel()

        XCTAssertEqual(model.phase, .hidden)
        XCTAssertEqual(model.text, "")
        XCTAssertEqual(client.receivedTexts, [])
    }

    func testSuccessfulSubmitDismissesImmediatelyAfterLocalSuccess() async {
        let client = FakeCaptureClient(result: .success(CaptureResult(backupState: .skipped)))
        let model = CapturePanelModel(client: client)

        model.toggle()
        model.updateText("capture this")
        let result = await model.submit()

        XCTAssertEqual(result, CaptureResult(backupState: .skipped))
        XCTAssertEqual(model.phase, .hidden)
        XCTAssertEqual(model.text, "")
        XCTAssertFalse(model.isTextFieldFocused)
        XCTAssertEqual(client.receivedTexts, ["capture this"])
    }

    func testBackupPendingStillDismissesLikeSuccess() async {
        let client = FakeCaptureClient(result: .success(CaptureResult(backupState: .pending)))
        let model = CapturePanelModel(client: client)

        model.toggle()
        model.updateText("pending backup")
        let result = await model.submit()

        XCTAssertEqual(result, CaptureResult(backupState: .pending))
        XCTAssertEqual(model.phase, .hidden)
    }

    func testFailureShowsMinimalErrorAndAllowsRetry() async {
        let client = FakeCaptureClient(result: .failure(CaptureFailure(message: "full stderr dump should not leak")))
        let model = CapturePanelModel(client: client)

        model.toggle()
        model.updateText("retry me")
        let result = await model.submit()

        XCTAssertNil(result)
        XCTAssertEqual(model.phase, .error(message: "Could not save thought"))
        XCTAssertEqual(model.text, "retry me")
        XCTAssertFalse(model.isTextFieldFocused)

        model.retry()

        XCTAssertEqual(model.phase, .ready)
        XCTAssertTrue(model.isTextFieldFocused)
        XCTAssertEqual(model.text, "retry me")
    }
}

private final class FakeCaptureClient: ThinkCapturing {
    enum Result {
        case success(CaptureResult)
        case failure(Error)
    }

    var receivedTexts: [String] = []
    private let result: Result

    init(result: Result = .success(CaptureResult(backupState: .skipped))) {
        self.result = result
    }

    func capture(text: String) async throws -> CaptureResult {
        receivedTexts.append(text)

        switch result {
        case .success(let result):
            return result
        case .failure(let error):
            throw error
        }
    }
}
