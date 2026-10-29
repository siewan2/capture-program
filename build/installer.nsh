!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!ifndef BUILD_UNINSTALLER
  Var CaptureStartupEnabled
!endif

!macro customInit
  StrCpy $CaptureStartupEnabled ${BST_CHECKED}
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/NOSTARTUP" $R1
  ${IfNot} ${Errors}
    StrCpy $CaptureStartupEnabled ${BST_UNCHECKED}
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Var CaptureStartupCheckbox
  Page custom CaptureStartupPage CaptureStartupLeave

Function CaptureStartupPage
  !insertmacro MUI_HEADER_TEXT "Windows 시작 설정" "로그인할 때 Capture Program을 자동으로 실행할 수 있습니다."
  nsDialogs::Create 1018
  Pop $R0
  ${If} $R0 == error
    Abort
  ${EndIf}
  ${NSD_CreateCheckbox} 0 10u 100% 24u "Windows 로그인 시 백그라운드에서 실행"
  Pop $CaptureStartupCheckbox
  ${NSD_SetState} $CaptureStartupCheckbox $CaptureStartupEnabled
  ${NSD_CreateLabel} 0 44u 100% 54u "현재 사용자의 시작프로그램 폴더에 바로가기를 만듭니다. 앱 설정에서 변경할 수 있으며 프로그램 제거 시 함께 삭제됩니다."
  Pop $R0
  nsDialogs::Show
FunctionEnd

Function CaptureStartupLeave
  ${NSD_GetState} $CaptureStartupCheckbox $CaptureStartupEnabled
FunctionEnd
!macroend

!macro customInstall
  SetShellVarContext current
  ${If} $CaptureStartupEnabled == ${BST_CHECKED}
    CreateDirectory "$SMSTARTUP"
    SetOutPath "$INSTDIR"
    CreateShortCut "$SMSTARTUP\Capture Program.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--startup-hidden" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  ${Else}
    Delete "$SMSTARTUP\Capture Program.lnk"
  ${EndIf}
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.siewan.captureprogram"
  StrCmp $R0 '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --startup-hidden' 0 +2
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.siewan.captureprogram"
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    SetShellVarContext current
    Delete "$SMSTARTUP\Capture Program.lnk"
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.siewan.captureprogram"
    StrCmp $R0 '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --startup-hidden' 0 +2
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.siewan.captureprogram"
  ${endIf}
!macroend
