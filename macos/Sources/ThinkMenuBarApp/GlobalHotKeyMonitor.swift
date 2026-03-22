import AppKit
import Carbon.HIToolbox

final class GlobalHotKeyMonitor {
    private let handler: () -> Void
    private let hotKeyID = EventHotKeyID(signature: OSType(0x74686E6B), id: 1)
    private let hotKeyCode = UInt32(kVK_ANSI_I)
    private let hotKeyModifiers: NSEvent.ModifierFlags = [.command, .shift]
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandlerRef: EventHandlerRef?

    init(handler: @escaping () -> Void) {
        self.handler = handler
    }

    func start() {
        guard hotKeyRef == nil else { return }

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )

        let callback: EventHandlerUPP = { _, event, userData in
            guard
                let event,
                let userData
            else {
                return noErr
            }

            let monitor = Unmanaged<GlobalHotKeyMonitor>.fromOpaque(userData).takeUnretainedValue()
            var pressedHotKeyID = EventHotKeyID()
            let status = GetEventParameter(
                event,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &pressedHotKeyID
            )

            guard status == noErr else {
                return status
            }

            if pressedHotKeyID.signature == monitor.hotKeyID.signature && pressedHotKeyID.id == monitor.hotKeyID.id {
                monitor.handler()
            }

            return noErr
        }

        let userData = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())

        InstallEventHandler(
            GetApplicationEventTarget(),
            callback,
            1,
            &eventType,
            userData,
            &eventHandlerRef
        )

        RegisterEventHotKey(
            hotKeyCode,
            carbonModifiers(from: hotKeyModifiers),
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    deinit {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
        }

        if let eventHandlerRef {
            RemoveEventHandler(eventHandlerRef)
        }
    }

    private func carbonModifiers(from flags: NSEvent.ModifierFlags) -> UInt32 {
        var result: UInt32 = 0

        if flags.contains(.command) {
            result |= UInt32(cmdKey)
        }

        if flags.contains(.option) {
            result |= UInt32(optionKey)
        }

        if flags.contains(.control) {
            result |= UInt32(controlKey)
        }

        if flags.contains(.shift) {
            result |= UInt32(shiftKey)
        }

        return result
    }
}
