param(
    [switch]$Execute,
    [string]$Revision = '',
    [switch]$DeleteResources,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

function Invoke-Step {
    param(
        [string]$Description,
        [string[]]$AzArgs
    )
    if (-not $Execute) {
        Write-Host "[PLAN] $Description"
        Write-Host "  az $($AzArgs -join ' ')"
        return
    }
    Write-Host "[RUN] $Description"
    & az @AzArgs
    if ($LASTEXITCODE -ne 0) { throw "az failed: $Description" }
}

if ($DeleteResources) {
    if (-not $Force) {
        throw 'Full teardown requires -DeleteResources -Force.'
    }
    Write-Host 'Full teardown plan (destructive).'
    $teardown = @($AcaConfig.Apps | Sort-Object { $_.Name -eq 'gameconsole-web' } -Descending)
    foreach ($app in $teardown) {
        Invoke-Step -Description "Delete app $($app.Name)" -AzArgs @('containerapp', 'delete', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--yes')
    }
    Invoke-Step -Description 'Delete environment' -AzArgs @('containerapp', 'env', 'delete', '-n', $AcaConfig.EnvironmentName, '-g', $AcaConfig.ResourceGroup, '--yes')
    Invoke-Step -Description 'Delete workspace' -AzArgs @('monitor', 'log-analytics', 'workspace', 'delete', '-g', $AcaConfig.ResourceGroup, '-n', $AcaConfig.WorkspaceName, '--yes')
    Write-Host 'Teardown complete.'
    return
}

Write-Host 'Revision rollback plan (non-destructive).'
foreach ($app in $AcaConfig.Apps) {
    $raw = & az containerapp revision list -n $app.Name -g $AcaConfig.ResourceGroup -o json
    if ($LASTEXITCODE -ne 0) { throw "Failed to list revisions for $($app.Name)." }
    $revisions = $raw | ConvertFrom-Json
    $current = ($revisions | Where-Object { $_.properties.active -eq $true } | Select-Object -First 1).name
    $target = if ($Revision) {
        $Revision
    } else {
        ($revisions | Where-Object { $_.name -ne $current -and $_.properties.revisionState -ne 'Failed' } | Select-Object -First 1).name
    }
    if (-not $target) {
        Write-Warning "No rollback target found for $($app.Name); skipped."
        continue
    }
    if (-not $Revision) {
        Write-Host "  $($app.Name): active=$current -> rollback=$target"
    }
    if ($current) {
        Invoke-Step -Description "Deactivate revision $current on $($app.Name)" -AzArgs @('containerapp', 'revision', 'deactivate', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--revision', $current)
    }
    Invoke-Step -Description "Activate revision $target on $($app.Name)" -AzArgs @('containerapp', 'revision', 'activate', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--revision', $target)
}

if (-not $Execute) {
    Write-Host 'Dry run only. Re-run with -Execute to apply rollback.'
}
