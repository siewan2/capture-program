$ErrorActionPreference = 'Stop'
$archive = Get-ChildItem -Path "$PSScriptRoot/../dist/Capture-Program-*-Windows-x64.zip" | Select-Object -First 1
if (!$archive) { throw 'Portable ZIP not found' }
$extractDir = Join-Path $env:TEMP ('Capture Program ZIP Test ' + [guid]::NewGuid())
try {
  Expand-Archive -Path $archive.FullName -DestinationPath $extractDir
  $executable = Join-Path $extractDir 'Capture Program.exe'
  if (!(Test-Path $executable)) { throw 'Executable not found in portable ZIP' }
  $env:CAPTURE_TEST_EXE = $executable
  node "$PSScriptRoot/desktop-smoke.cjs"
  if ($LASTEXITCODE -ne 0) { throw 'Extracted portable application test failed' }
  Write-Host 'PASS portable ZIP extraction and actual application interactions.'
} finally {
  Remove-Item Env:CAPTURE_TEST_EXE -ErrorAction SilentlyContinue
  if (Test-Path $extractDir) { Remove-Item -Path $extractDir -Recurse -Force }
}
