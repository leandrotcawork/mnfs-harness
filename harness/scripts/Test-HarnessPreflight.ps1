<#
.SYNOPSIS
Standalone dispatch preflight (HARNESS-CORE §4 deterministic lane, tool J).

.DESCRIPTION
Validates FORM of the dispatch environment before any tokens are spent:
codex CLI present, scripts bundle hash-verified, roles table loadable, registry
appendable, scratchpad writable, git worktree clean-enough signals surfaced.

Verdict ceiling is FORM-COMPLETE — this script proves the machinery can run,
never that the dispatch content is correct, adequate, or unambiguous.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Scratchpad,
    [Parameter(Mandatory)][string]$Registry,
    [string]$RepoRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'HarnessDispatch.psm1') -Force
Assert-ScriptLock -ScriptPath $PSCommandPath

$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check {
    param([string]$Name, [bool]$Ok, [string]$Detail)
    $checks.Add([pscustomobject]@{ check = $Name; ok = $Ok; detail = $Detail })
}

# codex CLI
$codexCmd = Get-Command codex -ErrorAction SilentlyContinue
if ($codexCmd) {
    $v = (& codex --version 2>&1 | Out-String).Trim()
    Add-Check 'codex-cli' $true $v
} else {
    Add-Check 'codex-cli' $false 'codex not on PATH — operator: run /codex:setup'
}

# scripts bundle lock (all files listed, all hashes match)
$lockPath = Join-Path $PSScriptRoot 'scripts.lock.json'
try {
    $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    $bad = @()
    foreach ($p in $lock.files.PSObject.Properties) {
        $fp = Join-Path $PSScriptRoot $p.Name
        if (-not (Test-Path -LiteralPath $fp)) { $bad += "$($p.Name): MISSING"; continue }
        $h = Get-FileBodyHash -Path $fp
        if ($h -ne $p.Value) { $bad += "$($p.Name): hash mismatch" }
    }
    Add-Check 'scripts-lock' ($bad.Count -eq 0) $(if ($bad.Count) { $bad -join '; ' } else { "all $(@($lock.files.PSObject.Properties).Count) files verified" })
} catch {
    Add-Check 'scripts-lock' $false "lock unreadable: $_"
}

# roles table
try {
    $roles = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'roles.psd1')
    $malformed = @($roles.Keys | Where-Object { -not ($roles[$_].Model -and $roles[$_].Effort -and $roles[$_].Path) })
    Add-Check 'roles-table' ($malformed.Count -eq 0) $(if ($malformed.Count) { "malformed: $($malformed -join ', ')" } else { "$(@($roles.Keys).Count) roles loaded" })
} catch {
    Add-Check 'roles-table' $false "roles.psd1 unreadable: $_"
}

# scratchpad writable
try {
    if (-not (Test-Path -LiteralPath $Scratchpad)) { New-Item -ItemType Directory -Force -Path $Scratchpad | Out-Null }
    $probe = Join-Path $Scratchpad ".preflight-probe-$([guid]::NewGuid().ToString('N').Substring(0,6))"
    'x' | Set-Content -LiteralPath $probe
    Remove-Item -LiteralPath $probe -Force
    Add-Check 'scratchpad' $true $Scratchpad
} catch {
    Add-Check 'scratchpad' $false "not writable: $Scratchpad"
}

# registry appendable (round-trip a cancelled probe event)
try {
    $probeId = New-DispatchId -Role 'preflight-probe'
    Add-DispatchEvent -Registry $Registry -DispatchId $probeId -State 'cancelled' -Data @{ note = 'preflight write probe' } | Out-Null
    $back = Get-DispatchState -Registry $Registry -DispatchId $probeId
    Add-Check 'registry' ($null -ne $back -and $back.state -eq 'cancelled') $Registry
} catch {
    Add-Check 'registry' $false "append failed: $_"
}

# git signals (advisory — surfaced, not judged)
try {
    $indexLock = Join-Path $RepoRoot '.git/index.lock'
    $lockPresent = Test-Path -LiteralPath $indexLock
    Add-Check 'git-index-lock' (-not $lockPresent) $(if ($lockPresent) { "$indexLock EXISTS — commits will be denied (F-A); investigate before dispatching a writer" } else { 'absent' })
    $status = (& git -C $RepoRoot status --porcelain 2>&1 | Out-String).Trim()
    $dirtyCount = if ($status) { @($status -split "`n").Count } else { 0 }
    Add-Check 'git-dirty-paths' $true "$dirtyCount uncommitted path(s) — advisory only; reconcile against write_set"
} catch {
    Add-Check 'git-signals' $false "git probe failed: $_"
}

$failed = @($checks | Where-Object { -not $_.ok })
$result = [pscustomobject]@{
    verdict = if ($failed.Count -eq 0) {
        'FORM-COMPLETE — merit, truth, adequacy and ambiguity not assessed'
    } else {
        "PREFLIGHT-FAIL — $($failed.Count) check(s) failed: $($failed.check -join ', ')"
    }
    checks  = $checks
    utc     = (Get-Date).ToUniversalTime().ToString('o')
}
$result | ConvertTo-Json -Depth 5
if ($failed.Count -gt 0) { exit 1 }
