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
        if let explicit = environment["THINK_MCP_PATH"], fileManager.fileExists(atPath: explicit) {
            return explicit
        }

        if let repoRoot = environment["THINK_REPO_ROOT"] {
            let candidate = URL(fileURLWithPath: repoRoot)
                .appendingPathComponent("bin/think-mcp.js")
                .path
            if fileManager.fileExists(atPath: candidate) {
                return candidate
            }
        }

        for searchRoot in searchRoots(
            currentDirectoryPath: currentDirectoryPath,
            bundleDirectoryPath: bundleDirectoryPath,
            processExecutablePath: processExecutablePath
        ) {
            if let discovered = searchUpwardsForMCP(from: searchRoot, fileManager: fileManager) {
                return discovered
            }
        }

        throw CaptureFailure(message: "Could not locate bin/think-mcp.js")
    }

    private static func searchRoots(
        currentDirectoryPath: String,
        bundleDirectoryPath: String?,
        processExecutablePath: String?
    ) -> [URL] {
        var roots: [URL] = []
        var seen: Set<String> = []

        func appendSearchRoot(_ url: URL?) {
            guard let url else { return }
            let standardized = url.standardizedFileURL
            if seen.insert(standardized.path).inserted {
                roots.append(standardized)
            }
        }

        appendSearchRoot(URL(fileURLWithPath: currentDirectoryPath, isDirectory: true))

        if let bundleDirectoryPath, !bundleDirectoryPath.isEmpty {
            appendSearchRoot(URL(fileURLWithPath: bundleDirectoryPath, isDirectory: true))
        }

        if let processExecutablePath, !processExecutablePath.isEmpty {
            appendSearchRoot(URL(fileURLWithPath: processExecutablePath).deletingLastPathComponent())
        }

        return roots
    }

    private static func searchUpwardsForMCP(from startURL: URL, fileManager: FileManager) -> String? {
        var currentURL: URL? = startURL.standardizedFileURL

        while let url = currentURL {
            let candidate = url.appendingPathComponent("bin/think-mcp.js").path
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
