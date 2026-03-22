import Combine
import Foundation

public struct CapturePanelConfiguration: Equatable {
    public let placeholder: String?

    public init(placeholder: String? = nil) {
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
        phase = .ready
        isTextFieldFocused = true
    }

    public func cancel() {
        phase = .hidden
        text = ""
        isTextFieldFocused = false
    }

    @MainActor
    @discardableResult
    public func submit() async -> CaptureResult? {
        do {
            let result = try await client.capture(text: text)
            cancel()
            return result
        } catch {
            phase = .error(message: "Could not save thought")
            isTextFieldFocused = false
            return nil
        }
    }
}
