# Methods exposed to the WebView via addJavascriptInterface must keep their names.
-keepclassmembers class com.catchow.catboard.BlobDownloader {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
