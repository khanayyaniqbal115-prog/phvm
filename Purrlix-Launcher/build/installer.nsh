; Ask on uninstall whether to remove all Purrlix Launcher data.
; Skipped when the uninstaller runs as part of an update.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Also delete all Purrlix Launcher data?$\r$\n$\r$\nThis removes your profiles, worlds, mods, screenshots and saved accounts. This cannot be undone." /SD IDNO IDNO phoenix_keep_data
      RMDir /r "$APPDATA\.phoenix-launcher"
      RMDir /r "$APPDATA\phoenix-launcher"
      RMDir /r "$APPDATA\Phoenix Launcher"
    phoenix_keep_data:
  ${endIf}
!macroend
