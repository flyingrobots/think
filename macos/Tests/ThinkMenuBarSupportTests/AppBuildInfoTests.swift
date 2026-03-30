import XCTest
@testable import ThinkMenuBarSupport

final class AppBuildInfoTests: XCTestCase {
    func testReaderFormatsMatchingVersionAndBuildOnce() {
        let buildInfo = AppBuildInfoReader.from(infoDictionary: [
            "CFBundleShortVersionString": "0.4.0",
            "CFBundleVersion": "0.4.0",
        ])

        XCTAssertEqual(buildInfo.displayString, "Version 0.4.0")
    }

    func testReaderFormatsDistinctVersionAndBuild() {
        let buildInfo = AppBuildInfoReader.from(infoDictionary: [
            "CFBundleShortVersionString": "0.5.0",
            "CFBundleVersion": "123",
        ])

        XCTAssertEqual(buildInfo.displayString, "Version 0.5.0 (123)")
    }

    func testReaderFallsBackToBuildWhenShortVersionIsMissing() {
        let buildInfo = AppBuildInfoReader.from(infoDictionary: [
            "CFBundleVersion": "123",
        ])

        XCTAssertEqual(buildInfo.displayString, "Build 123")
    }

    func testReaderFallsBackToDevBuildWhenMetadataIsUnavailable() {
        let buildInfo = AppBuildInfoReader.from(infoDictionary: nil)

        XCTAssertEqual(buildInfo.displayString, "Version dev build")
    }
}
