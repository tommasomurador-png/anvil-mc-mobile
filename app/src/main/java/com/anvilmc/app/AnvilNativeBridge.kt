package com.anvilmc.app

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * JavaScript Bridge exposed as `window.AnvilNative` inside the Android WebView.
 * Provides real TCP RCON execution, low-latency socket ping, native haptics, and file export.
 */
class AnvilNativeBridge(private val context: Context) {

    @JavascriptInterface
    fun sendRconCommand(host: String, port: Int, password: String, command: String): String {
        triggerHaptic("TICK")
        return runBlocking {
            MinecraftRconClient.executeCommand(host, port, password, command)
        }
    }

    @JavascriptInterface
    fun pingServerNative(host: String, port: Int): String {
        return runBlocking {
            MinecraftRconClient.pingTcpSocket(host, port)
        }
    }

    @JavascriptInterface
    fun triggerHaptic(style: String) {
        try {
            val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            if (!vibrator.hasVibrator()) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = when (style.uppercase()) {
                    "HEAVY_CLICK" -> VibrationEffect.createOneShot(45, 255)
                    "ERROR" -> VibrationEffect.createWaveform(longArrayOf(0, 60, 50, 90), intArrayOf(0, 255, 0, 255), -1)
                    "SUCCESS" -> VibrationEffect.createWaveform(longArrayOf(0, 25, 40, 45), intArrayOf(0, 180, 0, 255), -1)
                    else -> VibrationEffect.createOneShot(14, 120) // TICK
                }
                vibrator.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(20)
            }
        } catch (_: Exception) {
        }
    }

    @JavascriptInterface
    fun exportServerFile(filename: String, content: String): String {
        val response = JSONObject()
        try {
            val safeName = filename.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, "text/plain")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AnvilMC")
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { out ->
                        out.write(content.toByteArray(Charsets.UTF_8))
                    }
                    triggerHaptic("SUCCESS")
                    response.put("ok", true)
                    response.put("path", "Downloads/AnvilMC/$safeName")
                    return response.toString()
                }
            }

            val dir = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "AnvilMC")
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, safeName)
            FileOutputStream(file).use { out ->
                out.write(content.toByteArray(Charsets.UTF_8))
            }
            triggerHaptic("SUCCESS")
            response.put("ok", true)
            response.put("path", file.absolutePath)
        } catch (e: Exception) {
            triggerHaptic("ERROR")
            response.put("ok", false)
            response.put("error", e.localizedMessage ?: "Export failed")
        }
        return response.toString()
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val info = JSONObject()
        info.put("platform", "Android Native")
        info.put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
        info.put("sdkInt", Build.VERSION.SDK_INT)
        info.put("versionName", "1.0.0")
        return info.toString()
    }
}
