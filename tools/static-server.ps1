param(
  [int]$Port = 4173,
  [string]$DistRoot = "dist",
  [string]$PublicRoot = "public",
  [string]$SdkRoot = "sdk",
  [string]$ApiProxyTarget = "http://127.0.0.1:9541"
)

$ErrorActionPreference = "Stop"

function Resolve-RootPath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

function Get-ContentType([string]$PathValue) {
  switch ([System.IO.Path]::GetExtension($PathValue).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "text/javascript; charset=utf-8" }
    ".mjs" { return "text/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".gif" { return "image/gif" }
    ".svg" { return "image/svg+xml" }
    ".ico" { return "image/x-icon" }
    ".wasm" { return "application/wasm" }
    ".moc3" { return "application/octet-stream" }
    ".cdi3" { return "application/json; charset=utf-8" }
    ".physics3" { return "application/json; charset=utf-8" }
    ".motion3" { return "application/json; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

function Join-SafePath([string]$Root, [string]$RequestPath) {
  $relative = $RequestPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $combined = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))

  if (-not $combined.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $combined
}

function Find-FileForRequest([string]$RequestPath) {
  $pathOnly = $RequestPath.Split("?")[0].Split("#")[0]
  if ([string]::IsNullOrWhiteSpace($pathOnly) -or $pathOnly -eq "/") {
    $pathOnly = "/index.html"
  }

  $decodedPath = [System.Uri]::UnescapeDataString($pathOnly)
  if ($decodedPath.StartsWith("/sdk/", [System.StringComparison]::OrdinalIgnoreCase)) {
    $sdkRelativePath = $decodedPath.Substring(5)
    $sdkCandidate = Join-SafePath $script:SdkRootFull $sdkRelativePath
    if ($sdkCandidate -and (Test-Path -LiteralPath $sdkCandidate -PathType Leaf)) {
      return $sdkCandidate
    }
  }

  foreach ($root in @($script:DistRootFull, $script:PublicRootFull)) {
    $candidate = Join-SafePath $root $decodedPath
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return $candidate
    }
  }

  return Join-Path $script:DistRootFull "index.html"
}

function Write-Response($Client, [int]$StatusCode, [string]$StatusText, [byte[]]$Body, [string]$ContentType, [bool]$HeadOnly) {
  $stream = $Client.GetStream()
  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Cache-Control: no-cache",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $stream.Write($Body, 0, $Body.Length)
  }
}

function Write-ProxiedResponse($Client, [string]$RequestPath, [bool]$HeadOnly) {
  if (-not $script:ApiProxyTargetValue) {
    return $false
  }

  $pathOnly = $RequestPath.Split("?")[0]
  if (-not $pathOnly.StartsWith("/api/public", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $false
  }

  $targetUrl = $script:ApiProxyTargetValue.TrimEnd("/") + $RequestPath
  try {
    $request = [System.Net.HttpWebRequest]::Create($targetUrl)
    $request.Method = "GET"
    $request.Accept = "application/json"
    $request.Timeout = 10000
    $response = $request.GetResponse()
    try {
      $memory = [System.IO.MemoryStream]::new()
      $response.GetResponseStream().CopyTo($memory)
      $bodyBytes = $memory.ToArray()
      $contentType = if ($response.ContentType) { $response.ContentType } else { "application/json; charset=utf-8" }
      Write-Response $Client ([int]$response.StatusCode) $response.StatusDescription $bodyBytes $contentType $HeadOnly
    } finally {
      $response.Close()
    }
  } catch [System.Net.WebException] {
    $response = $_.Exception.Response
    if ($response) {
      try {
        $memory = [System.IO.MemoryStream]::new()
        $response.GetResponseStream().CopyTo($memory)
        $bodyBytes = $memory.ToArray()
        $contentType = if ($response.ContentType) { $response.ContentType } else { "application/json; charset=utf-8" }
        Write-Response $Client ([int]$response.StatusCode) $response.StatusDescription $bodyBytes $contentType $HeadOnly
      } finally {
        $response.Close()
      }
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("{""error"":""Alert Converger API proxy is unavailable""}")
      Write-Response $Client 502 "Bad Gateway" $body "application/json; charset=utf-8" $HeadOnly
    }
  }

  return $true
}

$script:DistRootFull = Resolve-RootPath $DistRoot
$script:PublicRootFull = Resolve-RootPath $PublicRoot
$script:SdkRootFull = Resolve-RootPath $SdkRoot
$script:ApiProxyTargetValue = $ApiProxyTarget

if (-not (Test-Path -LiteralPath (Join-Path $script:DistRootFull "index.html") -PathType Leaf)) {
  throw "Missing dist/index.html. Build the frontend first or provide a valid DistRoot."
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Static server running at http://127.0.0.1:$Port/"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()
      $buffer = New-Object byte[] 8192
      $count = $stream.Read($buffer, 0, $buffer.Length)
      if ($count -le 0) {
        continue
      }

      $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
      $requestLine = ($requestText -split "`r?`n")[0]
      $parts = $requestLine -split " "
      if ($parts.Length -lt 2) {
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      $target = $parts[1]
      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
        Write-Response $client 405 "Method Not Allowed" $body "text/plain; charset=utf-8" $false
        continue
      }

      if (Write-ProxiedResponse $client $target ($method -eq "HEAD")) {
        continue
      }

      $filePath = Find-FileForRequest $target
      if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Write-Response $client 404 "Not Found" $body "text/plain; charset=utf-8" ($method -eq "HEAD")
        continue
      }

      $bodyBytes = [System.IO.File]::ReadAllBytes($filePath)
      Write-Response $client 200 "OK" $bodyBytes (Get-ContentType $filePath) ($method -eq "HEAD")
    } catch {
      try {
        $body = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
        Write-Response $client 500 "Internal Server Error" $body "text/plain; charset=utf-8" $false
      } catch {
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
