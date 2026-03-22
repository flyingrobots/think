import AppKit
import SwiftUI

@main
struct ThinkMenuBarApp: App {
    @NSApplicationDelegateAdaptor(ThinkMenuBarAppDelegate.self) private var appDelegate
    @StateObject private var appState = CaptureAppState()

    var body: some Scene {
        MenuBarExtra("think", systemImage: "brain.head.profile") {
            Button("New Thought") {
                appState.togglePanel()
            }

            Divider()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }
        .menuBarExtraStyle(.menu)
    }
}
