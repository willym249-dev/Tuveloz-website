# Build "I've Got This" series - AI short video ads (9:16 + 1:1)
# Spec: docs/marketing/TUVELOZ MARKETING IDEAS.md | Runbook: docs/marketing/HIGGSFIELD_RUNBOOK.md
#
# Usage:
#   powershell -File brand\ads\build-got-this.ps1              # all episodes, pre-launch card
#   powershell -File brand\ads\build-got-this.ps1 -Episode 1   # one episode
#   powershell -File brand\ads\build-got-this.ps1 -Launch      # launch-phase end card
#
# Assets in brand\ads\got-this-assets\:
#   shared\plate.mp4                 - lakefront establishing shot (all episodes)
#   ep1-battery\clipB.mp4 clipC.mp4  - confidence / consequence
#   ep2-diagnostics\ ep3-oil\ ep4-carwash\   - same pair each
#   <ep>\vo.mp3                      - optional flat voiceover, plays over end card
#   Missing files render as labeled placeholder slates so the cut is still viewable.
param(
    [ValidateRange(1,4)][int]$Episode = 0,
    [switch]$Launch
)

# 'Continue' on purpose: ffmpeg writes progress to stderr, which PS 5.1 turns
# into terminating NativeCommandErrors under 'Stop'. Failures are caught via
# $LASTEXITCODE checks after each ffmpeg call.
$ErrorActionPreference = 'Continue'
$ff = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
if (-not $ff) { throw 'ffmpeg not found. Install with: winget install Gyan.FFmpeg' }
$ffprobe = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffprobe.exe -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty FullName

function Get-AudioSeconds($path) {
    if (-not $ffprobe -or -not (Test-Path $path)) { return 0 }
    $d = & $ffprobe -v error -show_entries format=duration -of csv=p=0 $path
    if ($d) { return [double]$d } else { return 0 }
}

$root   = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
$ads    = Join-Path $root 'brand\ads'
$assets = Join-Path $ads 'got-this-assets'
$work   = Join-Path $assets '_work'
# Transparent lockup rendered from brand\tuveloz-lockup-horizontal.svg. The
# social-media-kit PNG has a baked-in black box that reads as a rectangle on the
# navy plate. Regenerate with:
#   node -e "require('sharp')('brand/tuveloz-lockup-horizontal.svg',{density:300}).resize(1560,500,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile('brand/ads/got-this-assets/shared/lockup.png')"
$logo   = Join-Path $assets 'shared\lockup.png'
if (-not (Test-Path $logo)) { $logo = Join-Path $root 'brand\social-media-kit\Tuveloz Logo.png' }
New-Item -ItemType Directory -Force $work | Out-Null

$font   = 'C\:/Windows/Fonts/arialbd.ttf'
$navy   = '0x07182D'   # brand navy - end card plate
$orange = '0xFF6A00'   # brand orange - URL

# Beat timings (seconds). Ep2 is the quiet one: longer hold on C, no scream.
# `d` is an optional fourth beat - a button after the consequence. Ep1 uses it for
# the documentary stare + forehead-on-horn folded in from the retired Reel 2.
# Set d=0 (or omit clipD.mp4) and the beat is skipped entirely.
$EPISODES = @(
    @{ n=1; dir='ep1-battery';     tag='battery';     plate=2.0; b=2.8; c=1.6; d=2.2 },
    @{ n=2; dir='ep2-diagnostics'; tag='diagnostics'; plate=2.0; b=3.0; c=2.5; d=0 },
    @{ n=3; dir='ep3-oil';         tag='oil';         plate=2.5; b=3.0; c=2.0; d=0 },
    @{ n=4; dir='ep4-carwash';     tag='carwash';     plate=2.0; b=2.5; c=2.3; d=0 }
)

# Brand sign-off. Same line every episode - it matches the lockup, ad-01, and
# ad-02, and a consistent tagline is the whole point of a series.
$VO_LINE = 'Customer choice. Provider freedom.'

# End card audio layout:
#   [LEAD] punchline (optional, per-episode) [GAP] tagline (shared) [TAIL]
# The card auto-extends to fit whatever VO exists. Minimum 3s so it still reads
# as a card when there's no audio at all.
$CARD_MIN  = 3.0
$CARD_LEAD = 0.12   # beat after the hard cut before the first word
$CARD_GAP  = 0.35   # between punchline and tagline
$CARD_TAIL = 0.55   # silence before the video ends

# Default is the PROVIDER phase - the only messaging allowed pre-launch, and the
# reason this series is runnable today (see docs/marketing/TUVELOZ MARKETING IDEAS.md).
# Fee copy is fixed: providers keep 100%, customers pay 5%. NEVER "keep 95%".
if ($Launch) { $phaseUrl = 'tuveloz.com';      $phaseLine = 'Post your job. Compare quotes. Get moving.' }
else         { $phaseUrl = 'tuveloz.com/join'; $phaseLine = 'Keep 100% of your price. Join free.' }

