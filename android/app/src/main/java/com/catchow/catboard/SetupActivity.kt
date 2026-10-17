package com.catchow.catboard

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** First-launch screen: asks for the server address and checks that it is a CatBoard instance. */
class SetupActivity : AppCompatActivity() {

    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var urlInput: EditText
    private lateinit var errorText: TextView
    private lateinit var connectButton: Button
    private lateinit var progress: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)
        applySystemBarInsets(findViewById(R.id.root))

        urlInput = findViewById(R.id.urlInput)
        errorText = findViewById(R.id.errorText)
        connectButton = findViewById(R.id.connectButton)
        progress = findViewById(R.id.progress)

        ServerPrefs.get(this)?.let { urlInput.setText(it) }

        connectButton.setOnClickListener { connect() }
        urlInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                connect(); true
            } else false
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun connect() {
        val raw = urlInput.text.toString()
        if (raw.isBlank()) return showError(getString(R.string.setup_error_empty))
        val url = ServerPrefs.normalize(raw) ?: return showError(getString(R.string.setup_error_invalid))

        setBusy(true)
        executor.execute {
            val error = probe(url)
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                setBusy(false)
                if (error != null) {
                    showError(error)
                } else {
                    ServerPrefs.set(this, url)
                    startActivity(
                        Intent(this, MainActivity::class.java)
                            .setAction(MainActivity.ACTION_SERVER_CHANGED)
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    )
                    finish()
                }
            }
        }
    }

    /** Returns null when [url] answers like CatBoard on the public /api/auth/check route, else an error message. */
    private fun probe(url: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL("$url/api/auth/check").openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
                instanceFollowRedirects = true
                setRequestProperty("Accept", "application/json")
            }
            val code = conn.responseCode
            val body = (if (code < 400) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(body) }.getOrNull()
            if (json != null && (json.has("authenticated") || json.has("needsSetup"))) null
            else getString(R.string.setup_error_not_catboard, code)
        } catch (e: Exception) {
            getString(R.string.setup_error_unreachable, e.localizedMessage ?: e.javaClass.simpleName)
        } finally {
            conn?.disconnect()
        }
    }

    private fun setBusy(busy: Boolean) {
        connectButton.isEnabled = !busy
        connectButton.text = if (busy) "" else getString(R.string.setup_connect)
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        if (busy) errorText.visibility = View.GONE
    }

    private fun showError(message: String) {
        errorText.text = message
        errorText.visibility = View.VISIBLE
    }
}
