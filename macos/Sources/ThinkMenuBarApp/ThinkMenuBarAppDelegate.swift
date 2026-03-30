import AppKit

extension Notification.Name {
    static let thinkCaptureOpenURL = Notification.Name("ThinkCaptureOpenURL")
}

enum ThinkCaptureOpenURLUserInfoKey {
    static let url = "url"
}

final class ThinkMenuBarAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
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
