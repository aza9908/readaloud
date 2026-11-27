import SwiftUI

@main
struct BookserApp: App {
    var body: some Scene {
        WindowGroup("Bookser") {
            ReadingWindow()
        }
        #if os(macOS)
        .defaultSize(width: 1100, height: 790)
        #endif
    }
}

private let enamel = Color(red: 32 / 255, green: 76 / 255, blue: 80 / 255)
private let ivory = Color(red: 245 / 255, green: 245 / 255, blue: 239 / 255)
private let ink = Color(red: 19 / 255, green: 30 / 255, blue: 41 / 255)

@MainActor
struct ReadingWindow: View {
    @Environment(\.scenePhase) private var phase
    @Environment(\.openURL) private var openURL
    @Environment(\.colorScheme) private var scheme
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif
    @StateObject private var room = ReadingRoomSession()

    private var accent: Color {
        scheme == .dark ? Color(red: 170 / 255, green: 217 / 255, blue: 226 / 255) : enamel
    }

    private var isCompact: Bool {
        #if os(iOS)
        return sizeClass == .compact
        #else
        return false
        #endif
    }

    var body: some View {
        ZStack {
            Group {
                if isCompact {
                    NavigationStack {
                        reading
                            .toolbar {
                                ToolbarItem(placement: .primaryAction) {
                                    Menu {
                                        parentButton
                                        browserButton
                                    } label: {
                                        Label("Reading options", systemImage: "ellipsis.circle")
                                    }
                                }
                            }
                    }
                } else {
                    NavigationSplitView {
                        List {
                            Button(action: { room.returnToReading() }) {
                                Label("Reading room", systemImage: "books.vertical")
                            }
                            .foregroundColor(accent)
                            parentButton
                            browserButton
                        }
                        .listStyle(.sidebar)
                        .navigationTitle("Bookser")
                        .navigationSplitViewColumnWidth(min: 195, ideal: 215, max: 260)
                    } detail: {
                        reading
                    }
                    .navigationSplitViewStyle(.balanced)
                }
            }
            .accessibilityHidden(phase != .active || room.locking)
            .allowsHitTesting(phase == .active && !room.locking)

            if phase != .active || room.locking {
                ZStack {
                    (scheme == .dark ? ink : ivory).ignoresSafeArea()
                    Label("Bookser", systemImage: "book.fill")
                        .font(.title2.weight(.semibold))
                        .foregroundColor(accent)
                }
            }
        }
        .symbolRenderingMode(.hierarchical)
        .tint(accent)
        .onAppear { room.openExternal = { openURL(ReadingRoomSession.website) } }
        .onChange(of: phase) { next in
            if next != .active { room.lockForPrivacy() }
        }
        .alert(item: $room.notice) { notice in
            if notice.confirmation {
                return Alert(title: Text("Bookser"), message: Text(notice.message),
                             primaryButton: .destructive(Text("Delete")) { room.answer(true) },
                             secondaryButton: .cancel { room.answer(false) })
            }
            return Alert(title: Text("Bookser"), message: Text(notice.message),
                         dismissButton: .default(Text("OK")))
        }
        #if os(macOS)
        .frame(minWidth: 680, minHeight: 480)
        #endif
    }

    private var parentButton: some View {
        Button(action: { room.openParent() }) { Label("For parents", systemImage: "lock.shield") }
    }

    private var browserButton: some View {
        Button { openURL(ReadingRoomSession.website) } label: {
            Label("Open Bookser online", systemImage: "safari")
        }
    }

    private var reading: some View {
        ZStack {
            (scheme == .dark ? ink : ivory).ignoresSafeArea()
            if room.failed {
                VStack(spacing: 12) {
                    Image(systemName: "book.closed").font(.title)
                    Text("The reading room could not open.")
                    Button(action: { room.load() }) {
                        Label("Try again", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                .padding()
            } else {
                ReadingWebView(webView: room.webView)
                if room.loading { ProgressView("Opening reading room…") }
            }
        }
        .navigationTitle("Reading room")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}
