# HarnessDispatch.psm1 — shared primitives for the deterministic dispatch lane
# (HARNESS-CORE §4 "Deterministic lane"). Scripts report FORM only; the module
# never emits "all checks passed" — the maximum verdict is FORM-COMPLETE.

Set-StrictMode -Version Latest

function Get-NormalizedBodyHash {
    <# Hash of text normalized to LF + UTF-8 (no BOM). CRLF/LF differences must
       never fabricate drift (field risk: pwsh version CRLF quirks). #>
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text)
    $normalized = $Text -replace "`r`n", "`n"
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($normalized)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
    } finally { $sha.Dispose() }
}

function Get-FileBodyHash {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { throw "Get-FileBodyHash: file not found: $Path" }
    Get-NormalizedBodyHash -Text (Get-Content -LiteralPath $Path -Raw)
}

function Assert-ScriptLock {
    <# Content-addressed fail-closed check (HARNESS-CORE §4): every entrypoint
       verifies its own bytes against scripts.lock.json before acting.
       Mismatch = the vendored copy is stale or locally edited — REFUSE to run. #>
    param([Parameter(Mandatory)][string]$ScriptPath)
    $dir = Split-Path -Parent $ScriptPath
    $lockPath = Join-Path $dir 'scripts.lock.json'
    if (-not (Test-Path -LiteralPath $lockPath)) {
        throw "LOCK-MISSING: $lockPath not found. Refusing to run unverified harness script. Re-vendor the scripts bundle from the harness plugin (or run Update-ScriptLock.ps1 in the plugin source only)."
    }
    $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    $name = Split-Path -Leaf $ScriptPath
    $entry = $lock.files.PSObject.Properties[$name]
    $expected = if ($entry) { $entry.Value } else { $null }
    if (-not $expected) {
        throw "LOCK-UNLISTED: $name has no entry in scripts.lock.json. Refusing to run. Re-vendor the bundle."
    }
    $actual = Get-FileBodyHash -Path $ScriptPath
    if ($actual -ne $expected) {
        throw "LOCK-MISMATCH: $name hash $actual != locked $expected. This copy is stale or edited in place. FAIL CLOSED — re-vendor the scripts bundle from the harness plugin; an in-flight milestone keeps its pinned bundle."
    }
    # Also verify this module itself when called from an entrypoint.
    $moduleName = 'HarnessDispatch.psm1'
    if ($name -ne $moduleName) {
        $modulePath = Join-Path $dir $moduleName
        $moduleEntry = $lock.files.PSObject.Properties[$moduleName]
        $moduleExpected = if ($moduleEntry) { $moduleEntry.Value } else { $null }
        if (-not $moduleExpected) { throw "LOCK-UNLISTED: $moduleName missing from lock." }
        $moduleActual = Get-FileBodyHash -Path $modulePath
        if ($moduleActual -ne $moduleExpected) {
            throw "LOCK-MISMATCH: $moduleName hash $moduleActual != locked $moduleExpected. FAIL CLOSED — re-vendor."
        }
    }
}

function New-DispatchId {
    param([Parameter(Mandatory)][string]$Role)
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $suffix = ([guid]::NewGuid().ToString('N')).Substring(0, 8)
    "$Role-$stamp-$suffix"
}

function Add-DispatchEvent {
    <# Dispatch registry (HARNESS-CORE §4): append-only JSONL event stream.
       Current state of a dispatch = its LAST event. Events are immutable.
       Lifecycle: assembled -> started -> completed | failed | cancelled. #>
    param(
        [Parameter(Mandatory)][string]$Registry,
        [Parameter(Mandatory)][string]$DispatchId,
        [Parameter(Mandatory)][ValidateSet('assembled', 'started', 'completed', 'failed', 'cancelled')][string]$State,
        [hashtable]$Data = @{}
    )
    $event = [ordered]@{
        dispatchId = $DispatchId
        state      = $State
        utc        = (Get-Date).ToUniversalTime().ToString('o')
    }
    foreach ($k in $Data.Keys) { $event[$k] = $Data[$k] }
    $line = ($event | ConvertTo-Json -Compress -Depth 6)
    $dir = Split-Path -Parent $Registry
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    # Atomic-enough append: exclusive open with retry (concurrent chips share a registry).
    $attempts = 0
    while ($true) {
        try {
            $fs = [System.IO.File]::Open($Registry, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
            try {
                $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($line + "`n")
                $fs.Write($bytes, 0, $bytes.Length)
            } finally { $fs.Dispose() }
            break
        } catch [System.IO.IOException] {
            $attempts++
            if ($attempts -ge 10) { throw "REGISTRY-LOCKED: could not append to $Registry after $attempts attempts: $_" }
            Start-Sleep -Milliseconds (50 * $attempts)
        }
    }
    $DispatchId
}

function Get-DispatchState {
    <# Last event per dispatchId (or one dispatch if -DispatchId given). #>
    param(
        [Parameter(Mandatory)][string]$Registry,
        [string]$DispatchId
    )
    if (-not (Test-Path -LiteralPath $Registry)) { return @() }
    # Open sharing ReadWrite: writers hold the file with an append handle and a
    # plain ReadAllLines would hit a sharing violation mid-dispatch.
    $fs = [System.IO.File]::Open($Registry, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        $reader = [System.IO.StreamReader]::new($fs, [System.Text.UTF8Encoding]::new($false))
        $content = $reader.ReadToEnd()
    } finally { $fs.Dispose() }
    $latest = [ordered]@{}
    $lineNo = 0
    foreach ($line in ($content -split "`n")) {
        $lineNo++
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $evt = $line | ConvertFrom-Json }
        catch {
            # One torn/corrupt line must not brick every reader of the registry.
            Write-Warning "Get-DispatchState: skipping malformed registry line $lineNo in $Registry"
            continue
        }
        $latest[$evt.dispatchId] = $evt
    }
    if ($DispatchId) { return $latest[$DispatchId] }
    return $latest.Values
}

function Write-JsonAtomic {
    <# Receipt files are written whole-or-not-at-all: temp + rename. #>
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)]$Object
    )
    $tmp = "$Path.tmp-$([guid]::NewGuid().ToString('N').Substring(0,6))"
    $json = $Object | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

Export-ModuleMember -Function Get-NormalizedBodyHash, Get-FileBodyHash, Assert-ScriptLock, New-DispatchId, Add-DispatchEvent, Get-DispatchState, Write-JsonAtomic
