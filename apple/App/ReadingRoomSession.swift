import SwiftUI
import WebKit

struct RoomNotice: Identifiable {
    let id = UUID()
    let message: String
    var confirmation = false
}

// UIKit and recent WebKit SDKs isolate their view APIs to the main actor.
// The macOS 13 SDK imports the delegate requirements as nonisolated.
#if os(iOS) || compiler(>=6.0)
@MainActor
#endif
final class ReadingRoomSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let website = URL(string: "https://readai-4f87b.web.app/")!
    let webView: WKWebView
    private let resource: URL?
    @Published private(set) var loading = true
    @Published private(set) var failed = false
    @Published private(set) var locking = false
    @Published var notice: RoomNotice?
    var openExternal: (() -> Void)?
    private var confirmation: ((Bool) -> Void)?
    private var lockGeneration = 0

    override init() {
        resource = Bundle.main.url(forResource: "reading-room", withExtension: "html")
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        let markShell = "document.documentElement.dataset.bookserShell = 'apple';"
        config.userContentController.addUserScript(WKUserScript(source: markShell,
            injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        load()
    }

    func load() {
        guard let resource else { failed = true; loading = false; return }
        answer(false)
        failed = false
        loading = true
        webView.loadFileURL(resource, allowingReadAccessTo: resource)
    }

    private func trusted(_ url: URL?) -> Bool {
        guard let url, url.isFileURL, let resource else { return false }
        return url.standardizedFileURL.path == resource.standardizedFileURL.path
    }

    func returnToReading() {
        guard !loading, !failed, trusted(webView.url) else { return }
        let dismiss = "if (document.getElementById('parent-dialog')?.open) document.getElementById('close-parent')?.click();"
        webView.evaluateJavaScript(dismiss, completionHandler: nil)
    }

    func openParent() {
        guard !loading, !failed, trusted(webView.url) else { return }
        // Trigger the same guarded action as the reading room. The native
        // layer never receives the family, a PIN, a grant, or private reports.
        let show = """
        (() => { const b = document.getElementById('parent');
          if (!b || b.disabled) return false; b.click(); return true; })()
        """
        webView.evaluateJavaScript(show) { [weak self] value, error in
            if error == nil, value as? Bool == false {
                self?.notice = RoomNotice(message: String(localized: "Complete demo consent in the reading room to open the parent area."))
            }
        }
    }

    func lockForPrivacy() {
        answer(false)
        guard !loading, trusted(webView.url) else { return }
        locking = true
        lockGeneration += 1
        let generation = lockGeneration
        let closePrivateArea = """
        window.speechSynthesis?.cancel();
        if (document.getElementById('parent-dialog')?.open) {
          document.getElementById('close-parent')?.click();
        }
        document.querySelectorAll('input[type=password]').forEach(field => field.value = '');
        """
        webView.evaluateJavaScript(closePrivateArea) { [weak self] _, error in
            guard let self, generation == self.lockGeneration else { return }
            if error != nil { self.load() }
            self.locking = false
        }
    }

    func answer(_ confirmed: Bool) {
        let callback = confirmation
        confirmation = nil
        notice = nil
        callback?(confirmed)
    }

    private func offerWebsite(for action: WKNavigationAction) {
        guard action.navigationType == .linkActivated, action.sourceFrame.isMainFrame,
              trusted(action.sourceFrame.request.url), let url = action.request.url,
              url.scheme?.lowercased() == "https", url.host?.lowercased() == Self.website.host,
              url.port == nil, url.user == nil, url.password == nil else { return }
        openExternal?()
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.targetFrame?.isMainFrame == true, trusted(action.request.url) {
            decisionHandler(.allow)
        } else {
            offerWebsite(for: action)
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        offerWebsite(for: action)
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard frame.isMainFrame, trusted(frame.request.url), !locking, confirmation == nil else {
            completionHandler(false); return
        }
        confirmation = completionHandler
        notice = RoomNotice(message: message, confirmation: true)
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.deny)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failed = true; loading = false }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { failed = true; loading = false }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        answer(false)
        failed = true
        loading = false
        locking = false
    }
}

#if os(macOS)
struct ReadingWebView: NSViewRepresentable {
    let webView: WKWebView
    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
struct ReadingWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif
