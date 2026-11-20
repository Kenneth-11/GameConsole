param(
    [string]$ImageTag = '',
    [switch]$Keep,
    [switch]$SkipMatch
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
    $ImageTag = $AcaConfig.ImageTag
}

$network = 'gameconsole-aca-test'
$containers = @('aca-test-scala', 'aca-test-prolog', 'aca-test-go', 'aca-test-web')

function Remove-TestEnvironment {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    foreach ($name in $containers) {
        & docker rm -f $name 2>$null | Out-Null
    }
    & docker network rm $network 2>$null | Out-Null
    $ErrorActionPreference = $previous
}

function Wait-Url {
    param([string]$Url, [int]$TimeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ([int]$response.StatusCode -eq 200) { return }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Timeout waiting for $Url"
}

Remove-TestEnvironment
& docker network create $network | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to create test network.' }

try {
    & docker run -d --name aca-test-scala --network $network --network-alias gamestats-scala `
        -p 18081:8081 -e SCALA_SERVICE_PORT=8081 "gamestats-scala:$ImageTag"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to start scala.' }

    & docker run -d --name aca-test-prolog --network $network --network-alias gameconsole-prolog `
        -p 18090:8090 -e PROLOG_PORT=8090 "gameconsole-prolog:$ImageTag"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to start prolog.' }

    & docker run -d --name aca-test-go --network $network --network-alias gamestats-go `
        -p 18080:8080 -e GO_SERVICE_PORT=8080 `
        -e SCALA_SERVICE_URL=http://gamestats-scala:8081 "gamestats-go:$ImageTag"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to start go.' }

    & docker run -d --name aca-test-web --network $network --network-alias gameconsole-web `
        -p 18088:80 `
        -e GAMESTATS_GO_HOST=gamestats-go:8080 `
        -e GAMECONSOLE_PROLOG_HOST=gameconsole-prolog:8090 "gameconsole-web:$ImageTag"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to start web.' }

    Wait-Url -Url 'http://localhost:18081/health'
    Wait-Url -Url 'http://localhost:18090/health'
    Wait-Url -Url 'http://localhost:18080/health'
    Wait-Url -Url 'http://localhost:18088/healthz'
    Write-Host 'All four containers are healthy.'

    & (Join-Path $PSScriptRoot 'smoke.ps1') -BaseUrl 'http://localhost:18088' -SkipMatch:$SkipMatch
    if ($LASTEXITCODE -ne 0) { throw 'Smoke checks failed.' }
} finally {
    if (-not $Keep) {
        Remove-TestEnvironment
        Write-Host 'Test containers and network removed.'
    } else {
        Write-Host 'Test containers left running (use -Keep only for debugging).'
    }
}
