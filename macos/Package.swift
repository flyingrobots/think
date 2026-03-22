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
        .executable(
            name: "ThinkMenuBarApp",
            targets: ["ThinkMenuBarApp"]
        ),
    ],
    targets: [
        .target(
            name: "ThinkCaptureAdapter"
        ),
        .executableTarget(
            name: "ThinkMenuBarApp",
            dependencies: ["ThinkCaptureAdapter"]
        ),
        .testTarget(
            name: "ThinkCaptureAdapterTests",
            dependencies: ["ThinkCaptureAdapter"]
        ),
    ]
)
