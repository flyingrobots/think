import AppKit
import ThinkCaptureAdapter

extension Notification.Name {
    static let thinkCaptureOpenURL = Notification.Name("ThinkCaptureOpenURL")
    static let thinkCaptureSharedText = Notification.Name("ThinkCaptureSharedText")
}

enum ThinkCaptureOpenURLUserInfoKey {
    static let url = "url"
}

enum ThinkCaptureSharedTextUserInfoKey {
    static let request = "request"
}

final class ThinkMenuBarAppDelegate: NSObject, NSApplicationDelegate {
    private let sharedTextServicePortName = "think"

    private lazy var sharedTextServiceProvider = ThinkSharedTextServiceProvider { request in
        NotificationCenter.default.post(
            name: .thinkCaptureSharedText,
            object: nil,
            userInfo: [ThinkCaptureSharedTextUserInfoKey.request: request]
        )
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        NSApp.servicesProvider = sharedTextServiceProvider
        NSRegisterServicesProvider(sharedTextServiceProvider, sharedTextServicePortName)
        NSUpdateDynamicServices()
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            NotificationCenter.default.post(
                name: .thinkCaptureOpenURL,
                object: nil,
                userInfo: [ThinkCaptureOpenURLUserInfoKey.url: url]
            )
        }
    }
}
