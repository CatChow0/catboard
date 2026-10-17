package com.catchow.catboard

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.os.Message
import android.view.View
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/** Hosts the CatBoard web UI of the configured server in a full-screen WebView. */
class MainActivity : AppCompatActivity() {

    companion object {
        const val ACTION_CHANGE_SERVER = "com.catchow.catboard.CHANGE_SERVER"
        const val ACTION_SERVER_CHANGED = "com.catchow.catboard.SERVER_CHANGED"

        /** Sends Escape to the topmost open dialog; evaluates to true when there was one. */
        private val CLOSE_TOP_DIALOG_JS = """
            (function () {
              var open = document.querySelectorAll('.bs-overlay, .cm-root, [aria-modal="true"], .modal-overlay, .popup-overlay, .edit-modal, .navbar-popover');
              if (!open.length) return false;
              var top = open[open.length - 1];
              // 1. The dialog's own close button, 2. a click on a settings panel's backdrop (a sibling), 3. Escape.
              var close = top.querySelector('.btn-close, [aria-label="Close"], button[title="Close"]');
              var prev = top.previousElementSibling;
              if (close) close.click();
              else if (top.classList.contains('edit-modal') && prev && prev.classList.contains('edit-overlay')) prev.click();
              else top.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
              return true;
            })();
        """.trimIndent()
    }

    private lateinit var webView: WebView
    private lateinit var pageProgress: ProgressBar
    private lateinit var errorOverlay: LinearLayout
    private lateinit var errorMessage: TextView

    private var serverUrl: String = ""
    private var serverOrigin: String? = null
    private var mainFrameFailed = false

    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingDownload: ByteArray? = null

    private val fileChooser = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        val uris = if (result.resultCode != RESULT_OK || data == null) null else {
            val clip = data.clipData
            if (clip != null) Array(clip.itemCount) { clip.getItemAt(it).uri }
            else data.data?.let { arrayOf(it) }
        }
        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

