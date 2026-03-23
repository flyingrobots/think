// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "ThinkMacOS",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "ThinkCaptureAdapter",
            targets: ["ThinkCaptureAdapter"]
        ),
        .library(
            name: "ThinkMenuBarSupport",
            targets: ["ThinkMenuBarSupport"]
        ),
        .executable(
            name: "ThinkMenuBarApp",
            targets: ["ThinkMenuBarApp"]
        ),
    ],
    targets: [
        .target(
            name: "ThinkCaptureAdapter"
        ),
        .target(
            name: "ThinkMenuBarSupport"
        ),
        .executableTarget(
            name: "ThinkMenuBarApp",
            dependencies: ["ThinkCaptureAdapter", "ThinkMenuBarSupport"]
        ),
        .testTarget(
            name: "ThinkCaptureAdapterTests",
            dependencies: ["ThinkCaptureAdapter"]
        ),
        .testTarget(
            name: "ThinkMenuBarSupportTests",
            dependencies: ["ThinkMenuBarSupport"]
        ),
    ]
)
