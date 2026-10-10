[Setup]
AppId=AutoAcceptLite
AppName=AutoAccept Lite
AppVersion=1.1.0
AppVerName=AutoAccept Lite 1.1.0
AppPublisher=AutoAccept Lite
DefaultDirName={localappdata}\Programs\AutoAcceptLite
DefaultGroupName=AutoAccept Lite
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
MinVersion=10.0
OutputDir=dist
OutputBaseFilename=AutoAcceptLite-Kurulum-1.1.0
SetupIconFile=assets\AutoAcceptLite.ico
UninstallDisplayIcon={app}\AutoAcceptLite.exe
WizardStyle=modern
WizardImageFile=assets\wizard.png
WizardSmallImageFile=assets\logo-small.png
WizardImageStretch=yes
DisableWelcomePage=no
DisableProgramGroupPage=yes
Compression=lzma2
SolidCompression=yes
SetupLogging=yes
UninstallLogging=yes
CloseApplications=yes
CloseApplicationsFilter=AutoAcceptLite.exe,node.exe
RestartApplications=no
LicenseFile=payload\app\LICENSE
InfoBeforeFile=Kullanim.txt

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; Flags: checkedonce

[Files]
Source: "payload\app\*"; DestDir: "{app}\app"; Excludes: "config.json"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "payload\app\config.json"; DestDir: "{app}\app"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "payload\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "payload\AutoAcceptLite.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\AutoAcceptLite-Kaldir.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\LICENSE.upstream"; DestDir: "{app}"; Flags: ignoreversion
Source: "payload\runtime\LICENSE.node.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\AutoAcceptLite.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "Kullanim.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\AutoAccept Lite"; Filename: "{app}\AutoAcceptLite.exe"; WorkingDir: "{app}"; IconFilename: "{app}\AutoAcceptLite.ico"
Name: "{group}\AutoAccept Lite - Kaldır"; Filename: "{uninstallexe}"; IconFilename: "{app}\AutoAcceptLite.ico"
Name: "{userdesktop}\AutoAccept Lite"; Filename: "{app}\AutoAcceptLite.exe"; WorkingDir: "{app}"; IconFilename: "{app}\AutoAcceptLite.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\AutoAcceptLite.exe"; Description: "AutoAccept Lite'ı başlat"; Flags: nowait postinstall skipifsilent unchecked

[Messages]
WelcomeLabel2=Antigravity için otomatik onay aracı bilgisayarınıza kurulacak.%n%nNode.js ve gerekli bağımlılıklar pakete dahildir. Ayrı bir Node.js kurulumu gerekmez.
FinishedLabel=AutoAccept Lite kurulumu tamamlandı.%n%nAntigravity'yi açın, ardından AutoAccept Lite masaüstü kısayolunu kullanın. Uygulama bildirim alanında çalışır.
