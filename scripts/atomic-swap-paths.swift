#!/usr/bin/env swift

import Darwin
import Foundation

enum AtomicSwapError: Error, CustomStringConvertible {
    case usage
    case requiresAbsolutePath(String)
    case missingDirectory(String)
    case symbolicLink(String)
    case differentFilesystems(String, String)
    case swapFailed(String)

    var description: String {
        switch self {
        case .usage:
            return "usage: atomic-swap-paths <first-directory> <second-directory>"
        case let .requiresAbsolutePath(path):
            return "path must be absolute: \(path)"
        case let .missingDirectory(path):
            return "directory not found: \(path)"
        case let .symbolicLink(path):
            return "refusing to swap a symbolic link: \(path)"
        case let .differentFilesystems(first, second):
            return "directories must share a filesystem: \(first), \(second)"
        case let .swapFailed(message):
            return message
        }
    }
}

struct DirectoryIdentity {
    let device: dev_t
    let path: String
}

func inspectDirectory(_ path: String) throws -> DirectoryIdentity {
    guard path.hasPrefix("/") else {
        throw AtomicSwapError.requiresAbsolutePath(path)
    }

    var metadata = stat()
    guard lstat(path, &metadata) == 0 else {
        throw AtomicSwapError.missingDirectory(path)
    }

    let kind = metadata.st_mode & S_IFMT
    guard kind != S_IFLNK else {
        throw AtomicSwapError.symbolicLink(path)
    }
    guard kind == S_IFDIR else {
        throw AtomicSwapError.missingDirectory(path)
    }

    return DirectoryIdentity(device: metadata.st_dev, path: path)
}

func swap(_ first: DirectoryIdentity, _ second: DirectoryIdentity) throws {
    guard first.device == second.device else {
        throw AtomicSwapError.differentFilesystems(first.path, second.path)
    }

    errno = 0
    guard renamex_np(first.path, second.path, UInt32(RENAME_SWAP)) == 0 else {
        let detail = String(cString: strerror(errno))
        throw AtomicSwapError.swapFailed("atomic directory swap failed: \(detail)")
    }
}

do {
    guard CommandLine.arguments.count == 3 else {
        throw AtomicSwapError.usage
    }
    let first = try inspectDirectory(CommandLine.arguments[1])
    let second = try inspectDirectory(CommandLine.arguments[2])
    try swap(first, second)
    print("swapped \(first.path) <-> \(second.path)")
} catch {
    FileHandle.standardError.write(Data("atomic-swap-paths: \(error)\n".utf8))
    exit(1)
}
