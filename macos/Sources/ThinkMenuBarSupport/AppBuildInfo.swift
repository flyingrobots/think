import Foundation

public struct AppBuildInfo: Equatable, Sendable {
    public let shortVersion: String?
    public let buildNumber: String?

    public init(shortVersion: String?, buildNumber: String?) {
        self.shortVersion = AppBuildInfo.normalized(shortVersion)
        self.buildNumber = AppBuildInfo.normalized(buildNumber)
    }

    public var displayString: String {
        switch (shortVersion, buildNumber) {
        case let (.some(shortVersion), .some(buildNumber)) where shortVersion != buildNumber:
            return "Version \(shortVersion) (\(buildNumber))"
        case let (.some(shortVersion), _):
            return "Version \(shortVersion)"
        case let (.none, .some(buildNumber)):
            return "Build \(buildNumber)"
        case (.none, .none):
            return "Version dev build"
        }
    }

    private static func normalized(_ value: String?) -> String? {
        guard let value else {
            return nil
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        return trimmed
    }
}

public enum AppBuildInfoReader {
    public static func current(bundle: Bundle = .main) -> AppBuildInfo {
        from(infoDictionary: bundle.infoDictionary)
    }

    public static func from(infoDictionary: [String: Any]?) -> AppBuildInfo {
        AppBuildInfo(
            shortVersion: infoDictionary?["CFBundleShortVersionString"] as? String,
            buildNumber: infoDictionary?["CFBundleVersion"] as? String
        )
    }
}
