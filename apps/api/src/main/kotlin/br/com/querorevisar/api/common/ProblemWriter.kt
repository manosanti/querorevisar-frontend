package br.com.querorevisar.api.common

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper

/** Writes problems from servlet filters and security handlers, where @RestControllerAdvice does not apply. */
@Component
class ProblemWriter(private val mapper: JsonMapper) {
    fun write(request: HttpServletRequest, response: HttpServletResponse, ex: ApiException) {
        if (response.isCommitted) return
        response.status = ex.status.value()
        ex.headers.forEach { (k, v) -> response.setHeader(k, v) }
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        response.outputStream.write(mapper.writeValueAsBytes(ex.toProblem(request.requestURI)))
        response.outputStream.flush()
    }
}
