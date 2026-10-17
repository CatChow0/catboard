import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// The APK version always follows the server version in package.json.
val appVersion: String = run {
    val pkg = rootProject.file("../package.json").readText()
    Regex("\"version\"\\s*:\\s*\"([^\"]+)\"").find(pkg)?.groupValues?.get(1)
        ?: error("Could not read version from package.json")
}
val appVersionCode: Int = run {
    val (major, minor, patch) = appVersion.split("-")[0].split(".").map { it.toInt() } + listOf(0, 0, 0)
    major * 10000 + minor * 100 + patch
}

// Signing: env vars (CI / Jenkins) first, then android/keystore.properties (local).
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signingValue(env: String, prop: String): String? =
    System.getenv(env)?.takeIf { it.isNotBlank() } ?: keystoreProps.getProperty(prop)?.takeIf { it.isNotBlank() }

val storePath = signingValue("CATBOARD_KEYSTORE_PATH", "storeFile")
val hasSigning = storePath != null

android {
    namespace = "com.catchow.catboard"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.catchow.catboard"
        minSdk = 24
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersion
    }

    signingConfigs {
        if (hasSigning) {
            create("release") {
                storeFile = rootProject.file(storePath!!)
                storePassword = signingValue("CATBOARD_KEYSTORE_PASSWORD", "storePassword")
                keyAlias = signingValue("CATBOARD_KEY_ALIAS", "keyAlias")
                keyPassword = signingValue("CATBOARD_KEY_PASSWORD", "keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        buildConfig = true
    }
    dependenciesInfo {
        // Keep the APK free of the Google-encrypted dependency blob (F-Droid/Obtainium friendly).
        includeInApk = false
        includeInBundle = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
}
