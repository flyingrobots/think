import AppKit
import SwiftUI

@main
struct ThinkMenuBarApp: App {
    @NSApplicationDelegateAdaptor(ThinkMenuBarAppDelegate.self) private var appDelegate
    @StateObject private var appState = CaptureAppState()

    var body: some Scene {
        MenuBarExtra(menuBarTitle, systemImage: menuBarIcon) {
            if appState.isRestartRecommended {
                Button("Restart to load latest build") {
                    appState.restartToLoadLatestBuild()
                }

                Divider()
            }

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

    private var menuBarTitle: String {
        appState.isRestartRecommended ? "think !" : "think"
    }

    private var menuBarIcon: String {
        appState.isRestartRecommended ? "arrow.trianglehead.clockwise" : "brain.head.profile"
    }
}