function Find-Clip($dir, $name) {
    if (-not (Test-Path $dir)) { return $null }
    Get-ChildItem $dir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.BaseName -eq $name -and $_.Extension -match '\.(mp4|mov|jpe?g|png|webp)$' } |
        Select-Object -First 1
}

# Every segment is normalised to the same v+a shape so concat never desyncs.
function Render-Segment($asset, $label, $w, $h, $dur, $out) {
    $sc = "scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,format=yuv420p"
    if ($null -eq $asset) {
        $slate = "drawtext=fontfile='$font':text='[$label PENDING]':fontcolor=${orange}:fontsize=$([int]($w*0.045)):x=(w-text_w)/2:y=(h-text_h)/2"
        & $ff -y -f lavfi -i "color=c=0x141414:s=${w}x${h}:r=30" -f lavfi -i anullsrc=r=48000:cl=stereo `
              -vf $slate -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    } elseif ($asset.Extension -match '\.(mp4|mov)$') {
        # Keep source audio when present (the scream lives here); synthesise silence when not.
        & $ff -y -i $asset.FullName -f lavfi -i anullsrc=r=48000:cl=stereo `
              -filter_complex "[0:v]$sc[v];[0:a?]anull[a0];[1:a]anull[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]" `
              -map '[v]' -map '[a]' -c:v libx264 -c:a aac -ar 48000 -t $dur $out 2>$null
        if ($LASTEXITCODE -ne 0) {
            # Source had no audio stream - retry with synthesised silence only.
            & $ff -y -i $asset.FullName -f lavfi -i anullsrc=r=48000:cl=stereo `
                  -vf $sc -map 0:v -map 1:a -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
        }
    } else {
        # Still image - hold it. No Ken Burns: these clips are already animated,
        # and drifting motion under a hard cut reads as sloppy.
        & $ff -y -loop 1 -i $asset.FullName -f lavfi -i anullsrc=r=48000:cl=stereo `
              -vf $sc -map 0:v -map 1:a -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    }
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on segment: $label" }
}

function Render-EndCard($w, $h, $out, $dur) {
    # Logo PNG is 1560x500. Logo + URL + phase line centred as one stack.
    if ($h -gt $w) { $logoW = [int]($w*0.72) } else { $logoW = [int]($w*0.56) }
    $logoH   = [int]($logoW * 500 / 1560)
    $urlSize = [int]($w*0.055)
    $subSize = [int]($w*0.038)
    $gap     = [int]($h*0.045)
    $gap2    = [int]($h*0.022)
    $stack   = $logoH + $gap + $urlSize + $gap2 + $subSize
    $logoY   = [int](($h - $stack) / 2)
    $urlY    = $logoY + $logoH + $gap
    $subY    = $urlY + $urlSize + $gap2

    # Phase line goes through a textfile - it contains a comma, which drawtext
    # would otherwise read as an argument separator.
    $pf = Join-Path $work 'phase.txt'
    [System.IO.File]::WriteAllText($pf, $phaseLine, (New-Object System.Text.UTF8Encoding $false))
    $pfEsc = $pf.Replace('\','/').Replace(':','\:')

    $t1 = "drawtext=fontfile='$font':text='$phaseUrl':fontcolor=${orange}:fontsize=${urlSize}:x=(w-text_w)/2:y=$urlY"
    $t2 = "drawtext=fontfile='$font':textfile='$pfEsc':expansion=none:fontcolor=white:fontsize=${subSize}:x=(w-text_w)/2:y=$subY"

    & $ff -y -f lavfi -i "color=c=${navy}:s=${w}x${h}:r=30" -loop 1 -i $logo -f lavfi -i anullsrc=r=48000:cl=stereo `
          -filter_complex "[1:v]scale=${logoW}:${logoH}[lg];[0:v][lg]overlay=(W-w)/2:${logoY},$t1,$t2,fade=t=in:st=0:d=0.35,format=yuv420p[v]" `
          -map '[v]' -map 2:a -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    if ($LASTEXITCODE -ne 0) { throw 'ffmpeg failed on end card' }
}

function Build-Episode($ep, $w, $h, $fmt) {
    $dir  = Join-Path $assets $ep.dir
    $tag  = "$($ep.tag)-$fmt"
    $parts = @()

    # Plate is shared across all four episodes - one asset, four uses.
    $plate = Find-Clip (Join-Path $assets 'shared') 'plate'
    $p0 = Join-Path $work "$tag-0plate.mp4"
    Render-Segment $plate 'PLATE' $w $h $ep.plate $p0
    $parts += $p0

    $p1 = Join-Path $work "$tag-1b.mp4"
    Render-Segment (Find-Clip $dir 'clipB') "EP$($ep.n) CLIP B" $w $h $ep.b $p1
    $parts += $p1

    # HARD CUT lands here: B to C is butt-cut, single frame, no dissolve.
    $p2 = Join-Path $work "$tag-2c.mp4"
    Render-Segment (Find-Clip $dir 'clipC') "EP$($ep.n) CLIP C" $w $h $ep.c $p2
    $parts += $p2

    # Optional button beat. Only rendered when the episode declares d > 0 AND the
    # clip exists - otherwise a placeholder slate would appear in finished cuts.
    $dSec = 0
    if ($ep.d -gt 0) {
        $clipD = Find-Clip $dir 'clipD'
        if ($null -ne $clipD) {
            $dSec = $ep.d
            $pD = Join-Path $work "$tag-2d.mp4"
            Render-Segment $clipD "EP$($ep.n) CLIP D" $w $h $dSec $pD
            $parts += $pD
        }
    }

    # Punchline is per-episode and optional; tagline is shared and always plays.
    $punch   = Join-Path $dir 'vo-punch.mp3'
    $tagline = Join-Path $assets 'shared\vo-tagline.mp3'
    $punchSec   = Get-AudioSeconds $punch
    $taglineSec = Get-AudioSeconds $tagline

    $cardSec = $CARD_LEAD + $CARD_TAIL + $taglineSec
    if ($punchSec -gt 0) { $cardSec += $punchSec + $CARD_GAP }
    if ($cardSec -lt $CARD_MIN) { $cardSec = $CARD_MIN }
    $cardSec = [math]::Round($cardSec, 2)

    $p3 = Join-Path $work "$tag-3card.mp4"
    Render-EndCard $w $h $p3 $cardSec
    $parts += $p3

    $list = Join-Path $work "concat-$tag.txt"
    ($parts | ForEach-Object { "file '$($_.Replace('\','/'))'" }) | Set-Content $list -Encoding ascii

    $out = Join-Path $ads "got-this-ep$($ep.n)-$($ep.tag)-$fmt.mp4"
    & $ff -y -f concat -safe 0 -i $list -c:v libx264 -c:a aac -ar 48000 -r 30 -pix_fmt yuv420p $out
    if ($LASTEXITCODE -ne 0) { throw "concat failed: $tag" }

    # VO sits on the card, not under the clips. The scream is clipped dead by the
    # cut to the card - do NOT fade it, the abrupt silence is where the joke lands.
    # VO lands on the card, never under the clips. The scream is clipped dead by
    # the cut - do NOT fade it, the abrupt silence is where the joke lands.
    $cardStart = $ep.plate + $ep.b + $ep.c + $dSec
    $ins = @(); $lbls = @(); $i = 1

    if ($punchSec -gt 0) {
        $ins += $punch
        $d = [int](($cardStart + $CARD_LEAD) * 1000)
        $lbls += "[${i}:a]adelay=${d}|${d}[p]"; $i++
    }
    if ($taglineSec -gt 0) {
        $ins += $tagline
        $t = $cardStart + $CARD_LEAD
        if ($punchSec -gt 0) { $t += $punchSec + $CARD_GAP }
        $d = [int]($t * 1000)
        $lbls += "[${i}:a]adelay=${d}|${d}[t]"; $i++
    }

    if ($lbls.Count -gt 0) {
        if ($punchSec -gt 0 -and $taglineSec -gt 0) { $mixIn = '[0:a][p][t]'; $n = 3 }
        elseif ($punchSec -gt 0)                    { $mixIn = '[0:a][p]';    $n = 2 }
        else                                        { $mixIn = '[0:a][t]';    $n = 2 }

        $fc = ($lbls -join ';') + ";${mixIn}amix=inputs=${n}:duration=first:dropout_transition=0,volume=1.8[a]"
        $mixed = Join-Path $work "$tag-vo.mp4"
        $args = @('-y','-i',$out)
        foreach ($x in $ins) { $args += @('-i',$x) }
        $args += @('-filter_complex',$fc,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k',$mixed)
        & $ff @args
        if ($LASTEXITCODE -ne 0) { throw "VO mux failed: $tag" }
        Move-Item $mixed $out -Force
    } else {
        Write-Host "  (no VO found - tagline line is: `"$VO_LINE`")" -ForegroundColor DarkYellow
    }

    $secs = [math]::Round($cardStart + $cardSec, 1)
    if ($punchSec -gt 0) { $vodesc = 'punchline + tagline' } else { $vodesc = 'tagline only' }
    Write-Host "Built $out  (${secs}s, $vodesc)" -ForegroundColor Green
}

if ($Launch) { $phaseName = 'LAUNCH / customer' } else { $phaseName = 'PRE-LAUNCH / provider' }
Write-Host "End card phase: $phaseName - $phaseUrl - `"$phaseLine`"" -ForegroundColor Cyan

if ($Episode -gt 0) { $todo = $EPISODES | Where-Object { $_.n -eq $Episode } }
else                { $todo = $EPISODES }

foreach ($ep in $todo) {
    Build-Episode $ep 1080 1920 '9x16'
    Build-Episode $ep 1080 1080 '1x1'
}
