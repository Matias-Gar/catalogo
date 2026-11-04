param([string]$ClientJson, [switch]$Renew)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$privateDirectory = Join-Path $projectDirectory '.audit-access\gmail-oauth'
if (-not $ClientJson) {
  $downloads = @(Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'Downloads') -Filter 'client_secret_*.json' -File)
  if ($downloads.Count -ne 1) { throw 'Indica el archivo descargado mediante -ClientJson; no se elegira entre varios clientes.' }
  $ClientJson = $downloads[0].FullName
}
$clientText = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ClientJson).Path)
try { $clientConfiguration = $clientText | ConvertFrom-Json } catch { throw 'El archivo no es un JSON OAuth valido.' }
if (-not $clientConfiguration.installed.client_id -or -not $clientConfiguration.installed.client_secret) {
  throw 'Se necesita el JSON de un cliente OAuth de Aplicacion de escritorio.'
}
New-Item -ItemType Directory -Force -Path $privateDirectory | Out-Null
$privateDirectoryInfo = Get-Item -LiteralPath $privateDirectory
# Read and write only the DACL. Set-Acl with a new descriptor can also request
# audit/owner privileges (SeSecurityPrivilege), which a normal user does not have.
$privateAcl = $privateDirectoryInfo.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)
$privateAcl.SetAccessRuleProtection($true, $false)
$privateUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($existingRule in @($privateAcl.GetAccessRules($true, $false, [System.Security.Principal.SecurityIdentifier]))) {
  $privateAcl.RemoveAccessRuleSpecific($existingRule)
}
$privateAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
  $privateUser, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
$privateDirectoryInfo.SetAccessControl($privateAcl)
$clientPath = Join-Path $privateDirectory 'client.json'
if (Test-Path -LiteralPath $clientPath) {
  if ([IO.File]::ReadAllText($clientPath) -cne $clientText) { throw 'Ya existe otro cliente privado; no se sobrescribira.' }
} else {
  $clientStream = [IO.File]::Open($clientPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
  try { $clientBytes = [Text.UTF8Encoding]::new($false).GetBytes($clientText); $clientStream.Write($clientBytes, 0, $clientBytes.Length) }
  finally { $clientStream.Dispose() }
}
$clientText = $null
$clientConfiguration = $null
if ($Renew) {
  & node (Join-Path $PSScriptRoot 'authorize-catalogo-gmail.mjs') --renew
} else {
  & node (Join-Path $PSScriptRoot 'authorize-catalogo-gmail.mjs')
}
