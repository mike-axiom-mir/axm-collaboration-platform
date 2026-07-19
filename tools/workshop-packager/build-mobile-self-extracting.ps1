param(
  [string]$OutputPath = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = [System.IO.Path]::GetFullPath((Join-Path $ToolDir '..\..'))
$Stamp = Get-Date -Format 'yyyy-MM-dd'
if (-not $OutputPath) {
  $OutputPath = Join-Path $Root "exports\mobile\AXM_WORKSHOP_ANDROID_PRIVATE_$Stamp.sh"
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$OutputDir = Split-Path -Parent $OutputPath
$Stage = Join-Path $env:TEMP ('axm-mobile-stage-' + [Guid]::NewGuid().ToString('N'))
$Zip = Join-Path $env:TEMP ('axm-mobile-payload-' + [Guid]::NewGuid().ToString('N') + '.zip')

function Assert-TempPath([string]$PathValue) {
  $full = [System.IO.Path]::GetFullPath($PathValue)
  $temp = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
  if (-not $full.StartsWith($temp, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Safety refusal: temporary path escaped TEMP: $full"
  }
}

Assert-TempPath $Stage
Assert-TempPath $Zip
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path -LiteralPath $OutputPath) {
  if (-not $Force) { throw "Output exists. Re-run with -Force: $OutputPath" }
  Remove-Item -LiteralPath $OutputPath -Force
}
New-Item -ItemType Directory -Path $Stage | Out-Null

try {
  # Keep the full active Workshop. Only recursive/generated output, logs, and
  # repository plumbing are left behind. node_modules is intentionally kept:
  # this is a device experiment, not a flattened or public-safe demo.
  $excludedDirs = @(
    (Join-Path $Root 'exports'),
    (Join-Path $Root 'logs'),
    (Join-Path $Root '.git')
  )
  $copyArgs = @($Root,$Stage,'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/XJ','/NFL','/NDL','/NJH','/NJS','/NP','/XD') + $excludedDirs
  & robocopy @copyArgs | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Workshop staging failed with robocopy code $LASTEXITCODE" }

  # A transferable private bundle may contain opted-in profile/project state,
  # but never live credentials, screen captures, or machine-local door keys.
  $sensitive = Get-ChildItem -LiteralPath $Stage -Recurse -File -Force | Where-Object {
    $_.Name -ieq 'bridge-token.txt' -or
    $_.Name -ieq 'bridge.log' -or
    $_.Name -ieq '.env' -or $_.Name -like '.env.*' -or
    $_.Extension -in @('.pem','.pfx','.key') -or
    $_.Name -like 'PRIVATE_*' -or
    $_.Name -ieq 'latest-screen.jpg'
  }
  $removed = @()
  foreach ($file in $sensitive) {
    $removed += $file.FullName.Substring($Stage.Length + 1).Replace('\','/')
    Remove-Item -LiteralPath $file.FullName -Force
  }

  $files = Get-ChildItem -LiteralPath $Stage -Recurse -File -Force
  $entries = foreach ($file in $files) {
    [ordered]@{
      path = $file.FullName.Substring($Stage.Length + 1).Replace('\','/')
      bytes = $file.Length
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  $manifest = [ordered]@{
    schema = 'axm.mobile-workshop-package/v1'
    target = 'android-termux-node'
    classification = 'private-local-device-copy'
    created_at = (Get-Date).ToString('o')
    source = 'AXM Workshop'
    full_active_workshop = $true
    file_count = $files.Count + 1
    source_bytes = ($files | Measure-Object Length -Sum).Sum
    preserved = @('modules','tools','games','worlds','museum','assets','shared engines','node_modules','opted-in local state')
    excluded = @('exports (recursive/generated)','logs','.git','live credentials and screen captures')
    removed_sensitive_paths = $removed
    files = $entries
  }
  $manifest | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Stage 'MOBILE_PACKAGE_MANIFEST.json') -Encoding UTF8

  if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
  & tar.exe -a -cf $Zip -C $Stage .
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Zip)) { throw 'ZIP payload creation failed.' }
  $zipItem = Get-Item -LiteralPath $Zip
  if ($zipItem.Length -lt 1MB) { throw 'ZIP payload is unexpectedly small.' }
  $payloadHash = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
  $buildId = "axm-android-$Stamp-$($payloadHash.Substring(0,12))"

  $header = @'
#!/data/data/com.termux/files/usr/bin/bash
set -eu
PAYLOAD_SHA256="__AXM_PAYLOAD_SHA256__"
BUILD_ID="__AXM_BUILD_ID__"
APP_HOME="${AXM_PHONE_HOME:-$HOME/axm-workshop-mobile}"
MARKER='__AXM_PAYLOAD_BELOW__'

fail() { echo "AXM phone install stopped: $*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail 'Node.js is missing. In Termux run: pkg update && pkg install nodejs unzip'
command -v unzip >/dev/null 2>&1 || fail 'unzip is missing. In Termux run: pkg update && pkg install nodejs unzip'
case "$APP_HOME" in "$HOME"/*) ;; *) fail 'AXM_PHONE_HOME must stay inside your Termux home folder' ;; esac

if [ ! -f "$APP_HOME/.axm-mobile-build" ] || [ "$(cat "$APP_HOME/.axm-mobile-build" 2>/dev/null || true)" != "$PAYLOAD_SHA256" ]; then
  payload_line="$(awk -v marker="$MARKER" '$0 == marker { print NR + 1; exit }' "$0")"
  [ -n "$payload_line" ] || fail 'embedded payload marker is missing'
  work="${TMPDIR:-$HOME/.cache}/axm-mobile-install-$$"
  payload="$work/payload.zip"
  incoming="$APP_HOME.installing.$$"
  previous="$APP_HOME.previous"
  mkdir -p "$work"
  tail -n +"$payload_line" "$0" > "$payload"
  actual="$(node -e "const fs=require('fs'),c=require('crypto');process.stdout.write(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$payload")"
  [ "$actual" = "$PAYLOAD_SHA256" ] || fail 'embedded payload hash does not match'
  if [ -x "$APP_HOME/mobile/start-axm-phone.sh" ]; then bash "$APP_HOME/mobile/start-axm-phone.sh" stop >/dev/null 2>&1 || true; fi
  rm -rf "$incoming"
  mkdir -p "$incoming"
  unzip -oq "$payload" -d "$incoming"
  [ -f "$incoming/server.js" ] && [ -f "$incoming/hub/index.html" ] && [ -f "$incoming/mobile/start-axm-phone.sh" ] || fail 'restored Workshop is incomplete'
  if [ -d "$APP_HOME/state" ]; then mkdir -p "$incoming/state"; cp -a "$APP_HOME/state/." "$incoming/state/"; fi
  if [ -d "$APP_HOME/saves" ]; then mkdir -p "$incoming/saves"; cp -a "$APP_HOME/saves/." "$incoming/saves/"; fi
  printf '%s' "$PAYLOAD_SHA256" > "$incoming/.axm-mobile-build"
  rm -rf "$previous"
  if [ -d "$APP_HOME" ]; then mv "$APP_HOME" "$previous"; fi
  mv "$incoming" "$APP_HOME"
  rm -rf "$work"
  echo "AXM phone Workshop installed: $BUILD_ID"
fi

bash "$APP_HOME/mobile/start-axm-phone.sh" "${1:-run}"
exit $?
__AXM_PAYLOAD_BELOW__
'@
  # PowerShell here-strings omit the closing line break. The payload marker
  # must end as its own LF-delimited shell line before binary ZIP bytes begin.
  $header = $header.Replace('__AXM_PAYLOAD_SHA256__', $payloadHash).Replace('__AXM_BUILD_ID__', $buildId).Replace("`r`n", "`n") + "`n"
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  $stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $headerBytes = $utf8.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $input = [System.IO.File]::OpenRead($Zip)
    try { $input.CopyTo($stream) } finally { $input.Dispose() }
  } finally { $stream.Dispose() }

  $result = Get-Item -LiteralPath $OutputPath
  [ordered]@{
    ok = $true
    build_id = $buildId
    output = $result.FullName
    bytes = $result.Length
    payload_sha256 = $payloadHash
    workshop_files = $files.Count + 1
    removed_sensitive_files = $removed.Count
    full_active_workshop = $true
  } | ConvertTo-Json -Compress
}
finally {
  if (Test-Path -LiteralPath $Stage) { Assert-TempPath $Stage; Remove-Item -LiteralPath $Stage -Recurse -Force }
  if (Test-Path -LiteralPath $Zip) { Assert-TempPath $Zip; Remove-Item -LiteralPath $Zip -Force }
}
