package br.com.querorevisar.api.common

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.AuthenticationException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.HandlerMethodValidationException
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.servlet.resource.NoResourceFoundException
import tools.jackson.core.JacksonException

/** Every error leaves the API as application/problem+json (RFC 9457) with a pt-BR title (F04.3). */
@RestControllerAdvice
class ProblemHandler {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(ApiException::class)
    fun api(ex: ApiException, req: HttpServletRequest): ResponseEntity<Problem> = respond(ex, req)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun invalid(ex: MethodArgumentNotValidException, req: HttpServletRequest): ResponseEntity<Problem> {
        // Same order as the form (constructor parameter order), so the title is the message the prototype shows first.
        val order = ex.bindingResult.target?.let { t -> t.javaClass.declaredFields.mapIndexed { i, f -> f.name to i }.toMap() }.orEmpty()
        val fieldErrors = ex.bindingResult.fieldErrors.sortedBy { order[it.field.substringBefore('.').substringBefore('[')] ?: Int.MAX_VALUE }
        val errors = fieldErrors.map { FieldError(it.field, it.defaultMessage ?: ProblemCode.VALIDATION.defaultTitle) } +
            ex.bindingResult.globalErrors.map { FieldError(it.objectName, it.defaultMessage ?: ProblemCode.VALIDATION.defaultTitle) }
        return respond(validationOf(errors), req)
    }

    @ExceptionHandler(HandlerMethodValidationException::class)
    fun invalidMethod(ex: HandlerMethodValidationException, req: HttpServletRequest): ResponseEntity<Problem> {
        val errors = ex.parameterValidationResults.flatMap { r ->
            r.resolvableErrors.map { FieldError(r.methodParameter.parameterName ?: "param", it.defaultMessage ?: ProblemCode.VALIDATION.defaultTitle) }
        }
        return respond(validationOf(errors), req)
    }

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(ex: HttpMessageNotReadableException, req: HttpServletRequest): ResponseEntity<Problem> {
        var cause: Throwable? = ex.cause
        while (cause != null && cause !is JacksonException) cause = cause.cause
        val path = (cause as? JacksonException)?.path?.mapNotNull { it.propertyName }.orEmpty()
        val field = path.lastOrNull()
        val owner = (cause as? JacksonException)?.path?.lastOrNull()?.from()?.let { if (it is Class<*>) it.simpleName else it.javaClass.simpleName }
        val message = field?.let { FieldMessages.forField(owner, it) } ?: "Não entendemos os dados enviados."
        val error = ApiException(ProblemCode.VALIDATION, title = message, errors = field?.let { listOf(FieldError(path.joinToString("."), message)) })
        return respond(error, req)
    }

    @ExceptionHandler(MissingRequestHeaderException::class)
    fun missingHeader(ex: MissingRequestHeaderException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException.validation("Cabeçalho ${ex.headerName} obrigatório.", ex.headerName), req)

    @ExceptionHandler(MissingServletRequestParameterException::class)
    fun missingParam(ex: MissingServletRequestParameterException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException.validation("Parâmetro ${ex.parameterName} obrigatório.", ex.parameterName), req)

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun typeMismatch(ex: MethodArgumentTypeMismatchException, req: HttpServletRequest): ResponseEntity<Problem> =
        // A malformed id in the path is simply something that doesn't exist.
        if (ex.name == "id") respond(ApiException.notFound(), req)
        else respond(ApiException.validation("Valor inválido para ${ex.name}.", ex.name), req)

    @ExceptionHandler(NoResourceFoundException::class)
    fun noResource(ex: NoResourceFoundException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException.notFound(), req)

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun method(ex: HttpRequestMethodNotSupportedException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException(ProblemCode.NOT_FOUND, "Operação não disponível.", status = HttpStatus.METHOD_NOT_ALLOWED), req)

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun mediaType(ex: HttpMediaTypeNotSupportedException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException(ProblemCode.VALIDATION, "Envie os dados em JSON.", status = HttpStatus.UNSUPPORTED_MEDIA_TYPE), req)

    @ExceptionHandler(AuthenticationException::class)
    fun unauthenticated(ex: AuthenticationException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException(ProblemCode.UNAUTHORIZED), req)

    @ExceptionHandler(AccessDeniedException::class)
    fun denied(ex: AccessDeniedException, req: HttpServletRequest): ResponseEntity<Problem> =
        respond(ApiException(ProblemCode.UNAUTHORIZED, "Você não tem acesso a isso.", status = HttpStatus.FORBIDDEN), req)

    @ExceptionHandler(DataIntegrityViolationException::class)
    fun integrity(ex: DataIntegrityViolationException, req: HttpServletRequest): ResponseEntity<Problem> {
        Redact.error(log, "Integrity violation on ${req.method} ${req.requestURI}", ex)
        return respond(ApiException.conflict(), req)
    }

    @ExceptionHandler(Exception::class)
    fun unexpected(ex: Exception, req: HttpServletRequest): ResponseEntity<Problem> {
        Redact.error(log, "Unhandled error on ${req.method} ${req.requestURI}", ex)
        return respond(ApiException(ProblemCode.INTERNAL), req)
    }

    private fun validationOf(errors: List<FieldError>): ApiException {
        val title = errors.firstOrNull()?.message ?: ProblemCode.VALIDATION.defaultTitle
        return ApiException(
            ProblemCode.VALIDATION, title = title,
            detail = errors.map { it.message }.distinct().takeIf { it.size > 1 }?.joinToString(" · "),
            errors = errors,
        )
    }

    private fun respond(ex: ApiException, req: HttpServletRequest): ResponseEntity<Problem> {
        if (ex.status.is5xxServerError && ex.code != ProblemCode.INTERNAL) {
            log.warn("Problem {} on {} {}", ex.code.slug, req.method, req.requestURI)
        }
        val headers = HttpHeaders()
        ex.headers.forEach { (k, v) -> headers.set(k, v) }
        return ResponseEntity.status(ex.status)
            .headers(headers)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(ex.toProblem(req.requestURI))
    }
}

/** Exact pt-BR messages of the prototype for fields that arrive missing or malformed. */
object FieldMessages {
    fun forField(owner: String?, field: String): String? = when (field) {
        "itemId" -> "Escolha o item que você trocou"
        "km" -> if (owner == "RecordCreate" || owner == "RecordUpdate") "Informe o km de quando trocou" else "Informe o km atual do painel"
        "year" -> "Ano inválido. Use 4 dígitos, ex.: 2019"
        "brand", "model" -> if (owner?.startsWith("Record") == true) null else "Escolha a marca e o modelo"
        "date" -> "Data inválida."
        "name" -> "Informe seu nome"
        "email" -> "E-mail inválido. Confira e tente de novo"
        "password" -> "A senha precisa ter pelo menos 6 caracteres"
        else -> null
    }
}
