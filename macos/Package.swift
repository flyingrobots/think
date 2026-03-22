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
    ],
    targets: [
        .target(
            name: "ThinkCaptureAdapter"
        ),
        .testTarget(
            name: "ThinkCaptureAdapterTests",
            dependencies: ["ThinkCaptureAdapter"]
        ),
    ]
)
