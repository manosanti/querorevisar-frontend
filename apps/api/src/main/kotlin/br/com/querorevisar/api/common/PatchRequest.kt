package br.com.querorevisar.api.common

import org.springframework.core.MethodParameter
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpInputMessage
import org.springframework.http.converter.HttpMessageConverter
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.context.request.RequestAttributes
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter
import tools.jackson.databind.json.JsonMapper
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.lang.reflect.Type

/**
 * PATCH bodies distinguish "absent" from "null" (e.g. `plate: null` clears the plate, no `plate` keeps it).
 * DTOs implement this interface and receive the top-level keys present in the JSON.
 */
interface PatchRequest {
    val presentKeys: MutableSet<String>

    fun has(key: String): Boolean = key in presentKeys
}

@ControllerAdvice
class PatchKeysAdvice(private val mapper: JsonMapper) : RequestBodyAdviceAdapter() {
    override fun supports(methodParameter: MethodParameter, targetType: Type, converterType: Class<out HttpMessageConverter<*>>): Boolean =
        PatchRequest::class.java.isAssignableFrom(methodParameter.parameterType)

    override fun beforeBodyRead(
        inputMessage: HttpInputMessage,
        parameter: MethodParameter,
        targetType: Type,
        converterType: Class<out HttpMessageConverter<*>>,
    ): HttpInputMessage {
        val bytes = inputMessage.body.readAllBytes()
        val keys = runCatching {
            val node = mapper.readTree(bytes)
            if (node != null && node.isObject) node.properties().map { it.key }.toSet() else emptySet()
        }.getOrDefault(emptySet())
        RequestContextHolder.getRequestAttributes()?.setAttribute(ATTR, keys, RequestAttributes.SCOPE_REQUEST)
        return object : HttpInputMessage {
            override fun getBody(): InputStream = ByteArrayInputStream(bytes)
            override fun getHeaders(): HttpHeaders = inputMessage.headers
        }
    }

    override fun afterBodyRead(
        body: Any,
        inputMessage: HttpInputMessage,
        parameter: MethodParameter,
        targetType: Type,
        converterType: Class<out HttpMessageConverter<*>>,
    ): Any {
        @Suppress("UNCHECKED_CAST")
        val keys = RequestContextHolder.getRequestAttributes()?.getAttribute(ATTR, RequestAttributes.SCOPE_REQUEST) as? Set<String>
        if (body is PatchRequest && keys != null) body.presentKeys.addAll(keys)
        return body
    }

    companion object {
        private const val ATTR = "querorevisar.patchKeys"
    }
}
