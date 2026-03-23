import Foundation
import XCTest
@testable import ThinkMenuBarSupport

final class BuildUpdateTrackerTests: XCTestCase {
    func testRefreshStaysFalseWhenExecutableHasNotChanged() {
        let baseline = Date(timeIntervalSince1970: 1_000)
        var tracker = BuildUpdateTracker(
            snapshot: BuildUpdateSnapshot(
                executablePath: "/tmp/ThinkMenuBarApp",
                baselineModificationDate: baseline
            )
        )

        let isUpdateAvailable = tracker.refresh(
            reader: StubModificationDateReader(modificationDates: [
                "/tmp/ThinkMenuBarApp": baseline,
            ])
        )

        XCTAssertFalse(isUpdateAvailable)
        XCTAssertFalse(tracker.isUpdateAvailable)
    }

    func testRefreshTurnsTrueWhenExecutableOnDiskIsNewerThanBaseline() {
        let baseline = Date(timeIntervalSince1970: 1_000)
        let newer = Date(timeIntervalSince1970: 2_000)
        var tracker = BuildUpdateTracker(
            snapshot: BuildUpdateSnapshot(
                executablePath: "/tmp/ThinkMenuBarApp",
                baselineModificationDate: baseline
            )
        )

        let isUpdateAvailable = tracker.refresh(
            reader: StubModificationDateReader(modificationDates: [
                "/tmp/ThinkMenuBarApp": newer,
            ])
        )

        XCTAssertTrue(isUpdateAvailable)
        XCTAssertTrue(tracker.isUpdateAvailable)
    }

    func testRefreshSeedsBaselineWhenInitialModificationDateWasUnavailable() {
        let discovered = Date(timeIntervalSince1970: 2_000)
        var tracker = BuildUpdateTracker(
            snapshot: BuildUpdateSnapshot(
                executablePath: "/tmp/ThinkMenuBarApp",
                baselineModificationDate: nil
            )
        )

        let isUpdateAvailable = tracker.refresh(
            reader: StubModificationDateReader(modificationDates: [
                "/tmp/ThinkMenuBarApp": discovered,
            ])
        )

        XCTAssertFalse(isUpdateAvailable)
        XCTAssertEqual(tracker.snapshot.baselineModificationDate, discovered)
    }

    func testRefreshRemainsTrueAfterUpdateHasBeenDetected() {
        let baseline = Date(timeIntervalSince1970: 1_000)
        let newer = Date(timeIntervalSince1970: 2_000)
        var tracker = BuildUpdateTracker(
            snapshot: BuildUpdateSnapshot(
                executablePath: "/tmp/ThinkMenuBarApp",
                baselineModificationDate: baseline
            )
        )

        _ = tracker.refresh(
            reader: StubModificationDateReader(modificationDates: [
                "/tmp/ThinkMenuBarApp": newer,
            ])
        )

        let isUpdateAvailable = tracker.refresh(
            reader: StubModificationDateReader(modificationDates: [
                "/tmp/ThinkMenuBarApp": baseline,
            ])
        )

        XCTAssertTrue(isUpdateAvailable)
        XCTAssertTrue(tracker.isUpdateAvailable)
    }
}

private struct StubModificationDateReader: FileModificationDateReading {
    let modificationDates: [String: Date]

    func modificationDate(for path: String) -> Date? {
        modificationDates[path]
    }
}
