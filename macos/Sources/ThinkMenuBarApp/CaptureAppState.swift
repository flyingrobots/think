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
    @Published private(set) var canRetryFailedCapture = false

    private let client: ThinkCapturing
    private let urlCaptureHandler: ThinkCaptureURLHandler
    private let sharedTextCaptureHandler: ThinkCaptureSharedTextHandler
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
    private var openURLTask: Task<Void, Never>?
    private var sharedTextTask: Task<Void, Never>?

    init(
        client: ThinkCapturing? = nil,
        notificationCenter: NotificationCenter = .default
    ) {
        let client = client ?? CaptureAppState.makeClient()
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
                    Task {
                        await metricsRecorder.suspendFlushes()
                    }
                    metricsTracker.beginPrompt(trigger: .hotkey)
                }
                model.toggle()
            }
        }

        self.model = model
        self.client = client
        self.urlCaptureHandler = ThinkCaptureURLHandler(client: client)
        self.sharedTextCaptureHandler = ThinkCaptureSharedTextHandler(client: client)
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
            guard let self else { return }
            self.metricsTracker.markHidden()
            if !self.model.isSubmitting {
                Task {
                    await self.metricsRecorder.resumeFlushes()
                }
            }
        }
        self.hotKeyMonitor.start()
        self.updatePollingTask = startUpdatePolling()
        self.openURLTask = Task { [weak self] in
            for await notification in notificationCenter.notifications(named: .thinkCaptureOpenURL) {
                guard
                    let url = notification.userInfo?[ThinkCaptureOpenURLUserInfoKey.url] as? URL
                else {
                    continue
                }

                self?.handleCaptureURL(url)
            }
        }
        self.sharedTextTask = Task { [weak self] in
            for await notification in notificationCenter.notifications(named: .thinkCaptureSharedText) {
                guard
                    let request = notification.userInfo?[ThinkCaptureSharedTextUserInfoKey.request] as? ThinkCaptureSharedTextRequest
                else {
                    continue
                }

                self?.handleSharedTextRequest(request)
            }
        }
    }

    func togglePanel(trigger: PromptUXTriggerSource = .menu) {
        if model.phase == .hidden {
            Task {
                await metricsRecorder.suspendFlushes()
            }
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
        openURLTask?.cancel()
        sharedTextTask?.cancel()
    }

    func handleCaptureURL(_ url: URL) {
        performExternalCapture {
            try await self.urlCaptureHandler.handle(url: url)
        }
    }

    func handleSharedTextRequest(_ request: ThinkCaptureSharedTextRequest) {
        performExternalCapture {
            try await self.sharedTextCaptureHandler.handle(request: request)
        }
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
            canRetryFailedCapture = false
            captureMenuState = .saving
        case .succeeded(let result):
            statusResetTask?.cancel()
            lastFailedText = nil
            canRetryFailedCapture = false
            captureMenuState = .saved
            metricsTracker.markCaptureSucceeded(backupState: backupStateName(result.backupState))
            Task {
                await metricsRecorder.resumeFlushes()
            }
            scheduleStatusReset()
        case .failed(let retryText, _):
            statusResetTask?.cancel()
            lastFailedText = retryText
            canRetryFailedCapture = true
            captureMenuState = .failed
            metricsTracker.markCaptureFailed()
            Task {
                await metricsRecorder.resumeFlushes()
            }
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

    private func scheduleStatusReset() {
        statusResetTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            await MainActor.run {
                self?.captureMenuState = .idle
            }
        }
    }

    private func performExternalCapture(
        _ operation: @escaping @Sendable () async throws -> CaptureResult
    ) {
        statusResetTask?.cancel()
        canRetryFailedCapture = false
        captureMenuState = .saving
        lastFailedText = nil

        Task { @MainActor in
            do {
                let result = try await operation()
                captureMenuState = .saved
                scheduleStatusReset()
                _ = result
            } catch {
                captureMenuState = .failed
            }
        }
    }
}

private struct UnavailableCaptureClient: ThinkCapturing {
    let message: String

    func capture(text: String) async throws -> CaptureResult {
        throw CaptureFailure(message: message)
    }
}
