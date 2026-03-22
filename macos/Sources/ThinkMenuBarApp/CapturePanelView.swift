import SwiftUI
import ThinkCaptureAdapter

struct CapturePanelView: View {
    @ObservedObject var model: CapturePanelModel
    @FocusState private var textFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("", text: bindingForText())
                .textFieldStyle(.plain)
                .font(.system(size: 22))
                .focused($textFieldFocused)
                .onSubmit {
                    Task { @MainActor in
                        _ = await model.submit()
                    }
                }

            if case .error(let message) = model.phase {
                HStack(spacing: 12) {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.red)

                    Spacer()

                    Button("Retry") {
                        model.retry()
                    }

                    Button("Cancel") {
                        model.cancel()
                    }
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(12)
        .onAppear {
            applyFocusState(model.isTextFieldFocused)
        }
        .onChange(of: model.isTextFieldFocused) { _, focused in
            applyFocusState(focused)
        }
        .onExitCommand {
            model.cancel()
        }
    }

    private func bindingForText() -> Binding<String> {
        Binding(
            get: { model.text },
            set: { model.updateText($0) }
        )
    }

    private func applyFocusState(_ focused: Bool) {
        textFieldFocused = focused
    }
}
