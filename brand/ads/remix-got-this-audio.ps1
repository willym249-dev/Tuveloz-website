# Relift the sound bed on an already-cut "I've Got This" video.
#
# For cuts assembled outside this repo. The picture is left untouched - only the
# audio track is replaced, using the same three effects and the same measured
# levels as build-got-this-ep1-v2.ps1.
#
# The supplied 7s cut came in around 20dB under: the arc peaked at -21dB where it
# should be the loudest event in the ad, and the ambient bed sat at -57dB mean,
# which is inaudible on a phone speaker. Targets here match the verified build:
#   bed  ~ -37dB mean      arc  0dB peak      gap  -91dB      hit ~ -11dB peak
#
# Usage:
#   powershell -File brand\ads\remix-got-this-audio.ps1 -In "<video>" [-Cut1 2.633] [-Cut2 4.233]
#
# Cut points default to the detected values for the current cut. Re-detect with:
#   ffmpeg -i <video> -vf "select='gt(scene,0.3)',showinfo" -f null -
param(
    [Parameter(Mandatory=$true)][string]$In,
    [string]$Out,
    [double]$Cut1 = 2.633333,   # setup -> reaction
    [double]$Cut2 = 4.233333,   # reaction -> end card
    [int]$AmbientGain = 10,
    [double]$ArcLen = 0.55,     # delivered arc crackles ~1.58s; only the transient is wanted
    [double]$HitDelay = 0.25    # card appears silent, then the hit lands
)

$ErrorActionPreference = 'Continue'
$ff = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
$ffprobe = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffprobe.exe -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty FullName
if (-not $ff) { throw 'ffmpeg not found. Install with: winget install Gyan.FFmpeg' }
if (-not (Test-Path $In)) { throw "Input not found: $In" }

$root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
$sfx  = Join-Path $root 'brand\ads\got-this-assets\ep1-battery'
$amb  = Join-Path $sfx 'sfx-ambient.mp3'
$arc  = Join-Path $sfx 'sfx-arc-crack.mp3'
$hit  = Join-Path $sfx 'sfx-logo-hit.mp3'
foreach ($f in @($amb,$arc,$hit)) { if (-not (Test-Path $f)) { throw "Missing effect: $f" } }

if (-not $Out) {
    $Out = Join-Path (Split-Path $In -Parent) ((Get-Item $In).BaseName + '-audiofix' + (Get-Item $In).Extension)
}
$dur = [double](& $ffprobe -v error -show_entries format=duration -of csv=p=0 $In)

$dArc = [int]($Cut1 * 1000)
$dHit = [int](($Cut2 + $HitDelay) * 1000)
$fade = [math]::Round($ArcLen - 0.12, 2)

# Ambient is cut dead at the arc, never faded - the abrupt stop is the joke.
# normalize=0 because amix otherwise scales every input by 1/inputs, which would
# undo the gains set here. Limiter catches the arc peak.
$fc = "[1:a]atrim=0:$Cut1,asetpts=PTS-STARTPTS,volume=${AmbientGain}dB[amb];" +
      "[2:a]atrim=0:$ArcLen,asetpts=PTS-STARTPTS,afade=t=out:st=${fade}:d=0.12,adelay=${dArc}|${dArc}[arc];" +
      "[3:a]adelay=${dHit}|${dHit},volume=0.7[hit];" +
      "[4:a][amb][arc][hit]amix=inputs=4:duration=longest:normalize=0,alimiter=limit=0.95[a]"

& $ff -y -i $In -i $amb -i $arc -i $hit -f lavfi -i anullsrc=r=48000:cl=stereo `
      -filter_complex $fc -map 0:v -map '[a]' -c:v copy -c:a aac -b:a 192k -t $dur $Out
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg failed on remix' }

Write-Host "Wrote $Out" -ForegroundColor Green
Write-Host "  picture copied untouched; audio rebuilt at cuts $Cut1 / $Cut2" -ForegroundColor DarkGray
