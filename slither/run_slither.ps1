$ErrorActionPreference = "Continue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$remap = "@openzeppelin=$root\node_modules\@openzeppelin"

$contracts = @(
    @{ Path = "contracts\vulnerable\InsecureVault.sol"; Json = "insecure_vault_report.json"; Detectors = "reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events" },
    @{ Path = "contracts\secure\SecureVault.sol";      Json = "secure_vault_report.json";   Detectors = "reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events" },
    @{ Path = "contracts\secure\MutexVault.sol";       Json = "mutex_vault_report.json";    Detectors = "reentrancy-eth,reentrancy-no-eth" }
)

foreach ($c in $contracts) {
    $sol = Join-Path $root $c.Path
    $json = Join-Path $PSScriptRoot $c.Json
    Write-Host ""
    Write-Host "=== Running Slither on $(Split-Path $sol -Leaf) ==="
    if (Test-Path -LiteralPath $json) { Remove-Item -LiteralPath $json -Force }
    slither "$sol" `
        --solc-remaps "$remap" `
        --solc-disable-warnings `
        --detect $c.Detectors `
        --json "$json" `
        --print human-summary
}

Write-Host ""
Write-Host "=== Slither analysis complete. See JSON reports in slither/ directory ==="
