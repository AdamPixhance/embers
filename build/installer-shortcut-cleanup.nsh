!macro customInstall
	SetShellVarContext current

	Delete "$SMPROGRAMS\Embers.lnk"
	Delete "$SMPROGRAMS\Run Embers.lnk"
	Delete "$SMPROGRAMS\Embers\Embers.lnk"
	Delete "$SMPROGRAMS\Embers\Run Embers.lnk"
	RMDir "$SMPROGRAMS\Embers"

	Delete "$DESKTOP\Embers.lnk"
	Delete "$DESKTOP\Run Embers.lnk"

	SetShellVarContext all

	Delete "$SMPROGRAMS\Embers.lnk"
	Delete "$SMPROGRAMS\Run Embers.lnk"
	Delete "$SMPROGRAMS\Embers\Embers.lnk"
	Delete "$SMPROGRAMS\Embers\Run Embers.lnk"
	RMDir "$SMPROGRAMS\Embers"

	Delete "$DESKTOP\Embers.lnk"
	Delete "$DESKTOP\Run Embers.lnk"

	SetShellVarContext current
!macroend
