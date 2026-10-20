package com.anvilmc.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicInteger

/**
 * Native implementation of the official Source RCON Protocol used by Minecraft servers.
 * Packet structure (Little-Endian):
 * - Length (Int32): size of RequestID (4) + Type (4) + Payload (N) + 2 Null bytes (2)
 * - RequestID (Int32)
 * - Type (Int32): 3 = Login/Auth, 2 = Command, 0 = Response
 * - Payload (ASCII/UTF-8 bytes)
 * - 2 Null Terminator bytes (0x00, 0x00)
 */
object MinecraftRconClient {

    private const val SERVERDATA_AUTH = 3
    private const val SERVERDATA_EXECCOMMAND = 2
    private const val SERVERDATA_AUTH_RESPONSE = 2
    private const val SERVERDATA_RESPONSE_VALUE = 0

    private val requestIdCounter = AtomicInteger(100)

    suspend fun executeCommand(
        host: String,
        port: Int,
        password: String,
        command: String,
        timeoutMs: Int = 5000
    ): String = withContext(Dispatchers.IO) {
        val result = JSONObject()
        val startTime = System.currentTimeMillis()
        var socket: Socket? = null

        try {
            socket = Socket()
            socket.soTimeout = timeoutMs
            socket.connect(InetSocketAddress(host.trim(), port), timeoutMs)

            val output = DataOutputStream(socket.getOutputStream())
            val input = DataInputStream(socket.getInputStream())

            // 1. Authenticate (Packet Type 3)
            val authReqId = requestIdCounter.incrementAndGet()
            sendPacket(output, authReqId, SERVERDATA_AUTH, password)

            val authResponse = readPacket(input)
            if (authResponse.requestId == -1 || authResponse.requestId != authReqId) {
                result.put("ok", false)
                result.put("error", "RCON Authentication failed (Invalid RCON password)")
                result.put("latencyMs", System.currentTimeMillis() - startTime)
                return@withContext result.toString()
            }

            // 2. Execute Command (Packet Type 2)
            val cmdReqId = requestIdCounter.incrementAndGet()
            val cleanCommand = if (command.startsWith("/")) command.substring(1) else command
            sendPacket(output, cmdReqId, SERVERDATA_EXECCOMMAND, cleanCommand)

            val cmdResponse = readPacket(input)
            val elapsed = System.currentTimeMillis() - startTime

            result.put("ok", true)
            result.put("response", cmdResponse.payload)
            result.put("requestId", cmdResponse.requestId)
            result.put("latencyMs", elapsed)
        } catch (e: Exception) {
            result.put("ok", false)
            result.put("error", "${e.javaClass.simpleName}: ${e.localizedMessage ?: "Connection failed"}")
            result.put("latencyMs", System.currentTimeMillis() - startTime)
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {}
        }

        result.toString()
    }

    suspend fun pingTcpSocket(
        host: String,
        port: Int,
        timeoutMs: Int = 3500
    ): String = withContext(Dispatchers.IO) {
        val result = JSONObject()
        val start = System.nanoTime()
        var socket: Socket? = null
        try {
            socket = Socket()
            socket.connect(InetSocketAddress(host.trim(), port), timeoutMs)
            val latencyMs = ((System.nanoTime() - start) / 1_000_000.0).toInt().coerceAtLeast(1)
            result.put("ok", true)
            result.put("host", host)
            result.put("port", port)
            result.put("latencyMs", latencyMs)
        } catch (e: Exception) {
            result.put("ok", false)
            result.put("host", host)
            result.put("port", port)
            result.put("latencyMs", -1)
            result.put("error", e.localizedMessage ?: "Unreachable")
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {}
        }
        result.toString()
    }

    private data class RconPacket(
        val length: Int,
        val requestId: Int,
        val type: Int,
        val payload: String
    )

    private fun sendPacket(out: DataOutputStream, requestId: Int, type: Int, payload: String) {
        val payloadBytes = payload.toByteArray(StandardCharsets.UTF_8)
        val packetLength = 4 + 4 + payloadBytes.size + 2
        val buffer = ByteBuffer.allocate(4 + packetLength).order(ByteOrder.LITTLE_ENDIAN)
        buffer.putInt(packetLength)
        buffer.putInt(requestId)
        buffer.putInt(type)
        buffer.put(payloadBytes)
        buffer.put(0.toByte())
        buffer.put(0.toByte())

        out.write(buffer.array())
        out.flush()
    }

    private fun readPacket(input: DataInputStream): RconPacket {
        val lenBytes = ByteArray(4)
        input.readFully(lenBytes)
        val length = ByteBuffer.wrap(lenBytes).order(ByteOrder.LITTLE_ENDIAN).int

        if (length < 10 || length > 16384) {
            throw IllegalStateException("Invalid RCON packet length: $length")
        }

        val bodyBytes = ByteArray(length)
        input.readFully(bodyBytes)
        val bodyBuf = ByteBuffer.wrap(bodyBytes).order(ByteOrder.LITTLE_ENDIAN)

        val requestId = bodyBuf.int
        val type = bodyBuf.int
        val payloadLen = length - 4 - 4 - 2
        val payloadBytes = ByteArray(payloadLen.coerceAtLeast(0))
        if (payloadLen > 0) {
            bodyBuf.get(payloadBytes)
        }

        val payload = String(payloadBytes, StandardCharsets.UTF_8)
        return RconPacket(length, requestId, type, payload)
    }
}
