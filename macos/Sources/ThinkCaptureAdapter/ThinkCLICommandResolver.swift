import Foundation

public enum ThinkCLICommandResolver {
    public static func makeDefault(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        currentDirectoryPath: String = FileManager.default.currentDirectoryPath,
        fileManager: FileManager = .default
    ) throws -> ThinkCLICommand {
        let cliPath = try resolveCLIPath(
            environment: environment,
            currentDirectoryPath: currentDirectoryPath,
            fileManager: fileManager
        )

        return ThinkCLICommand(
            executablePath: "/usr/bin/env",
            baseArguments: ["node", cliPath],
            environment: environment
        )
    }

    private static func resolveCLIPath(
        environment: [String: String],
        currentDirectoryPath: String,
        fileManager: FileManager
    ) throws -> String {
        if let explicit = environment["THINK_CLI_PATH"], fileManager.fileExists(atPath: explicit) {
            return explicit
        }

        if let repoRoot = environment["THINK_REPO_ROOT"] {
            let candidate = URL(fileURLWithPath: repoRoot)
                .appendingPathComponent("bin/think.js")
                .path
            if fileManager.fileExists(atPath: candidate) {
                return candidate
            }
        }

        let startURL = URL(fileURLWithPath: currentDirectoryPath, isDirectory: true)
        if let discovered = searchUpwardsForCLI(from: startURL, fileManager: fileManager) {
            return discovered
        }

        throw CaptureFailure(message: "Could not locate bin/think.js")
    }

    private static func searchUpwardsForCLI(from startURL: URL, fileManager: FileManager) -> String? {
        var currentURL: URL? = startURL.standardizedFileURL

        while let url = currentURL {
            let candidate = url.appendingPathComponent("bin/think.js").path
            if fileManager.fileExists(atPath: candidate) {
                return candidate
            }

            let parent = url.deletingLastPathComponent()
            if parent.path == url.path {
                return nil
            }

            currentURL = parent
        }

        return nil
    }
}
