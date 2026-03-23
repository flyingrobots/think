import AppKit
import Combine
import Foundation
import ThinkCaptureAdapter
import ThinkMenuBarSupport

enum CaptureMenuState: Equatable {
    case idle
    case saving
    case saved
    case failed
}

@MainActor
final class CaptureAppState: ObservableObject {
    let model: CapturePanelModel
    @Published private(set) var isRestartRecommended = false
    @Published private(set) var captureMenuState: CaptureMenuState = .idle

    private let panelController: CapturePanelController
    private let hotKeyMonitor: GlobalHotKeyMonitor
    private var buildUpdateTracker = BuildUpdateTracker(
        snapshot: BuildUpdateBootstrapper.makeDefaultSnapshot()
    )
    private var updatePollingTask: Task<Void, Never>?
    private var statusResetTask: Task<Void, Never>?
    private var lastFailedText: String?

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

        self.model.onSubmissionEvent = { [weak self] event in
            self?.handleSubmissionEvent(event)
        }
        self.hotKeyMonitor.start()
        self.updatePollingTask = startUpdatePolling()
    }

    func togglePanel() {
        model.toggle()
    }

    func retryFailedCapture() {
        guard let lastFailedText, !model.isSubmitting else { return }

        Task { @MainActor in
            _ = await model.submit(text: lastFailedText)
        }
    }

    func restartToLoadLatestBuild() {
        let executablePath = buildUpdateTracker.snapshot.executablePath
        let environment = ProcessInfo.processInfo.environment
        let arguments = Array(CommandLine.arguments.dropFirst())

        let process = Process()
        process.executableURL = URL(fileURLWithPath: executablePath)
        process.arguments = arguments
        process.environment = environment

        do {
            try process.run()
            NSApplication.shared.terminate(nil)
        } catch {
            NSApplication.shared.terminate(nil)
        }
    }

    deinit {
        updatePollingTask?.cancel()
        statusResetTask?.cancel()
    }

    private static func makeClient() -> ThinkCapturing {
        if ProcessInfo.processInfo.environment["THINK_CAPTURE_FORCE_ERROR"] == "1" {
            return UnavailableCaptureClient(message: "Forced capture failure")
        }

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

    private func startUpdatePolling() -> Task<Void, Never> {
        Task { [weak self] in
            guard let self else { return }

            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))

                let shouldRecommendRestart = buildUpdateTracker.refresh(
                    reader: FileSystemModificationDateReader()
                )

                if shouldRecommendRestart != isRestartRecommended {
                    isRestartRecommended = shouldRecommendRestart
                }
            }
        }
    }

    private func handleSubmissionEvent(_ event: CaptureSubmissionEvent) {
        switch event {
        case .started(let text):
            statusResetTask?.cancel()
            lastFailedText = text
            captureMenuState = .saving
        case .succeeded:
            statusResetTask?.cancel()
            lastFailedText = nil
            captureMenuState = .saved
            statusResetTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(2))
                await MainActor.run {
                    self?.captureMenuState = .idle
                }
            }
        case .failed(let retryText, _):
            statusResetTask?.cancel()
            lastFailedText = retryText
            captureMenuState = .failed
        }
    }
}

private struct UnavailableCaptureClient: ThinkCapturing {
    let message: String

    func capture(text: String) async throws -> CaptureResult {
        throw CaptureFailure(message: message)
    }
}
