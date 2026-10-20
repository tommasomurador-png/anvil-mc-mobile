package com.anvilmc.app

import android.app.ActivityManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
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
import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * Native Kotlin Bridge exposed as `window.AnvilNative` inside the Android WebView for Anvil-MC v2.0.7.
 */
class AnvilNativeBridge(private val context: Context) {

    @JavascriptInterface
    fun getDeviceIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                if (networkInterface.isLoopback || !networkInterface.isUp) continue
                val addresses = networkInterface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        val ip = addr.hostAddress ?: continue
                        if (!ip.startsWith("127.")) {
                            return "$ip:25565"
                        }
                    }
                }
            }
        } catch (_: Exception) {
        }
        return "10.209.160.27:25565"
    }

    @JavascriptInterface
    fun getAvailableRamMb(): Int {
        return try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)
            (memInfo.availMem / (1024 * 1024)).toInt().coerceAtLeast(1024)
        } catch (_: Exception) {
            3420
        }
    }

    @JavascriptInterface
    fun getTotalRamMb(): Int {
        return try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            actManager.getMemoryInfo(memInfo)
            (memInfo.totalMem / (1024 * 1024)).toInt().coerceAtLeast(4096)
        } catch (_: Exception) {
            8192
        }
    }

    @JavascriptInterface
    fun vibrate(type: String) {
        triggerHaptic(type)
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
                    "HEAVY_CLICK", "START", "STOP" -> VibrationEffect.createOneShot(45, 255)
                    "HOLD_PULSE" -> VibrationEffect.createOneShot(22, 190)
                    "ERROR", "DELETE" -> VibrationEffect.createWaveform(longArrayOf(0, 65, 45, 95), intArrayOf(0, 255, 0, 255), -1)
                    "SUCCESS" -> VibrationEffect.createWaveform(longArrayOf(0, 25, 40, 50), intArrayOf(0, 180, 0, 255), -1)
                    else -> VibrationEffect.createOneShot(14, 120)
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
    fun shareText(title: String, text: String) {
        try {
            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TITLE, title)
                putExtra(Intent.EXTRA_TEXT, text)
                type = "text/plain"
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val shareIntent = Intent.createChooser(sendIntent, title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(shareIntent)
        } catch (_: Exception) {
        }
    }

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
    fun exportServerFile(filename: String, content: String): String {
        val response = JSONObject()
        try {
            val safeName = filename.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val mimeType = if (safeName.endsWith(".zip")) "application/zip" else "text/plain"
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
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
        info.put("versionName", "2.0.7")
        info.put("localIp", getDeviceIpAddress())
        info.put("availRamMb", getAvailableRamMb())
        return info.toString()
    }
}
