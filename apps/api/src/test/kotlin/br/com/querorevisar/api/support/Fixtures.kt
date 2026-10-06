package br.com.querorevisar.api.support

import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.io.File

/** Shared fixtures (repo root fixtures/ and data/), the same files packages/core runs. */
object Fixtures {
    val mapper: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .build()

    private val fixturesDir: File =
        File(System.getProperty("fixtures.dir") ?: "../../fixtures").absoluteFile

    private val repoRoot: File = fixturesDir.parentFile

    fun read(name: String): JsonNode = mapper.readTree(File(fixturesDir, name))

    fun data(name: String): File = File(repoRoot, "data/$name")
}
