$AcaConfig = @{
    SubscriptionId        = '4d617f88-c16b-4c91-8cce-52c8c0863e33'
    ResourceGroup         = 'gameconsole-rg'
    Location              = 'francecentral'
    EnvironmentName       = 'gameconsole-aca-env'
    WorkspaceName         = 'gameconsole-logs'
    WorkspaceRetention    = 30
    RegistryServer        = 'ghcr.io'
    GitHubOwner           = 'kenneth-11'
    ImageTag              = 'aca-preview-1'
    StatsRef              = 'da412e6'

    ConsoleRoot           = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    StatsRoot             = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\GameStats')).Path

    Apps                  = @(
        @{
            Name       = 'gamestats-scala'
            Image      = 'gamestats-scala'
            Port       = 8081
            Cpu        = '0.5'
            Memory     = '1.0Gi'
            Min        = 1
            Max        = 1
            Ingress    = 'internal'
            Env        = @('SCALA_SERVICE_PORT=8081')
        },
        @{
            Name       = 'gameconsole-prolog'
            Image      = 'gameconsole-prolog'
            Port       = 8090
            Cpu        = '0.25'
            Memory     = '0.5Gi'
            Min        = 0
            Max        = 3
            Ingress    = 'internal'
            Env        = @('PROLOG_PORT=8090')
        },
        @{
            Name       = 'gamestats-go'
            Image      = 'gamestats-go'
            Port       = 8080
            Cpu        = '0.25'
            Memory     = '0.5Gi'
            Min        = 1
            Max        = 1
            Ingress    = 'internal'
            Env        = @(
                'GO_SERVICE_PORT=8080'
                'SCALA_SERVICE_URL=http://gamestats-scala'
            )
        },
        @{
            Name       = 'gameconsole-web'
            Image      = 'gameconsole-web'
            Port       = 80
            Cpu        = '0.25'
            Memory     = '0.5Gi'
            Min        = 1
            Max        = 3
            Ingress    = 'external'
            Env        = @()
        }
    )
}
