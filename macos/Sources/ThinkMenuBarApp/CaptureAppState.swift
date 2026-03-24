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

    private let metricsRecorder: PromptUXMetricsRecorder
    private let metricsTracker: PromptUXMetricsTracker
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
        let metricsRecorder = PromptUXMetricsRecorder()
        let metricsTracker = PromptUXMetricsTracker { event in
            Task {
                await metricsRecorder.record(event)
            }
        }
        let panelController = CapturePanelController(model: model)
        let hotKeyMonitor = GlobalHotKeyMonitor {
            Task { @MainActor in
                if model.phase == .hidden {
                    metricsTracker.beginPrompt(trigger: .hotkey)
                }
                model.toggle()
            }
        }

        self.model = model
        self.metricsRecorder = metricsRecorder
        self.metricsTracker = metricsTracker
        self.panelController = panelController
        self.hotKeyMonitor = hotKeyMonitor

        self.model.onSubmissionEvent = { [weak self] event in
            self?.handleSubmissionEvent(event)
        }
        self.model.onTextChanged = { [weak self] previous, current in
            self?.metricsTracker.noteTextChange(from: previous, to: current)
        }
        self.model.onSubmitInitiated = { [weak self] in
            self?.metricsTracker.markSubmitInitiated()
        }
        self.panelController.onPanelDidShow = { [weak self] in
            self?.metricsTracker.markVisible()
        }
        self.panelController.onPanelDidHide = { [weak self] in
            self?.metricsTracker.markHidden()
        }
        self.hotKeyMonitor.start()
        self.updatePollingTask = startUpdatePolling()
    }

    func togglePanel(trigger: PromptUXTriggerSource = .menu) {
        if model.phase == .hidden {
            metricsTracker.beginPrompt(trigger: trigger)
        }
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
        case .succeeded(let result):
            statusResetTask?.cancel()
            lastFailedText = nil
            captureMenuState = .saved
            metricsTracker.markCaptureSucceeded(backupState: backupStateName(result.backupState))
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
            metricsTracker.markCaptureFailed()
        }
    }

    private func backupStateName(_ backupState: BackupState) -> String {
        switch backupState {
        case .skipped:
            return "skipped"
        case .backedUp:
            return "backed_up"
        case .pending:
            return "pending"
        }
    }
}

private struct UnavailableCaptureClient: ThinkCapturing {
    let message: String

    func capture(text: String) async throws -> CaptureResult {
        throw CaptureFailure(message: message)
    }
}
