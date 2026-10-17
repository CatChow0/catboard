<#
.SYNOPSIS
    Builds the signed CatBoard Android APK into dist/android/catboard-v<version>.apk.

.DESCRIPTION
    The version comes from package.json (must match package-lock.json).
    Signing comes from android/keystore.properties, or from the env vars
    CATBOARD_KEYSTORE_PATH / CATBOARD_KEYSTORE_PASSWORD / CATBOARD_KEY_ALIAS / CATBOARD_KEY_PASSWORD
    (the CI-friendly path, e.g. Jenkins credentials).

.PARAMETER Publish
    Also create the GitHub release v<version> with the APK attached (requires the gh CLI).

.EXAMPLE
    ./scripts/build-android.ps1
    ./scripts/build-android.ps1 -Publish
#>
param(
    [switch]$Publish
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root 'android'

# --- Version -----------------------------------------------------------------
# Regex instead of ConvertFrom-Json: Windows PowerShell 5.1 rejects the "" key in package-lock.json.
function Get-TopVersion([string]$file) {
    $m = [regex]::Match((Get-Content (Join-Path $root $file) -Raw), '"version"\s*:\s*"([^"]+)"')
    if (-not $m.Success) { throw "No version found in $file" }
    $m.Groups[1].Value
}
$pkgVersion = Get-TopVersion 'package.json'
$lockVersion = Get-TopVersion 'package-lock.json'
if ($pkgVersion -ne $lockVersion) {
    throw "Version mismatch: package.json=$pkgVersion, package-lock.json=$lockVersion"
}
Write-Host "CatBoard Android v$pkgVersion" -ForegroundColor Cyan

# --- Signing -----------------------------------------------------------------
$hasEnvSigning = -not [string]::IsNullOrWhiteSpace($env:CATBOARD_KEYSTORE_PATH)
$hasFileSigning = Test-Path (Join-Path $androidDir 'keystore.properties')
if (-not ($hasEnvSigning -or $hasFileSigning)) {
    throw "No signing config. Create android/keystore.properties (see keystore.properties.example) or set CATBOARD_KEYSTORE_* env vars."
}

# --- Build -------------------------------------------------------------------
$gradlew = Join-Path $androidDir 'gradlew.bat'
if (-not (Test-Path $gradlew)) {
    throw "Gradle wrapper missing (android/gradlew.bat). See README > Android app > Building."
}
Push-Location $androidDir
try {
    & $gradlew --no-daemon clean assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed ($LASTEXITCODE)" }
} finally {
    Pop-Location
}

$built = Join-Path $androidDir 'app/build/outputs/apk/release/app-release.apk'
if (-not (Test-Path $built)) {
    throw "Signed APK not found at $built (an unsigned build is named app-release-unsigned.apk: check the signing config)."
}

$outDir = Join-Path $root 'dist/android'
New-Item -ItemType Directory -Force $outDir | Out-Null
$apk = Join-Path $outDir "catboard-v$pkgVersion.apk"
Copy-Item $built $apk -Force

# --- Verify signature --------------------------------------------------------
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $null }
if (-not $sdk) {
    $localProps = Join-Path $androidDir 'local.properties'
    if (Test-Path $localProps) {
        $line = Select-String -Path $localProps -Pattern '^sdk\.dir=(.*)$' | Select-Object -First 1
        if ($line) { $sdk = $line.Matches[0].Groups[1].Value -replace '\\:', ':' -replace '\\\\', '\' }
    }
}
$apksigner = if ($sdk) {
    Get-ChildItem (Join-Path $sdk 'build-tools') -Filter 'apksigner.bat' -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
}
if ($apksigner) {
    & $apksigner.FullName verify --print-certs $apk
    if ($LASTEXITCODE -ne 0) { throw "apksigner verification failed" }
} else {
    Write-Warning "apksigner not found (set ANDROID_HOME); skipping signature check."
}

$hash = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLower()
Write-Host ""
Write-Host "APK:    $apk" -ForegroundColor Green
Write-Host "SHA256: $hash"

# --- Publish -----------------------------------------------------------------
$tag = "v$pkgVersion"
if ($Publish) {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "gh CLI not installed (https://cli.github.com)" }
    gh release create $tag $apk --title "CatBoard $tag" --generate-notes
    if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
} else {
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. git tag $tag; git push origin $tag"
    Write-Host "  2. GitHub > Releases > Draft a new release > choose tag $tag"
    Write-Host "  3. Attach $apk and publish"
}
