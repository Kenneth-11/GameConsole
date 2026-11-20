param(
    [string]$ImageTag = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
    $ImageTag = $AcaConfig.ImageTag
}

$statsHead = (& git -C $AcaConfig.StatsRoot rev-parse HEAD).Trim()
if (-not $statsHead.StartsWith($AcaConfig.StatsRef)) {
    throw "GameStats HEAD is $statsHead; expected $($AcaConfig.StatsRef)."
}
$statsDirty = & git -C $AcaConfig.StatsRoot status --porcelain
if ($statsDirty) {
    throw 'GameStats working tree is not clean; refusing to build from a dirty tree.'
}

$images = @(
    [pscustomobject]@{ Name = 'gameconsole-web'; Tag = "gameconsole-web:$ImageTag" }
    [pscustomobject]@{ Name = 'gamestats-go'; Tag = "gamestats-go:$ImageTag" }
    [pscustomobject]@{ Name = 'gamestats-scala'; Tag = "gamestats-scala:$ImageTag" }
    [pscustomobject]@{ Name = 'gameconsole-prolog'; Tag = "gameconsole-prolog:$ImageTag" }
)

Write-Host "Building four images with tag '$ImageTag' (local only)."

$webDockerfile = Join-Path $PSScriptRoot 'web.Dockerfile'
& docker build -f $webDockerfile -t $images[0].Tag $AcaConfig.ConsoleRoot
if ($LASTEXITCODE -ne 0) { throw 'Failed to build gameconsole-web.' }

& docker build -t $images[1].Tag (Join-Path $AcaConfig.StatsRoot 'go-service')
if ($LASTEXITCODE -ne 0) { throw 'Failed to build gamestats-go.' }

& docker build -t $images[2].Tag (Join-Path $AcaConfig.StatsRoot 'scala-service')
if ($LASTEXITCODE -ne 0) { throw 'Failed to build gamestats-scala.' }

& docker build -t $images[3].Tag (Join-Path $AcaConfig.ConsoleRoot 'prolog')
if ($LASTEXITCODE -ne 0) { throw 'Failed to build gameconsole-prolog.' }

$images | Select-Object Name, Tag | Format-Table -AutoSize
