import SwiftUI
import ThinkCaptureAdapter

struct CapturePanelView: View {
    @ObservedObject var model: CapturePanelModel
    @FocusState private var textFieldFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 16) {
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.14))

                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                }
                .frame(width: 48, height: 48)

                TextField(model.configuration.placeholder ?? "", text: bindingForText())
                    .textFieldStyle(.plain)
                    .font(.system(size: 24, weight: .medium))
                    .submitLabel(.done)
                    .defaultFocus($textFieldFocused, true)
                    .focused($textFieldFocused)
                    .onSubmit {
                        submit()
                    }

                Button(action: submit) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30, weight: .semibold))
                    .frame(width: 34, height: 34)
                    .foregroundStyle(model.canSubmit ? Color.accentColor : Color.secondary.opacity(0.6))
                }
                .buttonStyle(.plain)
                .disabled(!model.canSubmit)
            }

            HStack {
                Text("Press Return or click send. Esc cancels.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(.white.opacity(0.18), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.18), radius: 24, y: 10)
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

    private func submit() {
        Task { @MainActor in
            _ = await model.submit()
        }
    }

    private func applyFocusState(_ focused: Bool) {
        guard focused else {
            textFieldFocused = false
            return
        }

        DispatchQueue.main.async {
            textFieldFocused = true
        }
    }
}
