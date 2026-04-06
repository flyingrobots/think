import XCTest
@testable import ThinkCaptureAdapter

final class ThinkCommandResolverTests: XCTestCase {
    func testCLICommandResolverUsesExplicitCLIPathOverride() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let explicitPath = tempRoot.appendingPathComponent("bin/think.js")

        try FileManager.default.createDirectory(
            at: explicitPath.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        FileManager.default.createFile(
            atPath: explicitPath.path,
            contents: Data("console.log('think');".utf8)
        )

        let resolved = try ThinkCLICommandResolver.resolveCLIPath(
            environment: ["THINK_CLI_PATH": explicitPath.path],
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, explicitPath.path)
    }

    func testCLICommandResolverUsesRepoRootOverride() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let repoRoot = tempRoot.appendingPathComponent("think-repo", isDirectory: true)
        let binDirectory = repoRoot.appendingPathComponent("bin", isDirectory: true)

        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: binDirectory.appendingPathComponent("think.js").path,
            contents: Data("console.log('think');".utf8)
        )

        let resolved = try ThinkCLICommandResolver.resolveCLIPath(
            environment: ["THINK_REPO_ROOT": repoRoot.path],
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, binDirectory.appendingPathComponent("think.js").path)
    }

    func testMCPCommandResolverFindsMCPBySearchingUpwardsFromBundleDirectory() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let repoRoot = tempRoot.appendingPathComponent("think-repo", isDirectory: true)
        let binDirectory = repoRoot.appendingPathComponent("bin", isDirectory: true)
        let appBundleDirectory = repoRoot
            .appendingPathComponent("macos/.dist/ThinkMenuBarApp.app", isDirectory: true)

        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: appBundleDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: binDirectory.appendingPathComponent("think-mcp.js").path,
            contents: Data("console.log('think-mcp');".utf8)
        )

        let resolved = try ThinkMCPCommandResolver.resolveMCPPath(
            environment: [:],
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: appBundleDirectory.path,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, binDirectory.appendingPathComponent("think-mcp.js").path)
    }

    func testMCPCommandResolverUsesExplicitMCPPathOverride() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let explicitPath = tempRoot.appendingPathComponent("bin/think-mcp.js")

        try FileManager.default.createDirectory(
            at: explicitPath.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        FileManager.default.createFile(
            atPath: explicitPath.path,
            contents: Data("console.log('think-mcp');".utf8)
        )

        let resolved = try ThinkMCPCommandResolver.resolveMCPPath(
            environment: ["THINK_MCP_PATH": explicitPath.path],
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, explicitPath.path)
    }

    func testMCPCommandResolverUsesRepoRootOverride() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let repoRoot = tempRoot.appendingPathComponent("think-repo", isDirectory: true)
        let binDirectory = repoRoot.appendingPathComponent("bin", isDirectory: true)

        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: binDirectory.appendingPathComponent("think-mcp.js").path,
            contents: Data("console.log('think-mcp');".utf8)
        )

        let resolved = try ThinkMCPCommandResolver.resolveMCPPath(
            environment: ["THINK_REPO_ROOT": repoRoot.path],
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, binDirectory.appendingPathComponent("think-mcp.js").path)
    }

    func testPathSearcherPrefersExplicitPathWhenPresent() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let explicitPath = tempRoot.appendingPathComponent("bin/think.js")

        try FileManager.default.createDirectory(
            at: explicitPath.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        FileManager.default.createFile(
            atPath: explicitPath.path,
            contents: Data("console.log('think');".utf8)
        )

        let resolved = PathSearcher.resolve(
            explicitPath: explicitPath.path,
            repoRoot: nil,
            scriptRelativePath: "bin/think.js",
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, explicitPath.path)
    }

    func testPathSearcherUsesRepoRootBeforeSearchingUpwards() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let repoRoot = tempRoot.appendingPathComponent("think-repo", isDirectory: true)
        let binDirectory = repoRoot.appendingPathComponent("bin", isDirectory: true)

        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: binDirectory.appendingPathComponent("think-mcp.js").path,
            contents: Data("console.log('think-mcp');".utf8)
        )

        let resolved = PathSearcher.resolve(
            explicitPath: nil,
            repoRoot: repoRoot.path,
            scriptRelativePath: "bin/think-mcp.js",
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: nil,
            fileManager: .default
        )

        XCTAssertEqual(resolved, binDirectory.appendingPathComponent("think-mcp.js").path)
    }

    func testPathSearcherSearchesUpwardsFromProcessExecutableDirectory() throws {
        let tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let repoRoot = tempRoot.appendingPathComponent("think-repo", isDirectory: true)
        let binDirectory = repoRoot.appendingPathComponent("bin", isDirectory: true)
        let processDirectory = repoRoot
            .appendingPathComponent("macos/.build/debug", isDirectory: true)
        let processExecutablePath = processDirectory.appendingPathComponent("ThinkMenuBarApp").path

        try FileManager.default.createDirectory(at: binDirectory, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: processDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: binDirectory.appendingPathComponent("think.js").path,
            contents: Data("console.log('think');".utf8)
        )

        let resolved = PathSearcher.resolve(
            explicitPath: nil,
            repoRoot: nil,
            scriptRelativePath: "bin/think.js",
            currentDirectoryPath: "/tmp",
            bundleDirectoryPath: nil,
            processExecutablePath: processExecutablePath,
            fileManager: .default
        )

        XCTAssertEqual(resolved, binDirectory.appendingPathComponent("think.js").path)
    }
}
