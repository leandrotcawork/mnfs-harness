<#
.SYNOPSIS
Mechanical dispatch-prompt assembler (HARNESS-CORE §4 canonical architecture).

.DESCRIPTION
Assembles a worker dispatch prompt as: stamped fixed pack -> bindings -> card -> addenda.
Stamps the pack with version + body-sha256, writes the prompt UTF-8 (no BOM), and records
an `assembled` event in the dispatch registry. Assembly NEVER produces a complete ledger
row — only Invoke-CodexDispatch promotes the dispatch to `started` (a registry row stuck at
`assembled` is a phantom dispatch and must be investigated, not certified).

Pack file contract: first line is the stamp template, e.g.
  impl-pack v1.0.0 · milestone <id> · body-sha256 <hash>
`<id>` and `<hash>` are replaced at assembly; the hash covers everything AFTER the first
line, normalized to LF/UTF-8. The pack body is frozen per milestone; mid-milestone changes
travel as dated addenda files (appended last, own hash, never edits to the pack).

.OUTPUTS
FORM-COMPLETE verdict object with dispatchId, prompt path, hashes. Never "all checks passed".
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PackFile,
    [Parameter(Mandatory)][string]$BindingsFile,
    [Parameter(Mandatory)][string]$CardFile,
    [Parameter(Mandatory)][string]$OutFile,
    [Parameter(Mandatory)][string]$Registry,
    [Parameter(Mandatory)][string]$Milestone,
    [Parameter(Mandatory)][string]$Role,
    [string[]]$AddendumFile = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'HarnessDispatch.psm1') -Force
Assert-ScriptLock -ScriptPath $PSCommandPath

foreach ($f in @($PackFile, $BindingsFile, $CardFile) + $AddendumFile) {
    if (-not (Test-Path -LiteralPath $f)) { throw "INPUT-MISSING: $f" }
    if ((Get-Item -LiteralPath $f).Length -eq 0) { throw "INPUT-EMPTY: $f" }
}

# --- stamp the pack -----------------------------------------------------------
$packRaw = Get-Content -LiteralPath $PackFile -Raw
$packLines = $packRaw -replace "`r`n", "`n" -split "`n"
$stampTemplate = $packLines[0]
if ($stampTemplate -notmatch 'body-sha256') {
    throw "PACK-MALFORMED: first line of $PackFile must be the stamp template containing 'body-sha256' (got: '$stampTemplate')"
}
$packBody = ($packLines | Select-Object -Skip 1) -join "`n"
$bodyHash = Get-NormalizedBodyHash -Text $packBody
$packVersion = if ($stampTemplate -match 'v(\d+\.\d+\.\d+)') { $Matches[1] } else { 'unversioned' }
$stamp = $stampTemplate -replace '<id>', $Milestone -replace '<hash>', $bodyHash

# --- assemble: fixed pack -> bindings -> card -> addenda (variable last) -------
$sections = [System.Collections.Generic.List[string]]::new()
$sections.Add($stamp + "`n" + $packBody)
$sections.Add((Get-Content -LiteralPath $BindingsFile -Raw))
$sections.Add((Get-Content -LiteralPath $CardFile -Raw))

$addenda = @()
foreach ($a in $AddendumFile) {
    $aText = Get-Content -LiteralPath $a -Raw
    $aHash = Get-NormalizedBodyHash -Text $aText
    $addenda += [ordered]@{ file = (Split-Path -Leaf $a); sha256 = $aHash }
    $sections.Add("--- ADDENDUM $(Split-Path -Leaf $a) · body-sha256 $aHash ---`n" + $aText)
}

$prompt = (($sections | ForEach-Object { ($_ -replace "`r`n", "`n").TrimEnd() }) -join "`n`n") + "`n"
$outDir = Split-Path -Parent $OutFile
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
[System.IO.File]::WriteAllText($OutFile, $prompt, [System.Text.UTF8Encoding]::new($false))
$promptHash = Get-NormalizedBodyHash -Text $prompt

# --- register: assembled (NOT started — dispatcher promotes) -------------------
$dispatchId = New-DispatchId -Role $Role
Add-DispatchEvent -Registry $Registry -DispatchId $dispatchId -State 'assembled' -Data @{
    role            = $Role
    milestone       = $Milestone
    promptFile      = (Resolve-Path -LiteralPath $OutFile).Path
    promptSha256    = $promptHash
    packVersion     = $packVersion
    packBodySha256  = $bodyHash
    addenda         = $addenda
} | Out-Null

[pscustomobject]@{
    verdict        = 'FORM-COMPLETE — merit, truth, adequacy and ambiguity not assessed'
    dispatchId     = $dispatchId
    promptFile     = $OutFile
    promptSha256   = $promptHash
    packVersion    = $packVersion
    packBodySha256 = $bodyHash
    addenda        = $addenda
    state          = 'assembled'
    next           = "Invoke-CodexDispatch.ps1 -DispatchId $dispatchId -Role $Role -PromptFile `"$OutFile`" -Registry `"$Registry`" -Scratchpad <dir>"
}
