$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

Write-Host 'Reproducibility check (local only, no Azure writes).'

$statsHead = (& git -C $AcaConfig.StatsRoot rev-parse HEAD).Trim()
if (-not $statsHead.StartsWith($AcaConfig.StatsRef)) {
    throw "GameStats HEAD $statsHead does not match $($AcaConfig.StatsRef)."
}
$statsDirty = & git -C $AcaConfig.StatsRoot status --porcelain
if ($statsDirty) {
    throw 'GameStats working tree is not clean.'
}
Write-Host "  GameStats commit: $statsHead (clean)"

$required = @(
    'config.ps1', 'build-images.ps1', 'push-ghcr.ps1', 'deploy.ps1',
    'rollback.ps1', 'smoke.ps1', 'test-local.ps1', 'nginx.conf.template', 'web.Dockerfile',
    'web.Dockerfile.dockerignore', 'README.md'
)
foreach ($app in $AcaConfig.Apps) {
    $required += "apps/$($app.Name).yaml"
}
foreach ($file in $required) {
    $path = Join-Path $PSScriptRoot $file
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing file: $path"
    }
}
Write-Host "  Required files: $($required.Count) OK"

$secretPattern = 'gh[pousr]_[A-Za-z0-9]{20,}'
$hits = Get-ChildItem -Recurse -File -LiteralPath $PSScriptRoot |
    Select-String -Pattern $secretPattern -ErrorAction SilentlyContinue
if ($hits) {
    throw "Possible credential found in repo: $($hits | Select-Object -First 1)"
}
Write-Host '  No hardcoded GitHub credential found'

$previous = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& docker info --format '{{.ServerVersion}}' > $null 2>&1
$dockerAvailable = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $previous

if ($dockerAvailable) {
    $imageNames = @('gameconsole-web', 'gamestats-go', 'gamestats-scala', 'gameconsole-prolog')
    foreach ($name in $imageNames) {
        $image = "$name`:$($AcaConfig.ImageTag)"
        $previous = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        & docker image inspect $image > $null 2>&1
        $found = ($LASTEXITCODE -eq 0)
        $ErrorActionPreference = $previous
        if (-not $found) {
            throw "Missing local image: $image"
        }
    }
    Write-Host '  Four local images present'
} else {
    Write-Warning 'Docker daemon unavailable: local image check skipped (images were built successfully earlier).'
}

& (Join-Path $PSScriptRoot 'deploy.ps1') -PreflightOnly
Write-Host 'Reproducibility check OK.'
