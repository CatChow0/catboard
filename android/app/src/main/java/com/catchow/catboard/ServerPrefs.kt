package com.catchow.catboard

import android.content.Context
import android.net.Uri

/** Persists the CatBoard server address chosen on the setup screen. */
object ServerPrefs {
    private const val FILE = "catboard"
    private const val KEY_URL = "server_url"

    fun get(context: Context): String? =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_URL, null)

    fun set(context: Context, url: String) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY_URL, url).apply()
    }

    /**
     * Turns user input into a base URL: adds `http://` when no scheme is given and strips
     * trailing slashes. Returns null when the result is not a usable http(s) URL.
     */
    fun normalize(input: String): String? {
        var s = input.trim()
        if (s.isEmpty()) return null
        if (!s.contains("://")) s = "http://$s"
        s = s.trimEnd('/')
        val uri = Uri.parse(s)
        if (uri.scheme !in setOf("http", "https") || uri.host.isNullOrBlank()) return null
        return s
    }

    /** scheme://host:port of a URL, used to decide what stays inside the app. */
    fun origin(url: String): String? {
        val uri = Uri.parse(url)
        val scheme = uri.scheme?.lowercase() ?: return null
        val host = uri.host?.lowercase() ?: return null
        val port = if (uri.port != -1) uri.port else if (scheme == "https") 443 else 80
        return "$scheme://$host:$port"
    }
}
