package br.com.querorevisar.api.domain

/** Brazilian plates: Mercosul (ABC1D23) and old format (ABC1234) share one regex (packages/core/src/plate.ts). */
object Plates {
    val REGEX = Regex("^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")
    const val ERROR = "Placa inválida. Use o formato ABC1D23"

    /** Uppercase, letters and digits only, at most 7 characters. */
    fun normalize(input: String): String = input.uppercase().replace(Regex("[^A-Z0-9]"), "").take(7)

    fun isValid(plate: String): Boolean = REGEX.matches(plate)

    /** LGPD: plates never go to logs or analytics in full ("ABC1***"). */
    fun mask(plate: String?): String = when {
        plate == null -> "null"
        plate.length <= 4 -> "***"
        else -> plate.take(4) + "***"
    }
}
