import Foundation

enum PathSearcher {
    static func resolve(
        explicitPath: String?,
        repoRoot: String?,
        scriptRelativePath: String,
        currentDirectoryPath: String,
        bundleDirectoryPath: String?,
        processExecutablePath: String?,
        fileManager: FileManager = .default
    ) -> String? {
        if let explicitPath,
           fileManager.fileExists(atPath: explicitPath) {
            return explicitPath
        }

        if let repoRoot {
            let candidate = URL(fileURLWithPath: repoRoot)
                .appendingPathComponent(scriptRelativePath)
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
            if let discovered = searchUpwards(
                from: searchRoot,
                scriptRelativePath: scriptRelativePath,
                fileManager: fileManager
            ) {
                return discovered
            }
        }

        return nil
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

    private static func searchUpwards(
        from startURL: URL,
        scriptRelativePath: String,
        fileManager: FileManager
    ) -> String? {
        var currentURL: URL? = startURL.standardizedFileURL

        while let url = currentURL {
            let candidate = url.appendingPathComponent(scriptRelativePath).path
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