    private val saveDocument = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val bytes = pendingDownload
        pendingDownload = null
        val uri = result.data?.data
        if (result.resultCode != RESULT_OK || uri == null || bytes == null) return@registerForActivityResult
        val ok = runCatching {
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("no stream")
        }.isSuccess
        if (ok) toast(getString(R.string.download_saved, uri.lastPathSegment?.substringAfterLast('/') ?: ""))
        else toast(getString(R.string.download_failed))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)

        val saved = ServerPrefs.get(this)
        if (saved == null || intent?.action == ACTION_CHANGE_SERVER) {
            openSetup()
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        applySystemBarInsets(findViewById(R.id.root))
        webView = findViewById(R.id.webView)
        pageProgress = findViewById(R.id.pageProgress)
        errorOverlay = findViewById(R.id.errorOverlay)
        errorMessage = findViewById(R.id.errorMessage)

        findViewById<Button>(R.id.retryButton).setOnClickListener { retry() }
        findViewById<Button>(R.id.changeServerButton).setOnClickListener { openSetup() }

        setupWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (errorOverlay.visibility == View.VISIBLE) return leave()
                // An open sheet, dialog or menu closes first (CatBoard closes them on Escape).
                webView.evaluateJavascript(CLOSE_TOP_DIALOG_JS) { handled ->
                    if (handled == "true") return@evaluateJavascript
                    if (webView.canGoBack()) webView.goBack() else leave()
                }
            }

            private fun leave() {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
                isEnabled = true
            }
        })

        loadServer(saved, savedInstanceState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        when (intent.action) {
            ACTION_CHANGE_SERVER -> openSetup()
            ACTION_SERVER_CHANGED -> ServerPrefs.get(this)?.let { loadServer(it, null) }
        }
    }

    override fun onPause() {
        super.onPause()
        // Persist the session cookie so the login survives the app being killed.
        CookieManager.getInstance().flush()
        if (::webView.isInitialized) webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun loadServer(url: String, savedInstanceState: Bundle?) {
        serverUrl = url
        serverOrigin = ServerPrefs.origin(url)
        hideError()
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(url)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        CookieManager.getInstance().setAcceptCookie(true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // localStorage + IndexedDB (icon cache)
            @Suppress("DEPRECATION")
            databaseEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            setSupportMultipleWindows(true) // routes target=_blank through onCreateWindow
            javaScriptCanOpenWindowsAutomatically = true
            userAgentString = "$userAgentString CatBoardAndroid/${BuildConfig.VERSION_NAME}"
        }

        webView.addJavascriptInterface(
            BlobDownloader(
                onFile = { name, mime, bytes -> runOnUiThread { askWhereToSave(name, mime, bytes) } },
                onError = { runOnUiThread { toast(getString(R.string.download_failed)) } },
            ),
            BlobDownloader.JS_NAME,
        )
        val documentStartHook = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (documentStartHook) {
            WebViewCompat.addDocumentStartJavaScript(webView, BlobDownloader.DOWNLOAD_HOOK_JS, setOf("*"))
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme !in setOf("http", "https")) {
                    openExternal(url)
                    return true
                }
                // Links the user taps that leave the server (service tiles) open in the browser.
                // Redirects and script navigations (e.g. an SSO login page in front of CatBoard) stay in the app.
                val leavesServer = ServerPrefs.origin(url.toString()) != serverOrigin
                val onServerPage = view.url?.let { ServerPrefs.origin(it) } == serverOrigin
                if (leavesServer && onServerPage && request.hasGesture() && !request.isRedirect) {
                    openExternal(url)
                    return true
                }
                return false
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                mainFrameFailed = false
                pageProgress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageProgress.visibility = View.GONE
                if (!documentStartHook) view.evaluateJavascript(BlobDownloader.DOWNLOAD_HOOK_JS, null)
                if (!mainFrameFailed) hideError()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showError(error.description?.toString() ?: "")
            }

            @SuppressLint("WebViewClientOnReceivedSslError")
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                showError("TLS certificate error (${sslReason(error)}). Install your CA certificate on the device or use a trusted certificate.")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                pageProgress.progress = newProgress
            }

            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback
                return try {
                    fileChooser.launch(fileChooserIntent(params))
                    true
                } catch (e: ActivityNotFoundException) {
                    fileChooserCallback = null
                    false
                }
            }

            // target=_blank / window.open: grab the URL with a throwaway WebView and open it in the browser.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        openExternal(request.url)
                        v.destroy()
                        return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }
        }

        // Regular http(s) downloads go to the browser, which already handles them well.
        webView.setDownloadListener { url, _, _, _, _ ->
            if (!url.startsWith("blob:") && !url.startsWith("data:")) openExternal(Uri.parse(url))
        }
    }

    /**
     * <input accept> may list extensions (".json", ".ico") that Android can't match as MIME
     * types, so map them to MIME types and fall back to any file.
     */
    private fun fileChooserIntent(params: WebChromeClient.FileChooserParams): Intent {
        val mimes = params.acceptTypes
            .flatMap { it.split(',') }
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() }
            .mapNotNull { type ->
                if (type.startsWith('.')) MimeTypeMap.getSingleton().getMimeTypeFromExtension(type.drop(1))
                else type.takeIf { it.contains('/') }
            }
            .distinct()
        return Intent(Intent.ACTION_GET_CONTENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mimes.singleOrNull() ?: "*/*")
            .apply {
                if (mimes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
                if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
            }
    }

    private fun askWhereToSave(name: String, mime: String, bytes: ByteArray) {
        pendingDownload = bytes
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime)
            .putExtra(Intent.EXTRA_TITLE, name)
        try {
            saveDocument.launch(intent)
        } catch (e: ActivityNotFoundException) {
            pendingDownload = null
            toast(getString(R.string.download_failed))
        }
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (e: ActivityNotFoundException) {
            toast(getString(R.string.no_app_for_link))
        }
    }

    private fun openSetup() {
        startActivity(Intent(this, SetupActivity::class.java))
    }

    private fun retry() {
        hideError()
        if (webView.url.isNullOrBlank() || webView.url == "about:blank") webView.loadUrl(serverUrl) else webView.reload()
    }

    private fun showError(message: String) {
        mainFrameFailed = true
        errorMessage.text = "$serverUrl\n$message"
        errorOverlay.visibility = View.VISIBLE
        pageProgress.visibility = View.GONE
    }

    private fun hideError() {
        errorOverlay.visibility = View.GONE
    }

    private fun sslReason(error: SslError): String = when (error.primaryError) {
        SslError.SSL_UNTRUSTED -> "untrusted / self-signed"
        SslError.SSL_EXPIRED -> "expired"
        SslError.SSL_IDMISMATCH -> "hostname mismatch"
        SslError.SSL_NOTYETVALID -> "not yet valid"
        SslError.SSL_DATE_INVALID -> "invalid date"
        else -> "invalid"
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
}
