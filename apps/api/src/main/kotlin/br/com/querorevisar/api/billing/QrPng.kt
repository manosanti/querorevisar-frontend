package br.com.querorevisar.api.billing

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.util.Base64
import java.util.zip.CRC32
import java.util.zip.Deflater
import java.util.zip.DeflaterOutputStream

/** Mock Pix: a real QR code (PNG, base64) of a fake "copia e cola" string. Encoded without AWT (native friendly). */
object QrPng {
    fun base64(text: String, size: Int = 264): String = Base64.getEncoder().encodeToString(png(text, size))

    fun png(text: String, size: Int): ByteArray {
        val hints = mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M, EncodeHintType.MARGIN to 2)
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, hints)
        val w = matrix.width
        val h = matrix.height
        val raw = ByteArrayOutputStream(h * (w + 1))
        for (y in 0 until h) {
            raw.write(0) // filter: none
            for (x in 0 until w) raw.write(if (matrix.get(x, y)) 0x00 else 0xFF)
        }
        val compressed = ByteArrayOutputStream()
        DeflaterOutputStream(compressed, Deflater(Deflater.BEST_COMPRESSION)).use { it.write(raw.toByteArray()) }

        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 0x0D, 0x0A, 0x1A, 0x0A))
        val ihdr = ByteArrayOutputStream().also { b ->
            DataOutputStream(b).apply {
                writeInt(w)
                writeInt(h)
                writeByte(8) // bit depth
                writeByte(0) // grayscale
                writeByte(0) // compression
                writeByte(0) // filter
                writeByte(0) // interlace
            }
        }.toByteArray()
        chunk(out, "IHDR", ihdr)
        chunk(out, "IDAT", compressed.toByteArray())
        chunk(out, "IEND", ByteArray(0))
        return out.toByteArray()
    }

    private fun chunk(out: ByteArrayOutputStream, type: String, data: ByteArray) {
        val d = DataOutputStream(out)
        d.writeInt(data.size)
        val typeBytes = type.toByteArray(Charsets.US_ASCII)
        d.write(typeBytes)
        d.write(data)
        val crc = CRC32().apply { update(typeBytes); update(data) }
        d.writeInt(crc.value.toInt())
    }

    /** A syntactically valid EMV/BR Code "copia e cola" for a fake Pix key (CRC16-CCITT included). */
    fun fakePixPayload(txid: String, amountCents: Int): String {
        fun f(id: String, value: String) = id + value.length.toString().padStart(2, '0') + value
        val amount = "${amountCents / 100}.${(amountCents % 100).toString().padStart(2, '0')}"
        val merchant = f("00", "br.gov.bcb.pix") + f("01", "mock@querorevisar.invalid")
        val payload = f("00", "01") + f("26", merchant) + f("52", "0000") + f("53", "986") + f("54", amount) +
            f("58", "BR") + f("59", "QueroRevisar MOCK") + f("60", "SAO PAULO") +
            f("62", f("05", txid.replace("-", "").take(25))) + "6304"
        return payload + crc16(payload)
    }

    private fun crc16(s: String): String {
        var crc = 0xFFFF
        for (b in s.toByteArray(Charsets.UTF_8)) {
            crc = crc xor ((b.toInt() and 0xFF) shl 8)
            repeat(8) { crc = if (crc and 0x8000 != 0) (crc shl 1) xor 0x1021 else crc shl 1 }
            crc = crc and 0xFFFF
        }
        return crc.toString(16).uppercase().padStart(4, '0')
    }
}
