param(
    [switch]$Execute,
    [string]$ImageTag = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
    $ImageTag = $AcaConfig.ImageTag
}

$user = $env:GHCR_USERNAME
$pat = $env:GHCR_PAT
if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($pat)) {
    throw 'Set GHCR_USERNAME and GHCR_PAT in the environment before publishing.'
}

$images = @('gameconsole-web', 'gamestats-go', 'gamestats-scala', 'gameconsole-prolog')
$targets = foreach ($name in $images) {
    [pscustomobject]@{
        Local  = "$name`:$ImageTag"
        Remote = "$($AcaConfig.RegistryServer)/$($AcaConfig.GitHubOwner)/$name`:$ImageTag"
    }
}

Write-Host "GHCR publish plan (tag $ImageTag):"
Write-Host "  docker login $($AcaConfig.RegistryServer) -u $user --password-stdin"
$targets | Format-Table -AutoSize

if (-not $Execute) {
    Write-Host 'Dry run only. Re-run with -Execute to publish.'
    return
}

$pat | & docker login $AcaConfig.RegistryServer -u $user --password-stdin
if ($LASTEXITCODE -ne 0) { throw 'docker login failed.' }

foreach ($target in $targets) {
    & docker tag $target.Local $target.Remote
    if ($LASTEXITCODE -ne 0) { throw "Failed to tag $($target.Remote)." }
    & docker push $target.Remote
    if ($LASTEXITCODE -ne 0) { throw "Failed to push $($target.Remote)." }
}

Write-Host 'Images published. Set each package visibility to Public in GitHub if desired.'
