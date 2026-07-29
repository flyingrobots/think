#!/usr/bin/env swift

import Darwin
import Foundation

enum AtomicPublishError: Error, CustomStringConvertible {
    case usage
    case requiresAbsolutePath(String)
    case missingDirectory(String)
    case symbolicLink(String)
    case targetExists(String)
    case targetInspectionFailed(String)
    case differentFilesystems(String, String)
    case publishFailed(String)

    var description: String {
        switch self {
        case .usage:
            return "usage: atomic-publish-path <source-directory> <absent-target-path>"
        case let .requiresAbsolutePath(path):
            return "path must be absolute: \(path)"
        case let .missingDirectory(path):
            return "directory not found: \(path)"
        case let .symbolicLink(path):
            return "refusing to publish a symbolic link: \(path)"
        case let .targetExists(path):
            return "refusing to overwrite existing target: \(path)"
        case let .targetInspectionFailed(path):
            return "could not inspect target path: \(path)"
        case let .differentFilesystems(source, target):
            return "source and target parent must share a filesystem: \(source), \(target)"
        case let .publishFailed(message):
            return message
        }
    }
}

struct DirectoryIdentity {
    let device: dev_t
    let path: String
}

func requireAbsolutePath(_ path: String) throws {
    guard path.hasPrefix("/") else {
        throw AtomicPublishError.requiresAbsolutePath(path)
    }
}

func inspectDirectory(_ path: String) throws -> DirectoryIdentity {
    try requireAbsolutePath(path)

    var metadata = stat()
    guard lstat(path, &metadata) == 0 else {
        throw AtomicPublishError.missingDirectory(path)
    }

    let kind = metadata.st_mode & S_IFMT
    guard kind != S_IFLNK else {
        throw AtomicPublishError.symbolicLink(path)
    }
    guard kind == S_IFDIR else {
        throw AtomicPublishError.missingDirectory(path)
    }

    return DirectoryIdentity(device: metadata.st_dev, path: path)
}

func requireAbsentTarget(_ path: String) throws {
    try requireAbsolutePath(path)

    var metadata = stat()
    errno = 0
    if lstat(path, &metadata) == 0 {
        throw AtomicPublishError.targetExists(path)
    }
    guard errno == ENOENT else {
        throw AtomicPublishError.targetInspectionFailed(path)
    }
}

func publish(_ source: DirectoryIdentity, targetPath: String) throws {
    try requireAbsentTarget(targetPath)

    let targetParentPath = (targetPath as NSString).deletingLastPathComponent
    let targetParent = try inspectDirectory(targetParentPath)
    guard source.device == targetParent.device else {
        throw AtomicPublishError.differentFilesystems(source.path, targetPath)
    }

    errno = 0
    guard renamex_np(source.path, targetPath, UInt32(RENAME_EXCL)) == 0 else {
        let detail = String(cString: strerror(errno))
        throw AtomicPublishError.publishFailed("atomic directory publish failed: \(detail)")
    }
}

do {
    guard CommandLine.arguments.count == 3 else {
        throw AtomicPublishError.usage
    }
    let source = try inspectDirectory(CommandLine.arguments[1])
    let targetPath = CommandLine.arguments[2]
    try publish(source, targetPath: targetPath)
    print("published \(source.path) -> \(targetPath)")
} catch {
    FileHandle.standardError.write(Data("atomic-publish-path: \(error)\n".utf8))
    exit(1)
}
