package br.com.querorevisar.api.common

import com.fasterxml.jackson.annotation.JsonValue
import org.springframework.http.HttpStatus

/** `code` member of every problem (contract enum). `type` is `/problems/{slug}`. */
enum class ProblemCode(@get:JsonValue val slug: String, val status: HttpStatus, val defaultTitle: String) {
    VALIDATION("validation", HttpStatus.BAD_REQUEST, "Confira os dados e tente de novo."),
    NOT_FOUND("not-found", HttpStatus.NOT_FOUND, "Não encontramos o que você procurou."),
    UNAUTHORIZED("unauthorized", HttpStatus.UNAUTHORIZED, "Sua sessão expirou. Entre de novo."),
    VEHICLE_LIMIT("vehicle-limit", HttpStatus.PAYMENT_REQUIRED, "O plano grátis acompanha 1 veículo."),
    HISTORY_LOCKED(
        "history-locked", HttpStatus.PAYMENT_REQUIRED,
        "O plano grátis mostra os últimos 12 meses. O histórico completo está no Premium.",
    ),
    INSUFFICIENT_CREDITS("insufficient-credits", HttpStatus.PAYMENT_REQUIRED, "Créditos insuficientes para esta consulta."),
    INVALID_PLATE("invalid-plate", HttpStatus.UNPROCESSABLE_CONTENT, "Placa inválida. Use o formato ABC1D23"),
    PROVIDER_UNAVAILABLE(
        "provider-unavailable", HttpStatus.SERVICE_UNAVAILABLE,
        "Serviço indisponível no momento. Tente de novo em alguns minutos.",
    ),
    RATE_LIMITED("rate-limited", HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas seguidas. Aguarde um pouco e tente de novo."),
    CONFLICT("conflict", HttpStatus.CONFLICT, "Essa alteração conflita com outra mais recente."),
    PAYMENT_ERROR("payment-error", HttpStatus.BAD_GATEWAY, "Não foi possível falar com o Mercado Pago. Tente de novo."),
    INTERNAL("internal", HttpStatus.INTERNAL_SERVER_ERROR, "Algo deu errado do nosso lado. Tente de novo."),
}

/** RFC 9457 problem details with the contract's extra members. */
@ApiDto
data class Problem(
    /** URI reference, e.g. /problems/vehicle-limit. */
    val type: String,
    /** pt-BR, safe to show to the user. */
    val title: String,
    val status: Int,
    val code: ProblemCode,
    val detail: String? = null,
    val instance: String? = null,
    /** insufficient-credits: credits still missing. */
    val missing: Int? = null,
    val errors: List<FieldError>? = null,
)

@ApiDto
data class FieldError(val field: String, val message: String)

/** Thrown anywhere in the API; rendered as application/problem+json by [ProblemHandler]. */
class ApiException(
    val code: ProblemCode,
    val title: String = code.defaultTitle,
    val detail: String? = null,
    val missing: Int? = null,
    val errors: List<FieldError>? = null,
    val status: HttpStatus = code.status,
    val headers: Map<String, String> = emptyMap(),
) : RuntimeException(title) {
    fun toProblem(instance: String?): Problem = Problem(
        type = "/problems/${code.slug}",
        title = title,
        status = status.value(),
        code = code,
        detail = detail,
        instance = instance,
        missing = missing,
        errors = errors,
    )

    companion object {
        fun validation(message: String, field: String? = null) = ApiException(
            ProblemCode.VALIDATION,
            title = message,
            errors = field?.let { listOf(FieldError(it, message)) },
        )

        fun notFound(title: String = ProblemCode.NOT_FOUND.defaultTitle) = ApiException(ProblemCode.NOT_FOUND, title)

        fun conflict(title: String = ProblemCode.CONFLICT.defaultTitle) = ApiException(ProblemCode.CONFLICT, title)
    }
}
