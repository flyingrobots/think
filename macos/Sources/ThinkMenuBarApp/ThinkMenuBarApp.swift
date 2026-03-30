import AppKit
import SwiftUI

@main
struct ThinkMenuBarApp: App {
    @NSApplicationDelegateAdaptor(ThinkMenuBarAppDelegate.self) private var appDelegate
    @StateObject private var appState = CaptureAppState()

    var body: some Scene {
        MenuBarExtra(menuBarTitle, systemImage: menuBarIcon) {
            if let statusMessage {
                Text(statusMessage)
                    .foregroundStyle(.secondary)

                if appState.captureMenuState == .failed && appState.canRetryFailedCapture {
                    Button("Retry failed capture") {
                        appState.retryFailedCapture()
                    }
                }

                Divider()
            }

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

    private var menuBarTitle: String { "think" }

    private var menuBarIcon: String {
        switch appState.captureMenuState {
        case .saving:
            return "arrow.up.circle.fill"
        case .saved:
            return "checkmark.circle.fill"
        case .failed:
            return "exclamationmark.triangle.fill"
        case .idle:
            return appState.isRestartRecommended ? "arrow.trianglehead.clockwise" : "brain.head.profile"
        }
    }

    private var statusMessage: String? {
        switch appState.captureMenuState {
        case .idle:
            return nil
        case .saving:
            return "Saving thought..."
        case .saved:
            return "Thought captured."
        case .failed:
            return "Could not save thought."
        }
    }
}
