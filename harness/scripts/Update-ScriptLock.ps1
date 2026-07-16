<#
.SYNOPSIS
Regenerate scripts.lock.json — PLUGIN SOURCE ONLY.

.DESCRIPTION
Hashes every .ps1/.psm1/.psd1 in this directory (normalized LF/UTF-8, same
normalization every consumer uses) and rewrites scripts.lock.json atomically.

This is the ONLY script that does not verify itself against the lock before
running — it is the lock's author. It must ONLY ever run in the harness plugin
source repo. Vendored copies in product repos must never regenerate their lock:
a mismatched vendored file means RE-VENDOR, not re-lock (re-locking would bless
tampered or stale bytes, defeating the fail-closed design).
#>
[CmdletBinding()]
param(
    [string]$BundleVersion = '1.0.0'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'HarnessDispatch.psm1') -Force

# Guard: refuse to run outside the plugin source (vendored copies live elsewhere).
$pluginManifest = Join-Path (Split-Path -Parent $PSScriptRoot) '.claude-plugin/plugin.json'
if (-not (Test-Path -LiteralPath $pluginManifest)) {
    throw "NOT-PLUGIN-SOURCE: $pluginManifest not found. Update-ScriptLock.ps1 runs ONLY in the harness plugin source. A vendored copy with a bad hash must be re-vendored, never re-locked."
}

$files = [ordered]@{}
Get-ChildItem -LiteralPath $PSScriptRoot -File |
    Where-Object { $_.Extension -in '.ps1', '.psm1', '.psd1' } |
    Sort-Object Name |
    ForEach-Object { $files[$_.Name] = Get-FileBodyHash -Path $_.FullName }

$lock = [ordered]@{
    bundleVersion = $BundleVersion
    generatedUtc  = (Get-Date).ToUniversalTime().ToString('o')
    normalization = 'LF + UTF-8 (no BOM), SHA-256 lowercase hex'
    files         = $files
}
Write-JsonAtomic -Path (Join-Path $PSScriptRoot 'scripts.lock.json') -Object $lock

[pscustomobject]@{
    verdict = 'FORM-COMPLETE — merit, truth, adequacy and ambiguity not assessed'
    locked  = @($files.Keys)
    lock    = (Join-Path $PSScriptRoot 'scripts.lock.json')
}
