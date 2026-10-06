package br.com.querorevisar.api.localdb

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres
import java.io.File
import java.net.Socket
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.system.exitProcess

/**
 * Embedded PostgreSQL for local development without Docker (`./gradlew :apps:api:localDb`): 127.0.0.1:54322,
 * user/database `postgres`, data kept in .local/pg at the repo root. Blocks until Ctrl+C.
 * `./gradlew :apps:api:localDbStop` stops a server left behind by a killed terminal.
 * Lives in its own source set so zonky never reaches the production jar.
 */
fun main(args: Array<String>) {
    val command = args.firstOrNull() ?: "start"
    val port = args.valueOf("--port")?.toInt() ?: 54322
    val dataDir = File(args.valueOf("--data") ?: ".local/pg").absoluteFile

    when (command) {
        "stop" -> {
            val stopped = stopServer(dataDir)
            println(if (stopped) "Postgres in ${dataDir.path} stopped." else "No Postgres running for ${dataDir.path}.")
        }
        "start" -> start(port, dataDir)
        else -> {
            System.err.println("usage: LocalDb start|stop --port 54322 --data .local/pg")
            exitProcess(2)
        }
    }
}

private fun Array<String>.valueOf(flag: String): String? = indexOf(flag).takeIf { it >= 0 && it + 1 < size }?.let { this[it + 1] }

private fun start(port: Int, dataDir: File) {
    if (portInUse(port)) {
        System.err.println(
            "Port $port is already in use. If it is a previous localDb, run ./gradlew :apps:api:localDbStop; " +
                "if it is the Supabase CLI database, you don't need localDb.",
        )
        exitProcess(1)
    }
    // A server killed without shutdown leaves postmaster.pid behind; Postgres handles a stale file itself.
    Files.createDirectories(dataDir.toPath())
    val pg = EmbeddedPostgres.builder()
        .setPort(port)
        .setDataDirectory(dataDir)
        .setCleanDataDirectory(false)
        .setPGStartupWait(java.time.Duration.ofSeconds(60))
        .start()
    println("Postgres ready on 127.0.0.1:$port (user postgres, database postgres, data ${dataDir.path}). Ctrl+C to stop.")
    println("DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:$port/postgres")
    val done = CountDownLatch(1)
    Runtime.getRuntime().addShutdownHook(
        Thread {
            runCatching { pg.close() }
            done.countDown()
        },
    )
    done.await()
}

private fun portInUse(port: Int): Boolean = runCatching { Socket("127.0.0.1", port).use { true } }.getOrDefault(false)

/** Zonky extracts the Postgres binaries to <tmp>/embedded-pg/PG-<hash>; pg_ctl from there stops the server. */
private fun pgCtlCandidates(): List<File> {
    val root = File(System.getProperty("java.io.tmpdir"), "embedded-pg")
    val name = if (System.getProperty("os.name").lowercase().contains("win")) "pg_ctl.exe" else "pg_ctl"
    return root.listFiles().orEmpty().map { File(it, "bin/$name") }.filter { it.canExecute() }.sortedByDescending { it.lastModified() }
}

private fun stopServer(dataDir: File): Boolean {
    if (!File(dataDir, "postmaster.pid").exists()) return false
    for (pgCtl in pgCtlCandidates()) {
        val process = ProcessBuilder(pgCtl.path, "stop", "-D", dataDir.path, "-m", "fast", "-w")
            .redirectErrorStream(true).start()
        val output = process.inputStream.bufferedReader().readText()
        if (process.waitFor(60, TimeUnit.SECONDS) && process.exitValue() == 0) return true
        if (output.isNotBlank()) System.err.println(output.trim())
    }
    return !File(dataDir, "postmaster.pid").exists()
}
