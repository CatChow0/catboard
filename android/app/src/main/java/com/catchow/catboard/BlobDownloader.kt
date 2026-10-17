package com.catchow.catboard

import android.util.Base64
import android.webkit.JavascriptInterface

/**
 * JS bridge for downloads the WebView cannot handle itself: `blob:`/`data:` links with a
 * `download` attribute (e.g. the dashboard config export). [DOWNLOAD_HOOK_JS] captures the
 * blob in the page and hands it over as a data URL; [onFile] then asks the user where to save it.
 */
class BlobDownloader(
    private val onFile: (name: String, mime: String, bytes: ByteArray) -> Unit,
    private val onError: () -> Unit,
) {
    @JavascriptInterface
    fun save(dataUrl: String, name: String?, mime: String?) {
        val bytes = runCatching {
            Base64.decode(dataUrl.substringAfter(','), Base64.DEFAULT)
        }.getOrElse { return onError() }
        val fileName = name?.takeIf { it.isNotBlank() }?.replace(Regex("[\\\\/:*?\"<>|]"), "_") ?: "download"
        onFile(fileName, mime?.takeIf { it.isNotBlank() } ?: "application/octet-stream", bytes)
    }

    @JavascriptInterface
    fun fail(@Suppress("UNUSED_PARAMETER") message: String?) = onError()

    companion object {
        const val JS_NAME = "CatBoardDownloader"

        /**
         * Injected into every page. Remembers non-image Blobs passed to URL.createObjectURL
         * (the page revokes the URL right after clicking, so fetching it later would fail),
         * then intercepts programmatic and real clicks on `a[download]` blob/data links.
         */
        val DOWNLOAD_HOOK_JS = """
            (function () {
              if (window.__catboardDownloadHook || !window.$JS_NAME) return;
              window.__catboardDownloadHook = true;
              var blobs = new Map();
              var origCreate = URL.createObjectURL;
              URL.createObjectURL = function (obj) {
                var url = origCreate.apply(URL, arguments);
                if (obj instanceof Blob && !(obj.type || '').startsWith('image/')) {
                  blobs.set(url, obj);
                  if (blobs.size > 20) blobs.delete(blobs.keys().next().value);
                }
                return url;
              };
              function send(blob, name) {
                var reader = new FileReader();
                reader.onloadend = function () {
                  $JS_NAME.save(String(reader.result), name || 'download', blob.type || '');
                };
                reader.onerror = function () { $JS_NAME.fail('read error'); };
                reader.readAsDataURL(blob);
              }
              function handle(a) {
                var href = a.href || '';
                if (!a.hasAttribute('download')) return false;
                if (href.startsWith('blob:')) {
                  var blob = blobs.get(href);
                  if (blob) { send(blob, a.download); return true; }
                  fetch(href).then(function (r) { return r.blob(); })
                    .then(function (b) { send(b, a.download); })
                    .catch(function (e) { $JS_NAME.fail(String(e)); });
                  return true;
                }
                if (href.startsWith('data:')) {
                  fetch(href).then(function (r) { return r.blob(); })
                    .then(function (b) { send(b, a.download); })
                    .catch(function (e) { $JS_NAME.fail(String(e)); });
                  return true;
                }
                return false;
              }
              var origClick = HTMLAnchorElement.prototype.click;
              HTMLAnchorElement.prototype.click = function () {
                if (handle(this)) return;
                return origClick.apply(this, arguments);
              };
              document.addEventListener('click', function (e) {
                var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
                if (a && handle(a)) e.preventDefault();
              }, true);
            })();
        """.trimIndent()
    }
}
