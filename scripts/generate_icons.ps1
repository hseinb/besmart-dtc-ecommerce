Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\public\icon-1024.png"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source icon not found at $srcPath"
    exit 1
}

$src = New-Object System.Drawing.Bitmap($srcPath)
Write-Host "Loaded B's Mart master icon: $($src.Width)x$($src.Height) ($($src.PixelFormat))"

# Helper: Resize bitmap with 32-bit ARGB (for Android launcher icons)
function Resize-ImageArgb($image, [int]$targetWidth, [int]$targetHeight) {
    $dest = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(255, 4, 50, 78))
    $g.DrawImage($image, 0, 0, $targetWidth, $targetHeight)
    $g.Dispose()
    return $dest
}

# Helper: Resize bitmap with 24-bit RGB (ZERO alpha channel - required by Apple App Store Connect)
function Resize-ImageRgb24($image, [int]$targetWidth, [int]$targetHeight) {
    $dest = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(255, 4, 50, 78))
    $g.DrawImage($image, 0, 0, $targetWidth, $targetHeight)
    $g.Dispose()
    return $dest
}

# Helper: Generate round launcher icon
function Create-Round-Icon($sourceImg, [int]$targetSize) {
    $dest = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $targetSize, $targetSize)
    $g.SetClip($path)
    $g.DrawImage($sourceImg, 0, 0, $targetSize, $targetSize)
    $path.Dispose()
    $g.Dispose()
    return $dest
}

# Helper: Generate Android adaptive foreground centered within the 66.7% safe zone on #04324E background
function Create-Adaptive-Foreground($sourceImg, [int]$canvasSize) {
    $dest = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(255, 4, 50, 78))

    $scale = 0.72
    $drawW = [int]($canvasSize * $scale)
    $drawH = [int]($canvasSize * $scale)
    $drawX = [int](($canvasSize - $drawW) / 2)
    $drawY = [int](($canvasSize - $drawH) / 2)

    $g.DrawImage($sourceImg, $drawX, $drawY, $drawW, $drawH)
    $g.Dispose()
    return $dest
}

# 1. Android Mipmap Densities
$densities = @(
    @{ name = "mdpi"; legacy = 48; fg = 108 },
    @{ name = "hdpi"; legacy = 72; fg = 162 },
    @{ name = "xhdpi"; legacy = 96; fg = 216 },
    @{ name = "xxhdpi"; legacy = 144; fg = 324 },
    @{ name = "xxxhdpi"; legacy = 192; fg = 432 }
)

Write-Host "`nGenerating Android Mipmap Icons..."
foreach ($d in $densities) {
    $dir = Join-Path $PSScriptRoot "..\android\app\src\main\res\mipmap-$($d.name)"
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null

    $legacySquare = Resize-ImageArgb $src $d.legacy $d.legacy
    $legacySquare.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $legacySquare.Dispose()

    $legacyRound = Create-Round-Icon $src $d.legacy
    $legacyRound.Save("$dir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $legacyRound.Dispose()

    $adaptFg = Create-Adaptive-Foreground $src $d.fg
    $adaptFg.Save("$dir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $adaptFg.Dispose()

    Write-Host "  -> [$($d.name)] ic_launcher: $($d.legacy)x$($d.legacy), foreground: $($d.fg)x$($d.fg)"
}

# 2. Android Adaptive Background Color (#04324E)
$valuesDir = Join-Path $PSScriptRoot "..\android\app\src\main\res\values"
[System.IO.Directory]::CreateDirectory($valuesDir) | Out-Null
$bgXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#04324E</color>
</resources>
"@
Set-Content -Path "$valuesDir\ic_launcher_background.xml" -Value $bgXml -Encoding UTF8
Write-Host "  -> Updated android/app/src/main/res/values/ic_launcher_background.xml (#04324E)"

# 3. iOS App Icon (1024x1024 24-bit RGB - zero alpha)
Write-Host "`nGenerating iOS AppIcon (1024x1024 24-bit RGB)..."
$iosDir = Join-Path $PSScriptRoot "..\ios\App\App\Assets.xcassets\AppIcon.appiconset"
[System.IO.Directory]::CreateDirectory($iosDir) | Out-Null
$iosIcon = Resize-ImageRgb24 $src 1024 1024
$iosIcon.Save("$iosDir\AppIcon-512@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
$iosIcon.Dispose()
Write-Host "  -> iOS AppIcon-512@2x.png generated (1024x1024 Format24bppRgb)!"

# 4. Google Play Store 512x512 Master Assets
Write-Host "`nGenerating Google Play Store 512x512 Master Asset..."
$storeDir = Join-Path $PSScriptRoot "..\store_assets"
[System.IO.Directory]::CreateDirectory($storeDir) | Out-Null
$playStoreIcon = Resize-ImageRgb24 $src 512 512
$playStoreIcon.Save("$storeDir\play_store_512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$playStoreIcon.Save((Join-Path $PSScriptRoot "..\android\app\src\main\play_store_512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$playStoreIcon.Dispose()
Write-Host "  -> store_assets/play_store_512.png and android/app/src/main/play_store_512.png saved!"

$src.Dispose()
Write-Host "`nAll B's Mart platform icons generated successfully!"
