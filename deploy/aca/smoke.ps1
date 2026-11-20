param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,
    [switch]$SkipMatch
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

$base = $BaseUrl.TrimEnd('/')
Write-Host "Smoke checks against $base"

function Assert-Status {
    param([string]$Path, [int]$Expected = 200)
    $response = Invoke-WebRequest -Uri "$base$Path" -UseBasicParsing
    if ([int]$response.StatusCode -ne $Expected) {
        throw "$Path returned $($response.StatusCode); expected $Expected."
    }
    $content = $response.Content
    if ($content -is [byte[]]) {
        $content = [System.Text.Encoding]::UTF8.GetString($content)
    }
    $text = ([string]$content).Trim()
    Write-Host "  $Path -> $($response.StatusCode) $text"
}

Assert-Status -Path '/healthz'
Assert-Status -Path '/api/health'
Assert-Status -Path '/prolog/health'

if ($SkipMatch) {
    Write-Host 'Health checks OK (match flow skipped).'
    return
}

$env:BASE_URL = $base
& node (Join-Path $AcaConfig.ConsoleRoot 'scripts\smoke.mjs')
if ($LASTEXITCODE -ne 0) {
    throw 'scripts/smoke.mjs failed.'
}
Write-Host 'All smoke checks OK.'
