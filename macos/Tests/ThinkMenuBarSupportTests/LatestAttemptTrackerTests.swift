import XCTest
@testable import ThinkMenuBarSupport

final class LatestAttemptTrackerTests: XCTestCase {
    func testBeginReturnsLatestAttemptIdentifier() {
        var tracker = LatestAttemptTracker()

        let first = tracker.begin()
        let second = tracker.begin()

        XCTAssertEqual(first, 1)
        XCTAssertEqual(second, 2)
        XCTAssertFalse(tracker.isLatest(first))
        XCTAssertTrue(tracker.isLatest(second))
    }
}
