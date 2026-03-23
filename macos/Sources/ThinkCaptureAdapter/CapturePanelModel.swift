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
    case error(message: String)
}

public final class CapturePanelModel: ObservableObject {
    @Published public private(set) var phase: CapturePanelPhase = .hidden
    @Published public private(set) var text: String = ""
    @Published public private(set) var isTextFieldFocused = false
    @Published public private(set) var isSubmitting = false
    public let configuration: CapturePanelConfiguration

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
        case .ready, .error:
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
        guard canSubmit else { return nil }

        isSubmitting = true
        isTextFieldFocused = false

        do {
            let result = try await client.capture(text: text)
            resetAndHide()
            return result
        } catch {
            isSubmitting = false
            phase = .error(message: "Could not save thought")
            isTextFieldFocused = false
            return nil
        }
    }
}
