param([string]$Email = 'garblac01@gmail.com')
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$privateDirectory = Join-Path $projectDirectory '.audit-access'
$credentialPath = Join-Path $privateDirectory 'smtp-credentials.json'
if (Test-Path -LiteralPath $credentialPath) { throw 'Ya existe la configuracion privada; se preserva sin sobrescribirla.' }
if ($Email -notmatch '^[^\s@]+@gmail\.com$') { throw 'Introduce la cuenta Gmail elegida para este proyecto.' }
New-Item -ItemType Directory -Force -Path $privateDirectory | Out-Null
$secureSmtpPassword = Read-Host 'Pega la CONTRASENA DE APLICACION de Google (no se mostrara)' -AsSecureString
$smtpPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSmtpPassword)
try {
  $smtpApplicationPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($smtpPasswordPointer).Replace(' ', '')
  if ($smtpApplicationPassword.Length -ne 16) { throw 'La contrasena de aplicacion debe tener 16 caracteres.' }
  [IO.File]::WriteAllText($credentialPath, '', [Text.UTF8Encoding]::new($false))
  $credentialAcl = New-Object System.Security.AccessControl.FileSecurity
  $credentialAcl.SetAccessRuleProtection($true, $false)
  $credentialUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $credentialAcl.SetOwner($credentialUser)
  $credentialAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($credentialUser, 'FullControl', 'Allow'))
  Set-Acl -LiteralPath $credentialPath -AclObject $credentialAcl
  $smtpConfiguration = @{
    SMTP_HOST = 'smtp.gmail.com'; SMTP_PORT = '587'; SMTP_USER = $Email
    SMTP_PASS = $smtpApplicationPassword; SMTP_ADMIN_EMAIL = $Email; SMTP_SENDER_NAME = 'Garblac'
  }
  [IO.File]::WriteAllText($credentialPath, ($smtpConfiguration | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  Write-Output 'Configuracion privada guardada. No se ha enviado correo ni modificado produccion.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($smtpPasswordPointer)
  $smtpApplicationPassword = $null
  $smtpConfiguration = $null
}
