import AppKit
import Combine
import Foundation
import ThinkCaptureAdapter

@MainActor
final class CaptureAppState: ObservableObject {
    let model: CapturePanelModel

    private let panelController: CapturePanelController
    private let hotKeyMonitor: GlobalHotKeyMonitor

    init() {
        let client = CaptureAppState.makeClient()
        let model = CapturePanelModel(client: client)

        self.model = model
        self.panelController = CapturePanelController(model: model)
        self.hotKeyMonitor = GlobalHotKeyMonitor { [weak model] in
            guard let model else { return }
            Task { @MainActor in
                model.toggle()
            }
        }

        self.hotKeyMonitor.start()
    }

    func togglePanel() {
        model.toggle()
    }

    private static func makeClient() -> ThinkCapturing {
        do {
            return ThinkCLIAdapter(
                runner: SystemProcessRunner(),
                command: try ThinkCLICommandResolver.makeDefault()
            )
        } catch let error as CaptureFailure {
            return UnavailableCaptureClient(message: error.message)
        } catch {
            return UnavailableCaptureClient(message: "Could not locate think CLI")
        }
    }
}

private struct UnavailableCaptureClient: ThinkCapturing {
    let message: String

    func capture(text: String) async throws -> CaptureResult {
        throw CaptureFailure(message: message)
    }
}
