!macro customUnInstall
  ${ifNot} ${isUpdated}
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.siewan.captureprogram"
    StrCmp $R0 '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --startup-hidden' 0 +2
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.siewan.captureprogram"
  ${endIf}
!macroend
