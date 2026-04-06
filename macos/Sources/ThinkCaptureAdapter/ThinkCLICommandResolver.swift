import Foundation

public enum ThinkCLICommandResolver {
    public static func makeDefault(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        currentDirectoryPath: String = FileManager.default.currentDirectoryPath,
        bundleDirectoryPath: String? = Bundle.main.bundleURL.path,
        processExecutablePath: String? = ProcessInfo.processInfo.arguments.first,
        fileManager: FileManager = .default
    ) throws -> ThinkCLICommand {
        let cliPath = try resolveCLIPath(
            environment: environment,
            currentDirectoryPath: currentDirectoryPath,
            bundleDirectoryPath: bundleDirectoryPath,
            processExecutablePath: processExecutablePath,
            fileManager: fileManager
        )

        return ThinkCLICommand(
            executablePath: "/usr/bin/env",
            baseArguments: ["node", cliPath],
            environment: environment
        )
    }

    static func resolveCLIPath(
        environment: [String: String],
        currentDirectoryPath: String,
        bundleDirectoryPath: String?,
        processExecutablePath: String?,
        fileManager: FileManager
    ) throws -> String {
        if let cliPath = PathSearcher.resolve(
            explicitPath: environment["THINK_CLI_PATH"],
            repoRoot: environment["THINK_REPO_ROOT"],
            scriptRelativePath: "bin/think.js",
            currentDirectoryPath: currentDirectoryPath,
            bundleDirectoryPath: bundleDirectoryPath,
            processExecutablePath: processExecutablePath,
            fileManager: fileManager
        ) {
            return cliPath
        }

        throw CaptureFailure(message: "Could not locate bin/think.js")
    }
}
