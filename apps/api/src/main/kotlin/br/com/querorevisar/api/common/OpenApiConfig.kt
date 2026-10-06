package br.com.querorevisar.api.common

import br.com.querorevisar.api.auth.CurrentUser
import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.core.converter.AnnotatedType
import io.swagger.v3.core.converter.ModelConverters
import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.Operation
import io.swagger.v3.oas.models.PathItem
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.media.Content
import io.swagger.v3.oas.models.media.MediaType
import io.swagger.v3.oas.models.media.Schema
import io.swagger.v3.oas.models.parameters.Parameter
import io.swagger.v3.oas.models.responses.ApiResponse
import io.swagger.v3.oas.models.security.SecurityRequirement
import io.swagger.v3.oas.models.security.SecurityScheme
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import org.springdoc.core.customizers.OpenApiCustomizer
import org.springdoc.core.utils.SpringDocUtils
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider
import org.springframework.context.annotation.Configuration
import org.springframework.core.type.filter.AnnotationTypeFilter
import kotlin.reflect.full.primaryConstructor

/** Marks request/response DTOs; their simple class name is the OpenAPI schema name of the contract. */
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class ApiDto

/** A property that may be absent but is never null when present (PATCH fields). */
@Target(AnnotationTarget.VALUE_PARAMETER, AnnotationTarget.FIELD, AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
annotation class NonNullWhenPresent

/**
 * springdoc (/v3/api-docs, local and dev only). The schemas are aligned with packages/api-client/openapi.yaml:
 * `required` comes from Kotlin constructor parameters without a default value, nullability from Kotlin nullable
 * types (unless the property is @NotNull/@NotBlank or [NonNullWhenPresent]); writes get the Idempotency-Key header
 * and every operation documents the application/problem+json default response.
 */
@Configuration
class OpenApiConfig {
    init {
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(CurrentUser::class.java)
    }

    @Bean
    fun openApiInfo(): OpenAPI = OpenAPI()
        .info(
            Info().title("QueroRevisar API").version("v1").description(
                "JSON in camelCase, money in cents, ISO 8601 dates. Errors use application/problem+json (RFC 9457) " +
                    "with an extra `code` member. Writes require an `Idempotency-Key` header (UUID).",
            ),
        )
        .components(
            Components().addSecuritySchemes(
                "bearerAuth",
                SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT"),
            ),
        )
        .addSecurityItem(SecurityRequirement().addList("bearerAuth"))

    @Bean
    fun contractCustomizer(): OpenApiCustomizer = ContractCustomizer()
}

class ContractCustomizer : OpenApiCustomizer {
    private val dtoClasses: Map<String, Class<*>> by lazy {
        val scanner = ClassPathScanningCandidateComponentProvider(false)
        scanner.addIncludeFilter(AnnotationTypeFilter(ApiDto::class.java))
        scanner.findCandidateComponents("br.com.querorevisar.api")
            .mapNotNull { it.beanClassName }
            .map { Class.forName(it) }
            .associateBy { it.simpleName }
    }

    override fun customise(openApi: OpenAPI) {
        val components = openApi.components ?: Components().also { openApi.components = it }
        val schemas = components.schemas ?: LinkedHashMap<String, Schema<*>>().also { components.schemas = it }
        for (extra in listOf(Problem::class.java, FieldError::class.java)) {
            if (extra.simpleName !in schemas) {
                ModelConverters.getInstance(true).readAll(AnnotatedType(extra)).forEach { (k, v) -> schemas.putIfAbsent(k, v) }
            }
        }
        for ((name, schema) in schemas) {
            val cls = dtoClasses[name] ?: continue
            alignWithKotlin(schema, cls)
        }
        schemas.values.forEach { stripNumberFormats(it) }
        openApi.paths?.forEach { (path, item) -> customizeOperations(path, item) }
    }

    private fun alignWithKotlin(schema: Schema<*>, cls: Class<*>) {
        val ctor = cls.kotlin.primaryConstructor ?: return
        val props = schema.properties ?: return
        val required = ArrayList<String>()
        val kept = LinkedHashMap<String, Schema<*>>()
        for (param in ctor.parameters) {
            val field = runCatching { cls.getDeclaredField(param.name!!) }.getOrNull()
            if (field?.isAnnotationPresent(JsonIgnore::class.java) == true) continue
            val jsonName = field?.getAnnotation(JsonProperty::class.java)?.value?.takeIf { it.isNotEmpty() } ?: param.name!!
            val propSchema = props[jsonName] ?: props[param.name!!] ?: continue
            val annotations = param.annotations.map { it.annotationClass.java } + (field?.annotations?.map { it.annotationClass.java } ?: emptyList())
            val notNull = annotations.any {
                it == NotNull::class.java || it == NotBlank::class.java || it == NotEmpty::class.java || it == NonNullWhenPresent::class.java
            }
            if (!param.isOptional) required += jsonName
            val nullable = param.type.isMarkedNullable && !notNull
            kept[jsonName] = if (nullable) nullableOf(propSchema) else nonNullOf(propSchema)
        }
        schema.properties = kept
        schema.required = required.ifEmpty { null }
    }

    private fun isNullSchema(s: Schema<*>): Boolean = s.type == "null" || s.types == setOf("null")

    @Suppress("UNCHECKED_CAST")
    private fun nonNullOf(s: Schema<*>): Schema<*> {
        // springdoc's Kotlin support already wraps nullable references as oneOf [ref, null].
        val variants = s.oneOf ?: s.anyOf
        if (variants != null) {
            val nonNull = variants.filterNot { isNullSchema(it) }
            if (nonNull.size == 1 && nonNull.size < variants.size) return nonNull[0]
        }
        s.types?.let { if ("null" in it) s.types = LinkedHashSet(it - "null") }
        if (s.enum != null && null in s.enum) (s as Schema<Any?>).enum = s.enum.filterNotNull()
        return s
    }

    @Suppress("UNCHECKED_CAST")
    private fun nullableOf(s: Schema<*>): Schema<*> {
        val variants = s.oneOf ?: s.anyOf
        if (variants != null && variants.any { isNullSchema(it) }) return s
        val ref = s.`$ref`
        if (ref != null) {
            val nullSchema = Schema<Any>().apply { type = "null" }
            return Schema<Any>().apply { oneOf = listOf(Schema<Any>().`$ref`(ref), nullSchema) }
        }
        val types = LinkedHashSet<String>()
        s.types?.let { types.addAll(it) }
        s.type?.let { types.add(it) }
        types.add("null")
        s.types = types
        if (s.enum != null && null !in s.enum) (s as Schema<Any?>).enum = s.enum + null
        return s
    }

    private fun stripNumberFormats(s: Schema<*>?) {
        if (s == null) return
        if (s.format == "double" || s.format == "float") s.format = null
        s.properties?.values?.forEach { stripNumberFormats(it) }
        stripNumberFormats(s.items)
    }

    private fun customizeOperations(path: String, item: PathItem) {
        val public = path == "/v1/catalog/version" || path.startsWith("/dev/auth/") || path.startsWith("/internal/") ||
            path == "/webhooks/mercadopago"
        item.readOperationsMap().forEach { (method, op) ->
            if (public) op.security = emptyList()
            val write = method.name in setOf("POST", "PUT", "PATCH", "DELETE")
            if (write && path.startsWith("/v1/") && !path.startsWith("/v1/mock/")) addIdempotencyKey(op)
            if (op.responses?.containsKey("default") == false) {
                op.responses.addApiResponse(
                    "default",
                    ApiResponse().description("Problem details (RFC 9457)").content(
                        Content().addMediaType(
                            "application/problem+json",
                            MediaType().schema(Schema<Any>().`$ref`("#/components/schemas/Problem")),
                        ),
                    ),
                )
            }
        }
    }

    private fun addIdempotencyKey(op: Operation) {
        if (op.parameters?.any { it.name == "Idempotency-Key" } == true) return
        op.addParametersItem(
            Parameter().name("Idempotency-Key").`in`("header").required(true)
                .schema(Schema<String>().apply { type = "string"; format = "uuid" }),
        )
    }
}
