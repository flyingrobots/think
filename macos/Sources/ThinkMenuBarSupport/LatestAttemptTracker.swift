import Foundation

public struct LatestAttemptTracker: Sendable {
    private var latestID: UInt64 = 0

    public init() {}

    public mutating func begin() -> UInt64 {
        latestID += 1
        return latestID
    }

    public func isLatest(_ id: UInt64) -> Bool {
        latestID == id
    }
}
