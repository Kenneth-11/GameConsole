param(
    [switch]$Execute,
    [switch]$PreflightOnly,
    [string]$ImageTag = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
    $ImageTag = $AcaConfig.ImageTag
}

function Invoke-AzStep {
    param(
        [string]$Description,
        [string[]]$AzArgs,
        [string[]]$DisplayArgs,
        [switch]$Capture
    )

    if (-not $Execute) {
        Write-Host "[PLAN] $Description"
        Write-Host "  az $($DisplayArgs -join ' ')"
        if ($Capture) { return '<value>' }
        return $null
    }

    Write-Host "[RUN] $Description"
    $result = & az @AzArgs
    if ($LASTEXITCODE -ne 0) { throw "az failed: $Description" }
    if ($Capture) { return ($result | Out-String).Trim() }
    return $result
}

function Get-AzResourceName {
    param([string[]]$AzArgs)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $output = & az @AzArgs 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($code -ne 0) { return '' }
    return (($output | Out-String).Trim())
}

$sub = (& az account show --query id -o tsv).Trim()
if ($sub -ne $AcaConfig.SubscriptionId) {
    throw "Active subscription $sub does not match $($AcaConfig.SubscriptionId)."
}
$rgLocation = (& az group show --name $AcaConfig.ResourceGroup --query location -o tsv).Trim()
if ($rgLocation -ne $AcaConfig.Location) {
    throw "Resource group location $rgLocation is not $($AcaConfig.Location)."
}
foreach ($provider in @('Microsoft.App', 'Microsoft.OperationalInsights')) {
    $state = (& az provider show --namespace $provider --query registrationState -o tsv).Trim()
    if ($state -ne 'Registered') { throw "$provider is $state." }
}
$allowed = (& az policy assignment show --name sys.regionrestriction `
    --query parameters.listOfAllowedLocations.value -o json | ConvertFrom-Json)
if ($allowed -notcontains $AcaConfig.Location) {
    throw "$($AcaConfig.Location) is not allowed by sys.regionrestriction."
}
$usages = (& az containerapp list-usages --location $AcaConfig.Location -o json | ConvertFrom-Json).value
$envQuota = $usages | Where-Object { $_.name.value -eq 'ManagedEnvironmentCount' }
if (-not $envQuota -or $envQuota.limit -le $envQuota.currentValue) {
    throw 'No Managed Environment Count quota available.'
}

$collisions = @()
if (Get-AzResourceName -AzArgs @('monitor', 'log-analytics', 'workspace', 'show', '-g', $AcaConfig.ResourceGroup, '-n', $AcaConfig.WorkspaceName, '--query', 'name', '-o', 'tsv')) {
    $collisions += "workspace/$($AcaConfig.WorkspaceName)"
}
if (Get-AzResourceName -AzArgs @('containerapp', 'env', 'show', '-n', $AcaConfig.EnvironmentName, '-g', $AcaConfig.ResourceGroup, '--query', 'name', '-o', 'tsv')) {
    $collisions += "environment/$($AcaConfig.EnvironmentName)"
}
foreach ($app in $AcaConfig.Apps) {
    if (Get-AzResourceName -AzArgs @('containerapp', 'show', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--query', 'name', '-o', 'tsv')) {
        $collisions += "app/$($app.Name)"
    }
}
if ($collisions.Count -gt 0) {
    throw "Refusing to create: resources already exist -> $($collisions -join ', '). Review or roll back before retrying."
}

Write-Host "Preflight OK: subscription, RG, providers, policy, quota ($($envQuota.currentValue)/$($envQuota.limit)) and no name collisions."
if ($PreflightOnly) { return }

$ghcrUser = $env:GHCR_USERNAME
$ghcrPat = $env:GHCR_PAT
if ($Execute -and ([string]::IsNullOrWhiteSpace($ghcrUser) -or [string]::IsNullOrWhiteSpace($ghcrPat))) {
    throw 'Set GHCR_USERNAME and GHCR_PAT before -Execute.'
}
if (-not $Execute) {
    $ghcrUser = '<GHCR_USERNAME>'
    $ghcrPat = '<GHCR_PAT>'
}

Write-Host "Deployment plan for tag '$ImageTag'."
Write-Host 'Secret values are redacted from plan output.'

$environmentId = "/subscriptions/$($AcaConfig.SubscriptionId)/resourceGroups/$($AcaConfig.ResourceGroup)/providers/Microsoft.App/managedEnvironments/$($AcaConfig.EnvironmentName)"
$appsDir = Join-Path $PSScriptRoot 'apps'

$wsArgs = @(
    'monitor', 'log-analytics', 'workspace', 'create',
    '-g', $AcaConfig.ResourceGroup,
    '-n', $AcaConfig.WorkspaceName,
    '-l', $AcaConfig.Location,
    '--retention-time', [string]$AcaConfig.WorkspaceRetention,
    '-o', 'json'
)
$wsJson = Invoke-AzStep -Description 'Create Log Analytics workspace' -AzArgs $wsArgs -DisplayArgs $wsArgs -Capture

if ($Execute) {
    $wsId = ($wsJson | ConvertFrom-Json).customerId
    $wsKey = (& az monitor log-analytics workspace get-shared-keys `
        -g $AcaConfig.ResourceGroup -n $AcaConfig.WorkspaceName `
        --query primarySharedKey -o tsv).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Failed to read workspace key.' }
} else {
    $wsId = '<workspace-customer-id>'
    $wsKey = '<workspace-key>'
}

$envArgs = @(
    'containerapp', 'env', 'create',
    '-n', $AcaConfig.EnvironmentName,
    '-g', $AcaConfig.ResourceGroup,
    '-l', $AcaConfig.Location,
    '--logs-destination', 'log-analytics',
    '--logs-workspace-id', $wsId,
    '--logs-workspace-key', $wsKey
)
$envDisplay = @(
    'containerapp', 'env', 'create',
    '-n', $AcaConfig.EnvironmentName,
    '-g', $AcaConfig.ResourceGroup,
    '-l', $AcaConfig.Location,
    '--logs-destination', 'log-analytics',
    '--logs-workspace-id', '<workspace-customer-id>',
    '--logs-workspace-key', '<workspace-key>'
)
Invoke-AzStep -Description 'Create Container Apps environment' -AzArgs $envArgs -DisplayArgs $envDisplay | Out-Null

foreach ($app in $AcaConfig.Apps) {
    $manifestPath = Join-Path $appsDir "$($app.Name).yaml"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        throw "Missing manifest: $manifestPath"
    }
    $image = "$($AcaConfig.RegistryServer)/$($AcaConfig.GitHubOwner)/$($app.Image):$ImageTag"

    if ($Execute) {
        $yaml = Get-Content -LiteralPath $manifestPath -Raw
        $yaml = $yaml.Replace('__IMAGE__', $image)
        $yaml = $yaml.Replace('__GHCR_USERNAME__', $ghcrUser)
        $yaml = $yaml.Replace('__GHCR_PAT__', $ghcrPat)
        $yaml = $yaml.Replace('__ENVIRONMENT_ID__', $environmentId)

        $tempYaml = Join-Path ([System.IO.Path]::GetTempPath()) "aca-$($app.Name)-$([guid]::NewGuid().ToString('N')).yaml"
        try {
            Set-Content -LiteralPath $tempYaml -Value $yaml -Encoding Ascii
            $acl = Get-Acl -LiteralPath $tempYaml
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
                'FullControl',
                'Allow'
            )
            $acl.SetAccessRule($rule)
            $acl.SetAccessRuleProtection($true, $false)
            Set-Acl -LiteralPath $tempYaml -AclObject $acl

            Invoke-AzStep `
                -Description "Create container app $($app.Name) with health probes" `
                -AzArgs @('containerapp', 'create', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--yaml', $tempYaml) `
                -DisplayArgs @('containerapp', 'create', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--yaml', '<secure-temp-manifest>') | Out-Null
        } finally {
            Remove-Item -LiteralPath $tempYaml -Force -ErrorAction SilentlyContinue
        }
    } else {
        Invoke-AzStep `
            -Description "Create container app $($app.Name) with health probes" `
            -AzArgs @() `
            -DisplayArgs @('containerapp', 'create', '-n', $app.Name, '-g', $AcaConfig.ResourceGroup, '--yaml', "apps/$($app.Name).yaml") | Out-Null
    }

    $fqdnArgs = @(
        'containerapp', 'show', '-n', $app.Name,
        '-g', $AcaConfig.ResourceGroup,
        '--query', 'properties.configuration.ingress.fqdn', '-o', 'tsv'
    )
    $fqdn = Invoke-AzStep -Description "Read FQDN for $($app.Name)" -AzArgs $fqdnArgs -DisplayArgs $fqdnArgs -Capture
    if ($Execute) {
        Write-Host "  $($app.Name): https://$fqdn"
    }
}

if (-not $Execute) {
    Write-Host 'Dry run only. Re-run with -Execute to create resources.'
}
