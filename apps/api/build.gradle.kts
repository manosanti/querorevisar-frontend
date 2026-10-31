// QueroRevisar API: Kotlin + Spring Boot 4 (JVM 21). Commands (from the repo root):
//   ./gradlew :apps:api:check              unit + integration tests (Testcontainers or embedded Postgres)
//   ./gradlew :apps:api:localDb            embedded Postgres on 127.0.0.1:54322 (data in .local/pg) until Ctrl+C
//   ./gradlew :apps:api:bootRun            API on :8080 with the `local` profile (all integrations in mock mode)
//   ./gradlew :apps:api:createPremiumPlan  creates the Mercado Pago preapproval_plan (prints instructions in mock mode)
plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.spring") version "2.4.21"
    id("org.springframework.boot") version "4.1.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.graalvm.buildtools.native") version "1.1.17"
}

group = "br.com.querorevisar"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// Dev-only tooling (embedded Postgres for `localDb`). Never on the production classpath.
val localdb: SourceSet = sourceSets.create("localdb")

dependencyManagement {
    imports {
        // Postgres binaries used by zonky (tests without Docker and `localDb`).
        mavenBom("io.zonky.test.postgres:embedded-postgres-binaries-bom:18.6.0")
    }
}

val springdocVersion = "3.2.0"
val bucket4jVersion = "8.21.0"
val webPushVersion = "5.1.2"
val bouncyCastleVersion = "1.86"
val zxingVersion = "3.5.4"
val sentryVersion = "8.62.0"
val zonkyVersion = "2.2.2"
val wiremockVersion = "3.13.2"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("com.github.ben-manes.caffeine:caffeine")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:$springdocVersion")
    implementation("com.bucket4j:bucket4j_jdk17-core:$bucket4jVersion")
    implementation("nl.martijndwars:web-push:$webPushVersion") {
        exclude(group = "org.bouncycastle", module = "bcprov-jdk15on")
        exclude(group = "com.beust", module = "jcommander")
        exclude(group = "org.asynchttpclient", module = "async-http-client")
    }
    implementation("org.bouncycastle:bcprov-jdk18on:$bouncyCastleVersion")
    // web-push exposes Apache HttpCore types (HttpResponse) but declares them with runtime scope.
    implementation("org.apache.httpcomponents:httpcore:4.4.16")
    implementation("com.google.zxing:core:$zxingVersion")
    implementation("io.sentry:sentry-spring-boot-4-starter:$sentryVersion")
    runtimeOnly("org.postgresql:postgresql")

    "localdbImplementation"("io.zonky.test:embedded-postgres:$zonkyVersion")
    "localdbRuntimeOnly"("org.slf4j:slf4j-simple")
    "localdbRuntimeOnly"("io.zonky.test.postgres:embedded-postgres-binaries-darwin-arm64v8")
    "localdbRuntimeOnly"("io.zonky.test.postgres:embedded-postgres-binaries-linux-arm64v8")

    testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
    testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testImplementation("io.zonky.test:embedded-postgres:$zonkyVersion")
    testRuntimeOnly("io.zonky.test.postgres:embedded-postgres-binaries-darwin-arm64v8")
    testRuntimeOnly("io.zonky.test.postgres:embedded-postgres-binaries-linux-arm64v8")
    testImplementation("org.wiremock:wiremock-standalone:$wiremockVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

springBoot {
    mainClass = "br.com.querorevisar.api.ApiApplicationKt"
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
    }
}

// Seeds (F03.1): data/catalog.json and data/planos.json are copied into the jar under seed/.
tasks.processResources {
    from(rootProject.file("data")) {
        include("catalog.json", "planos.json")
        into("seed")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
    maxHeapSize = "1g"
    systemProperty("fixtures.dir", rootProject.file("fixtures").absolutePath)
    systemProperty("openapi.out", layout.buildDirectory.file("openapi.json").get().asFile.absolutePath)
    systemProperty("user.timezone", "UTC")
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    // The jar has no default profile on purpose (prod must say SPRING_PROFILES_ACTIVE=prod); bootRun is local.
    if (System.getenv("SPRING_PROFILES_ACTIVE").isNullOrBlank()) {
        args("--spring.profiles.active=local")
    }
    // Plain JVM run: AOT output is only for native images, skipping processAot saves ~20 s per start.
    classpath = files(sourceSets["main"].output, configurations["runtimeClasspath"], configurations["developmentOnly"])
    jvmArgs("-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8")
}

val pgDataDir = rootProject.file(".local/pg").absolutePath

tasks.register<JavaExec>("localDb") {
    group = "application"
    description = "Starts an embedded PostgreSQL on 127.0.0.1:54322 (data in .local/pg) and blocks until Ctrl+C."
    classpath = localdb.runtimeClasspath
    mainClass = "br.com.querorevisar.api.localdb.LocalDbKt"
    args("start", "--port", "54322", "--data", pgDataDir)
    standardInput = System.`in`
}

tasks.register<JavaExec>("localDbStop") {
    group = "application"
    description = "Stops an embedded PostgreSQL left running by localDb (for example after a killed terminal)."
    classpath = localdb.runtimeClasspath
    mainClass = "br.com.querorevisar.api.localdb.LocalDbKt"
    args("stop", "--port", "54322", "--data", pgDataDir)
}

tasks.register<JavaExec>("createPremiumPlan") {
    group = "application"
    description = "Creates the Mercado Pago preapproval_plan 'QueroRevisar Premium' (mock mode only prints instructions)."
    // Plain main classes (no AOT processing needed for a command-line script).
    classpath = files(sourceSets["main"].output, configurations["runtimeClasspath"])
    mainClass = "br.com.querorevisar.api.billing.CreatePremiumPlanKt"
    jvmArgs("-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8")
}
