package br.com.querorevisar.api.common

import java.sql.ResultSet
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID

// Small JDBC helpers: timestamps travel as OffsetDateTime (pgjdbc maps timestamptz to it), the API uses Instant.

fun Instant.odt(): OffsetDateTime = atOffset(ZoneOffset.UTC)

fun ResultSet.instant(column: String): Instant? = getObject(column, OffsetDateTime::class.java)?.toInstant()

fun ResultSet.instantOrThrow(column: String): Instant = instant(column) ?: error("$column is null")

fun ResultSet.uuid(column: String): UUID? = getObject(column, UUID::class.java)

fun ResultSet.localDate(column: String): LocalDate? = getObject(column, LocalDate::class.java)

fun ResultSet.intOrNull(column: String): Int? = getInt(column).let { if (wasNull()) null else it }

fun ResultSet.longOrNull(column: String): Long? = getLong(column).let { if (wasNull()) null else it }

object Zones {
    val SAO_PAULO: ZoneId = ZoneId.of("America/Sao_Paulo")
}
