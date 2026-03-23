import Combine
import Foundation

public struct CapturePanelConfiguration: Equatable {
    public let placeholder: String?

    public init(placeholder: String? = "Type to capture a thought...") {
        self.placeholder = placeholder
    }
}

public enum CapturePanelPhase: Equatable {
    case hidden
    case ready
}

public enum CaptureSubmissionEvent: Equatable {
    case started(text: String)
    case succeeded(result: CaptureResult)
    case failed(retryText: String, message: String)
}

public final class CapturePanelModel: ObservableObject {
    @Published public private(set) var phase: CapturePanelPhase = .hidden
    @Published public private(set) var text: String = ""
    @Published public private(set) var isTextFieldFocused = false
    @Published public private(set) var isSubmitting = false
    public let configuration: CapturePanelConfiguration
    public var onSubmissionEvent: ((CaptureSubmissionEvent) -> Void)?

    private let client: ThinkCapturing

    public init(
        client: ThinkCapturing,
        configuration: CapturePanelConfiguration = CapturePanelConfiguration()
    ) {
        self.client = client
        self.configuration = configuration
    }

    public func toggle() {
        guard !isSubmitting else { return }

        switch phase {
        case .hidden:
            phase = .ready
            isTextFieldFocused = true
        case .ready:
            cancel()
        }
    }

    public func updateText(_ newText: String) {
        text = newText
    }

    public func retry() {
        isSubmitting = false
        phase = .ready
        isTextFieldFocused = true
    }

    public func cancel() {
        guard !isSubmitting else { return }
        resetAndHide()
    }

    public var canSubmit: Bool {
        !normalizedText.isEmpty && !isSubmitting && phase == .ready
    }

    private var normalizedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func resetAndHide() {
        phase = .hidden
        text = ""
        isTextFieldFocused = false
        isSubmitting = false
    }

    @MainActor
    @discardableResult
    public func submit() async -> CaptureResult? {
        await submit(text: text)
    }

    @MainActor
    @discardableResult
    public func submit(text submittedText: String) async -> CaptureResult? {
        let normalizedText = submittedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedText.isEmpty, !isSubmitting else { return nil }

        let rawText = submittedText
        isSubmitting = true
        resetAndHide()
        isSubmitting = true
        onSubmissionEvent?(.started(text: rawText))

        do {
            let result = try await client.capture(text: rawText)
            isSubmitting = false
            onSubmissionEvent?(.succeeded(result: result))
            return result
        } catch {
            isSubmitting = false
            onSubmissionEvent?(.failed(retryText: rawText, message: "Could not save thought"))
            return nil
        }
    }
}
