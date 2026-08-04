# Build Ad 01 â€” Provider Recruitment (15s vertical + 1:1)
# Usage: powershell -File brand\ads\build-ad-01.ps1
# Looks for assets in brand\ads\ad-01-assets\:
#   scene1.* mechanic hands  | scene2.* detailing | scene3.* jumper cables
#   scene4.* (optional aerial video or 4th image; falls back to scene1 crop)
#   music.mp3 (Citadel)      | missing files -> labeled placeholder slates
param([switch]$Draft)

# 'Continue' on purpose: ffmpeg writes progress to stderr, which PS 5.1 turns
# into terminating NativeCommandErrors under 'Stop' when stderr is redirected.
# Failures are caught via $LASTEXITCODE checks after each ffmpeg call.
$ErrorActionPreference = 'Continue'
$ff = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe | Select-Object -First 1 -ExpandProperty FullName
$root   = Split-Path $PSScriptRoot -Parent | Split-Path -Parent   # repo root
$ads    = Join-Path $root 'brand\ads'
$assets = Join-Path $ads 'ad-01-assets'
$work   = Join-Path $assets '_work'
$logo   = Join-Path $root 'brand\social-media-kit\Tuveloz Logo.png'
New-Item -ItemType Directory -Force $work | Out-Null

$font   = 'C\:/Windows/Fonts/arialbd.ttf'
$orange = '0xFF6A00'
$black  = '0x050505'

# scene text (U+2019 apostrophe avoids drawtext escaping)
$scenes = @(
    @{ n=1; text="Tired of working`nsomebody else%s route?".Replace('%s',([char]0x2019)+'s') },
    @{ n=2; text='Set your own prices.' },
    @{ n=3; text='Pick your own jobs.' },
    @{ n=4; text="Keep 100% of your price.`nJoin free." }
)

function Find-Asset($n) {
    Get-ChildItem $assets -File -ErrorAction SilentlyContinue |
        Where-Object { $_.BaseName -eq "scene$n" -and $_.Extension -match '\.(jpe?g|png|webp|mp4|mov)$' } |
        Select-Object -First 1
}

function Render-Scene($n, $text, $w, $h, $out) {
    $asset = Find-Asset $n
    $tf = Join-Path $work "text$n.txt"
    [System.IO.File]::WriteAllText($tf, $text, (New-Object System.Text.UTF8Encoding $false))
    $tfEsc = $tf.Replace('\','/').Replace(':','\:')
    $dt = "drawtext=fontfile='$font':textfile='$tfEsc':expansion=none:fontcolor=white:fontsize=$([int]($w*0.074)):line_spacing=14:borderw=3:bordercolor=black@0.85:box=1:boxcolor=${black}@0.35:boxborderw=22:x=(w-text_w)/2:y=h*0.68"
    if ($null -eq $asset) {
        # placeholder slate
        $slate = "drawtext=fontfile='$font':text='[ARTLIST ASSET $n PENDING]':fontcolor=${orange}:fontsize=$([int]($w*0.045)):x=(w-text_w)/2:y=h*0.45"
        & $ff -y -f lavfi -i "color=c=0x1a1a1a:s=${w}x${h}:d=3:r=30" -vf "$slate,$dt" -c:v libx264 -pix_fmt yuv420p -t 3 $out
    } elseif ($asset.Extension -match '\.(mp4|mov)$') {
        & $ff -y -i $asset.FullName -vf "scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},$dt" -c:v libx264 -pix_fmt yuv420p -t 3 -r 30 -an $out
    } else {
        # Ken Burns slow push-in on a still
        $kb = "scale=$($w*2):$($h*2):force_original_aspect_ratio=increase,crop=$($w*2):$($h*2),zoompan=z='1+0.04*on/90':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=90:s=${w}x${h}:fps=30"
        & $ff -y -i $asset.FullName -vf "$kb,$dt" -c:v libx264 -pix_fmt yuv420p -t 3 $out
    }
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on scene $n" }
}

function Render-EndCard($w, $h, $out) {
    # logo + URL centered as one group; logo PNG is 1560x500
    $logoW = if ($h -gt $w) { [int]($w*0.76) } else { [int]($w*0.60) }
    $logoH = [int]($logoW * 500 / 1560)
    $urlSize = [int]($w*0.058)
    $gap = [int]($h*0.055)
    $logoY = [int](($h - ($logoH + $gap + $urlSize)) / 2)
    $urlY = $logoY + $logoH + $gap
    $t1 = "drawtext=fontfile='$font':text='tuveloz.com/join':fontcolor=${orange}:fontsize=${urlSize}:x=(w-text_w)/2:y=$urlY"
    & $ff -y -f lavfi -i "color=c=${black}:s=${w}x${h}:d=3:r=30" -i $logo -filter_complex "[1:v]scale=${logoW}:${logoH}[lg];[0:v][lg]overlay=(W-w)/2:${logoY},$t1,fade=t=in:st=0:d=0.4" -c:v libx264 -pix_fmt yuv420p -t 3 $out
    if ($LASTEXITCODE -ne 0) { throw 'ffmpeg failed on end card' }
}

function Build($w, $h, $tag) {
    $parts = @()
    foreach ($s in $scenes) {
        $p = Join-Path $work "s$($s.n)-$tag.mp4"
        Render-Scene $s.n $s.text $w $h $p
        $parts += $p
    }
    $end = Join-Path $work "s5-$tag.mp4"
    Render-EndCard $w $h $end
    $parts += $end

    $list = Join-Path $work "concat-$tag.txt"
    ($parts | ForEach-Object { "file '$($_.Replace('\','/'))'" }) | Set-Content $list -Encoding ascii
    $silent = Join-Path $ads "ad-01-$tag.mp4"
    & $ff -y -f concat -safe 0 -i $list -c:v libx264 -pix_fmt yuv420p -r 30 $silent
    if ($LASTEXITCODE -ne 0) { throw "concat failed ($tag)" }

    $music = Join-Path $assets 'music.mp3'
    if (Test-Path $music) {
        $final = Join-Path $ads "ad-01-$tag-audio.mp4"
        & $ff -y -i $silent -i $music -map 0:v -map 1:a -af 'afade=t=out:st=13.5:d=1.5' -c:v copy -c:a aac -b:a 192k -shortest $final
        if ($LASTEXITCODE -ne 0) { throw "audio mux failed ($tag)" }
        Move-Item $final $silent -Force
    }
    Write-Host "Built $silent"
}

Build 1080 1920 '9x16'
Build 1080 1080 '1x1'

