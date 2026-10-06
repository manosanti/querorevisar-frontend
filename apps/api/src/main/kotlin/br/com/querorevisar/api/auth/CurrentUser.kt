package br.com.querorevisar.api.auth

import br.com.querorevisar.api.common.ApiException
import br.com.querorevisar.api.common.ProblemCode
import org.springframework.core.MethodParameter
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer
import java.util.UUID

/** The authenticated user, taken from the JWT (Supabase or dev tokens): sub, is_anonymous, email, user_metadata.name. */
data class CurrentUser(val id: UUID, val isAnonymous: Boolean, val email: String?, val name: String?) {
    companion object {
        fun fromJwt(jwt: Jwt): CurrentUser {
            val meta = jwt.claims["user_metadata"] as? Map<*, *>
            val name = (meta?.get("name") ?: meta?.get("full_name"))?.toString()?.takeIf { it.isNotBlank() }
            val anonymous = when (val v = jwt.claims["is_anonymous"]) {
                is Boolean -> v
                is String -> v.toBoolean()
                else -> false
            }
            return CurrentUser(
                id = UUID.fromString(jwt.subject),
                isAnonymous = anonymous,
                email = jwt.getClaimAsString("email")?.takeIf { it.isNotBlank() },
                name = name,
            )
        }

        fun from(auth: Authentication?): CurrentUser? = (auth as? JwtAuthenticationToken)?.let { fromJwt(it.token) }

        fun current(): CurrentUser? = from(SecurityContextHolder.getContext().authentication)

        fun require(): CurrentUser = current() ?: throw ApiException(ProblemCode.UNAUTHORIZED)
    }
}

/** Lets controllers declare a `CurrentUser` parameter (hidden from the OpenAPI document). */
@Component
class CurrentUserArgumentResolver : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter): Boolean = parameter.parameterType == CurrentUser::class.java

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?,
    ): Any = CurrentUser.require()
}
