$ErrorActionPreference = 'Stop'
$installer = Get-ChildItem -Path "$PSScriptRoot/../dist/Capture-Program-Setup-*.exe" | Select-Object -First 1
if (!$installer) { throw 'Installer not found' }
$installDir = Join-Path $env:TEMP ('Capture Program Install Test ' + [guid]::NewGuid())
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$entryName = 'com.siewan.captureprogram'
try {
  $process = Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$installDir" -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
  $executable = Join-Path $installDir 'Capture Program.exe'
  if (!(Test-Path $executable)) { throw 'Installed executable not found' }
  $env:CAPTURE_TEST_EXE = $executable
  node "$PSScriptRoot/desktop-smoke.cjs"
  if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' }
  # Verify that uninstall removes only this installation's automatic-start entry.
  New-Item -Path $runKey -Force | Out-Null
  New-ItemProperty -Path $runKey -Name $entryName -PropertyType String -Value ('"' + $executable + '" --startup-hidden') -Force | Out-Null
  $uninstaller = Get-ChildItem -Path $installDir -Filter 'Uninstall*.exe' | Select-Object -First 1
  if (!$uninstaller) { throw 'Uninstaller not found' }
  $removed = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S _?=$installDir" -Wait -PassThru
  if ($removed.ExitCode -ne 0) { throw "Uninstall failed: $($removed.ExitCode)" }
  if (Test-Path $executable) { throw 'Uninstall left the application executable behind' }
  $remaining = Get-ItemProperty -Path $runKey -Name $entryName -ErrorAction SilentlyContinue
  if ($null -ne $remaining) { throw 'Uninstall left the login startup entry behind' }
  Write-Host 'PASS installer, installed application interactions, startup cleanup and uninstaller.'
} finally {
  Remove-Item Env:CAPTURE_TEST_EXE -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path $runKey -Name $entryName -ErrorAction SilentlyContinue
  if (Test-Path $installDir) { Remove-Item -Path $installDir -Recurse -Force }
}
