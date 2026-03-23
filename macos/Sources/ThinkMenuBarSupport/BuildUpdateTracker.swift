import Foundation

public protocol FileModificationDateReading: Sendable {
    func modificationDate(for path: String) -> Date?
}

public struct FileSystemModificationDateReader: FileModificationDateReading {
    public init() {}

    public func modificationDate(for path: String) -> Date? {
        let attributes = try? FileManager.default.attributesOfItem(atPath: path)
        return attributes?[.modificationDate] as? Date
    }
}

public struct BuildUpdateSnapshot: Equatable, Sendable {
    public let executablePath: String
    public let baselineModificationDate: Date?

    public init(executablePath: String, baselineModificationDate: Date?) {
        self.executablePath = executablePath
        self.baselineModificationDate = baselineModificationDate
    }
}

public struct BuildUpdateTracker: Sendable {
    public private(set) var snapshot: BuildUpdateSnapshot
    public private(set) var isUpdateAvailable: Bool = false

    public init(snapshot: BuildUpdateSnapshot) {
        self.snapshot = snapshot
    }

    public mutating func refresh(reader: FileModificationDateReading) -> Bool {
        guard !isUpdateAvailable else { return true }

        let currentModificationDate = reader.modificationDate(for: snapshot.executablePath)

        switch (snapshot.baselineModificationDate, currentModificationDate) {
        case let (.some(baseline), .some(current)) where current > baseline:
            isUpdateAvailable = true
        case let (.none, .some(current)):
            snapshot = BuildUpdateSnapshot(
                executablePath: snapshot.executablePath,
                baselineModificationDate: current
            )
        default:
            break
        }

        return isUpdateAvailable
    }
}

public enum BuildUpdateBootstrapper {
    public static func makeDefaultSnapshot(
        executablePath: String = ProcessInfo.processInfo.arguments[0],
        reader: FileModificationDateReading = FileSystemModificationDateReader()
    ) -> BuildUpdateSnapshot {
        BuildUpdateSnapshot(
            executablePath: executablePath,
            baselineModificationDate: reader.modificationDate(for: executablePath)
        )
    }
}
