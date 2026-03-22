import AppKit
import Combine
import SwiftUI
import ThinkCaptureAdapter

@MainActor
final class CapturePanelController {
    private let model: CapturePanelModel
    private let panel: CapturePanelWindow
    private var cancellables: Set<AnyCancellable> = []
    private var previousApplication: NSRunningApplication?

    init(model: CapturePanelModel) {
        self.model = model
        self.panel = CapturePanelWindow()

        let rootView = CapturePanelView(model: model)
        let hostingController = NSHostingController(rootView: rootView)
        panel.contentViewController = hostingController

        configurePanel()
        bindModel()
    }

    private func configurePanel() {
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .moveToActiveSpace, .transient]
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = false
        panel.isReleasedWhenClosed = false

        for buttonType in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] {
            panel.standardWindowButton(buttonType)?.isHidden = true
        }
    }

    private func bindModel() {
        model.$phase
            .sink { [weak self] phase in
                guard let self else { return }
                switch phase {
                case .hidden:
                    self.hidePanel()
                case .ready, .error:
                    self.showPanelIfNeeded()
                }
            }
            .store(in: &cancellables)
    }

    private func showPanelIfNeeded() {
        guard !panel.isVisible else {
            panel.makeKeyAndOrderFront(nil)
            return
        }

        previousApplication = NSWorkspace.shared.frontmostApplication
        updateFrameForActiveScreen()
        NSApp.activate(ignoringOtherApps: true)
        panel.centerTextFieldOnOpen = true
        panel.makeKeyAndOrderFront(nil)
        panel.orderFrontRegardless()
    }

    private func hidePanel() {
        guard panel.isVisible else { return }

        panel.orderOut(nil)

        if let previousApplication, previousApplication != NSRunningApplication.current {
            previousApplication.activate()
        }

        previousApplication = nil
    }

    private func updateFrameForActiveScreen() {
        let mouseLocation = NSEvent.mouseLocation
        let screen = NSScreen.screens.first(where: { NSMouseInRect(mouseLocation, $0.frame, false) }) ?? NSScreen.main
        let visibleFrame = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)

        let width = min(720, visibleFrame.width - 80)
        let height: CGFloat = 150
        let x = visibleFrame.midX - (width / 2)
        let y = visibleFrame.maxY - height - 120

        panel.setFrame(NSRect(x: x, y: y, width: width, height: height), display: false)
    }
}

private final class CapturePanelWindow: NSPanel {
    var centerTextFieldOnOpen = false

    init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 150),
            styleMask: [.titled, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
