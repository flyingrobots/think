import Foundation

public enum ThinkMCPCommandResolver {
    public static func makeDefault(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        currentDirectoryPath: String = FileManager.default.currentDirectoryPath,
        bundleDirectoryPath: String? = Bundle.main.bundleURL.path,
        processExecutablePath: String? = ProcessInfo.processInfo.arguments.first,
        fileManager: FileManager = .default
    ) throws -> StdioMCPTransport {
        let mcpPath = try resolveMCPPath(
            environment: environment,
            currentDirectoryPath: currentDirectoryPath,
            bundleDirectoryPath: bundleDirectoryPath,
            processExecutablePath: processExecutablePath,
            fileManager: fileManager
        )

        return StdioMCPTransport(
            executablePath: "/usr/bin/env",
            arguments: ["node", mcpPath],
            environment: environment
        )
    }

    private static func resolveMCPPath(
        environment: [String: String],
        currentDirectoryPath: String,
        bundleDirectoryPath: String?,
        processExecutablePath: String?,
        fileManager: FileManager
    ) throws -> String {
        if let mcpPath = PathSearcher.resolve(
            explicitPath: environment["THINK_MCP_PATH"],
            repoRoot: environment["THINK_REPO_ROOT"],
            scriptRelativePath: "bin/think-mcp.js",
            currentDirectoryPath: currentDirectoryPath,
            bundleDirectoryPath: bundleDirectoryPath,
            processExecutablePath: processExecutablePath,
            fileManager: fileManager
        ) {
            return mcpPath
        }

        throw CaptureFailure(message: "Could not locate bin/think-mcp.js")
    }
}
