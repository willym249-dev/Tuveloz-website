# Build "I've Got This" EP1 (battery) - CORRECTED 7-second cut
#
# Supersedes the ep1 path in build-got-this.ps1. Differences:
#   - No lakefront plate. Hook text carries 0:00 instead.
#   - Two frozen-state clips: "wrong, no consequence" -> "consequence".
#   - 2.6 / 1.6 / 2.8 timing. Joke lands before the scroll, card still reads.
#   - New end-card copy. No fee line: provider-recruitment audience only.
#   - Audio is SFX-driven, not VO. Ambient bed, arc crack on the cut, logo hit.
#
# Usage:
#   powershell -File brand\ads\build-got-this-ep1-v2.ps1
#
# Assets in brand\ads\got-this-assets\ep1-battery\:
#   setup.mp4         - man between hoods, red clamp already on black terminal
#   reaction.mp4      - planted recoil, sparks present, face readable
#   sfx-arc-crack.mp3 - 2s electrical arc, transient at t=0        [HAVE]
#   sfx-ambient.mp3   - quiet golden-hour lot tone                 [PENDING]
#   sfx-logo-hit.mp3  - restrained low thump, warm tail            [PENDING]
# Missing files render as labeled slates / drop out of the mix, so the cut
# stays viewable and the timing is provable before the real clips land.
param(
    [switch]$Launch,
    # Ambient bed level only. The delivered bed is near-silent, so this is a
    # boost, not a trim - see $AMBIENT_GAIN below. Anything other than the
    # default tags the output filename so A/B renders can't be confused for the
    # real cut. Does not touch the crack, the silence gap, or the hit.
    [int]$AmbientGain = 10
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

$root   = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
$ads    = Join-Path $root 'brand\ads'
$assets = Join-Path $ads 'got-this-assets'
$dir    = Join-Path $assets 'ep1-battery'
$work   = Join-Path $assets '_work'
# Strapline-free lockup on purpose. The full lockup has "Customer choice.
# Provider freedom." baked under the wordmark, and this card sets the sign-off
# as its own line - the standard lockup printed the tagline twice. Regenerate with:
#   node -e "require('sharp')('brand/tuveloz-lockup-horizontal-nostrap.svg',{density:300}).resize(1560,500,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile('brand/ads/got-this-assets/shared/lockup-nostrap.png')"
$logo = Join-Path $assets 'shared\lockup-nostrap.png'
if (-not (Test-Path $logo)) { $logo = Join-Path $assets 'shared\lockup.png' }
if (-not (Test-Path $logo)) { $logo = Join-Path $root 'brand\social-media-kit\Tuveloz Logo.png' }
New-Item -ItemType Directory -Force $work | Out-Null

$font   = 'C\:/Windows/Fonts/arialbd.ttf'
$navy   = '0x07182D'   # brand navy - end card plate
$orange = '0xFF6A00'   # brand orange - URL

# --- Beat timings (seconds) -------------------------------------------------
# 0.00-2.60  setup, hook text on screen from frame 1
# 2.60-4.20  hard cut to reaction; face readable ~1.6s
# 4.20-7.00  end card
$T_SETUP    = 2.6
$T_REACTION = 1.6
$T_CARD     = 2.8

# --- Audio placement --------------------------------------------------------
# No two low-end sounds overlap. Arc tail dies before the card, card sits
# silent for a beat before the hit - that silence is what sells the cut.
$A_ARC   = 2.60   # arc crack, on the frame of the cut
$ARC_LEN = 0.55   # hard-trim the crack so its tail dies by ~3.15
$A_HIT   = 4.45   # logo hit, 0.25s after the card appears
# dB. The delivered ambient bed measures mean -47dB, which is under the noise
# floor, so this is a boost, not a trim.
#
# +10 is the default: mean -38dB / peak -26.7dB in the mix. That is enough
# contrast for the arc to hit against without pushing generated hiss into
# audibility on phone speakers, which is where most of this audience watches.
# +15 (mean -33dB) is the alternate, and only correct if the isolated bed
# clearly reads as natural outdoor air rather than noise.
$AMBIENT_GAIN = $AmbientGain

# Two lines on purpose. This is nearly twice the length of the line it replaced,
# and on one line at a readable size it runs the full width of a 1080 frame with
# no margin. Stacked, it stays large enough to read on a phone at arm's length.
$HOOK = "THE GROUP CHAT'S`n`"CAR GUY.`""

# End card. Fee copy is fixed: providers keep 100%. The customer-side 5% is a
# platform fact, not ad copy, and this cut is aimed at providers only.
if ($Launch) {
    $cardPromise = @('POST YOUR JOB.', 'COMPARE QUOTES.')
    $cardUrl     = 'tuveloz.com'
    $cardFine    = ''
} else {
    $cardPromise = @('YOU QUOTE IT.', 'YOU KEEP 100%.')
    $cardUrl     = 'tuveloz.com/join'
    $cardFine    = "Customer jobs aren't live yet."
}
$cardTagline = 'Customer choice. Provider freedom.'

function Get-AudioSeconds($path) {
    if (-not $ffprobe -or -not (Test-Path $path)) { return 0 }
    $d = & $ffprobe -v error -show_entries format=duration -of csv=p=0 $path
    if ($d) { return [double]$d } else { return 0 }
}

function Find-Clip($name) {
    if (-not (Test-Path $dir)) { return $null }
    Get-ChildItem $dir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.BaseName -eq $name -and $_.Extension -match '\.(mp4|mov|jpe?g|png|webp)$' } |
        Select-Object -First 1
}

# drawtext chokes on commas, colons and apostrophes in inline text. Every line
# goes through a file instead - "aren't" and the tagline comma both need this.
function New-TextArg($id, $text) {
    $p = Join-Path $work "v2-$id.txt"
    [System.IO.File]::WriteAllText($p, $text, (New-Object System.Text.UTF8Encoding $false))
    return $p.Replace('\','/').Replace(':','\:')
}

# Every segment is normalised to the same v+a shape so concat never desyncs.
# Video is rendered mute; the whole mix is laid on the concatenated cut.
function Render-Segment($asset, $label, $w, $h, $dur, $out, $extraVf) {
    $sc = "scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,format=yuv420p"
    if ($extraVf) { $sc = "$sc,$extraVf" }
    if ($null -eq $asset) {
        $slate = "drawtext=fontfile='$font':text='[$label PENDING]':fontcolor=${orange}:fontsize=$([int]($w*0.045)):x=(w-text_w)/2:y=(h-text_h)/2"
        if ($extraVf) { $slate = "$slate,$extraVf" }
        & $ff -y -f lavfi -i "color=c=0x141414:s=${w}x${h}:r=30" -f lavfi -i anullsrc=r=48000:cl=stereo `
              -vf $slate -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    } elseif ($asset.Extension -match '\.(mp4|mov)$') {
        & $ff -y -i $asset.FullName -f lavfi -i anullsrc=r=48000:cl=stereo `
              -vf $sc -map 0:v -map 1:a -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    } else {
        & $ff -y -loop 1 -i $asset.FullName -f lavfi -i anullsrc=r=48000:cl=stereo `
              -vf $sc -map 0:v -map 1:a -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    }
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on segment: $label" }
}

function Render-EndCard($w, $h, $out, $dur) {
    # Hierarchy, top to bottom: logo -> promise -> URL -> fine print -> tagline.
    # Fine print is deliberately the smallest thing on the card so it reads as a
    # note under the CTA rather than a competing headline.
    if ($h -gt $w) { $logoW = [int]($w*0.72) } else { $logoW = [int]($w*0.56) }
    $logoH    = [int]($logoW * 500 / 1560)
    $proSize  = [int]($w*0.062)
    $urlSize  = [int]($w*0.055)
    $fineSize = [int]($w*0.030)
    $tagSize  = [int]($w*0.032)

    $gLogo = [int]($h*0.045)   # logo -> promise
    $gLine = [int]($h*0.008)   # between the two promise lines
    $gUrl  = [int]($h*0.035)   # promise -> url
    $gFine = [int]($h*0.014)   # url -> fine print
    $gTag  = [int]($h*0.040)   # fine print -> tagline

    $stack = $logoH + $gLogo + $proSize + $gLine + $proSize + $gUrl + $urlSize
    if ($cardFine) { $stack += $gFine + $fineSize }
    $stack += $gTag + $tagSize

    $y = [int](($h - $stack) / 2)
    $logoY = $y
    $y += $logoH + $gLogo
    $pro1Y = $y; $y += $proSize + $gLine
    $pro2Y = $y; $y += $proSize + $gUrl
    $urlY  = $y; $y += $urlSize
    if ($cardFine) { $y += $gFine; $fineY = $y; $y += $fineSize }
    $y += $gTag; $tagY = $y

    $draw = @()
    $draw += "drawtext=fontfile='$font':textfile='$(New-TextArg 'pro1' $cardPromise[0])':expansion=none:fontcolor=white:fontsize=${proSize}:x=(w-text_w)/2:y=$pro1Y"
    $draw += "drawtext=fontfile='$font':textfile='$(New-TextArg 'pro2' $cardPromise[1])':expansion=none:fontcolor=white:fontsize=${proSize}:x=(w-text_w)/2:y=$pro2Y"
    $draw += "drawtext=fontfile='$font':textfile='$(New-TextArg 'url' $cardUrl)':expansion=none:fontcolor=${orange}:fontsize=${urlSize}:x=(w-text_w)/2:y=$urlY"
    if ($cardFine) {
        $draw += "drawtext=fontfile='$font':textfile='$(New-TextArg 'fine' $cardFine)':expansion=none:fontcolor=0xC8D2DE:fontsize=${fineSize}:x=(w-text_w)/2:y=$fineY"
    }
    $draw += "drawtext=fontfile='$font':textfile='$(New-TextArg 'tag' $cardTagline)':expansion=none:fontcolor=white:fontsize=${tagSize}:x=(w-text_w)/2:y=$tagY"
    $txt = $draw -join ','

    & $ff -y -f lavfi -i "color=c=${navy}:s=${w}x${h}:r=30" -loop 1 -i $logo -f lavfi -i anullsrc=r=48000:cl=stereo `
          -filter_complex "[1:v]scale=${logoW}:${logoH}[lg];[0:v][lg]overlay=(W-w)/2:${logoY},$txt,fade=t=in:st=0:d=0.25,format=yuv420p[v]" `
          -map '[v]' -map 2:a -c:v libx264 -c:a aac -ar 48000 -t $dur -shortest $out
    if ($LASTEXITCODE -ne 0) { throw 'ffmpeg failed on end card' }
}

function Build($w, $h, $fmt) {
    $tag = "battery-v2-$fmt"
    $parts = @()

    # Hook burns in over the setup only. It is gone by the hard cut - the joke
    # has to land on the picture, not on a caption explaining it.
    # Stacking the hook buys back type size: the longest line is now ~16
    # characters instead of ~27, so it can run larger than the single-line
    # version did and still clear the frame edges.
    $hookSize = [int]($w*0.072)
    $hookY    = [int]($h*0.075)
    $hookVf   = "drawtext=fontfile='$font':textfile='$(New-TextArg 'hook' $HOOK)':expansion=none:fontcolor=white:fontsize=${hookSize}:line_spacing=$([int]($hookSize*0.22)):text_align=C:box=1:boxcolor=0x07182D@0.72:boxborderw=$([int]($w*0.022)):x=(w-text_w)/2:y=$hookY"

    $p0 = Join-Path $work "$tag-0setup.mp4"
    Render-Segment (Find-Clip 'setup') 'SETUP' $w $h $T_SETUP $p0 $hookVf
    $parts += $p0

    # HARD CUT lands here: setup to reaction is butt-cut, single frame, no dissolve.
    $p1 = Join-Path $work "$tag-1reaction.mp4"
    Render-Segment (Find-Clip 'reaction') 'REACTION' $w $h $T_REACTION $p1 $null
    $parts += $p1

    $p2 = Join-Path $work "$tag-2card.mp4"
    Render-EndCard $w $h $p2 $T_CARD
    $parts += $p2

    $list = Join-Path $work "concat-$tag.txt"
    ($parts | ForEach-Object { "file '$($_.Replace('\','/'))'" }) | Set-Content $list -Encoding ascii

    $silent = Join-Path $work "$tag-silent.mp4"
    & $ff -y -f concat -safe 0 -i $list -c:v libx264 -c:a aac -ar 48000 -r 30 -pix_fmt yuv420p $silent
    if ($LASTEXITCODE -ne 0) { throw "concat failed: $tag" }

    # A cut containing placeholder slates must never sit at the publishable
    # filename. It is a timing proof, not an ad, and the two names should never
    # be one typo apart.
    if ($AMBIENT_GAIN -ne 10) { $ambTag = "-amb$AMBIENT_GAIN" } else { $ambTag = '' }
    if ($null -eq (Find-Clip 'setup') -or $null -eq (Find-Clip 'reaction')) {
        $out = Join-Path $ads "got-this-ep1-battery-v2-SLATE$ambTag-$fmt.mp4"
    } else {
        $out = Join-Path $ads "got-this-ep1-battery-v2$ambTag-$fmt.mp4"
    }

    # --- Mix ---------------------------------------------------------------
    # Ambient runs under the setup and is cut dead at the arc, not faded: the
    # crack has to hit against something and then leave nothing behind it.
    $ambient = Join-Path $dir 'sfx-ambient.mp3'
    $arc     = Join-Path $dir 'sfx-arc-crack.mp3'
    $hit     = Join-Path $dir 'sfx-logo-hit.mp3'

    $ins = @(); $lbls = @(); $mix = @('[0:a]'); $i = 1
    $have = @(); $miss = @()

    if ((Get-AudioSeconds $ambient) -gt 0) {
        # Delivered at mean -47dB, which is under the noise floor - attenuating it
        # further left the crack with nothing to hit against. Boosted to a mean
        # near -32dB: present enough to feel, quiet enough to stay a bed.
        # Cut dead at the arc, never faded - the abrupt stop is the joke.
        $ins += $ambient
        $lbls += "[${i}:a]atrim=0:${A_ARC},asetpts=PTS-STARTPTS,volume=${AMBIENT_GAIN}dB[amb]"
        $mix += '[amb]'; $i++; $have += "ambient (+${AMBIENT_GAIN}dB)"
    } else { $miss += 'sfx-ambient.mp3' }

    if ((Get-AudioSeconds $arc) -gt 0) {
        # The delivered asset crackles for ~1.58s despite being prompted to fade
        # within half a second. Left alone it runs under the entire reaction and
        # there is no near-silence for the face to land in. Trim it here rather
        # than burning credits on a regen - the transient is all we need.
        $ins += $arc
        $d = [int]($A_ARC * 1000)
        $lbls += "[${i}:a]atrim=0:${ARC_LEN},asetpts=PTS-STARTPTS,afade=t=out:st=$($ARC_LEN-0.12):d=0.12,adelay=${d}|${d}[arc]"
        $mix += '[arc]'; $i++; $have += "arc crack (trimmed to ${ARC_LEN}s)"
    } else { $miss += 'sfx-arc-crack.mp3' }

    if ((Get-AudioSeconds $hit) -gt 0) {
        $ins += $hit
        $d = [int]($A_HIT * 1000)
        $lbls += "[${i}:a]adelay=${d}|${d},volume=0.7[hit]"
        $mix += '[hit]'; $i++; $have += 'logo hit'
    } else { $miss += 'sfx-logo-hit.mp3' }

    if ($lbls.Count -gt 0) {
        $n  = $mix.Count
        # normalize=0 matters. amix defaults to scaling every input by 1/inputs,
        # which quietly ate 12dB off a bed that was already near-silent and made
        # the gain above look like it did nothing. Levels are set per-element
        # here, so let them through untouched and catch peaks with the limiter.
        $fc = ($lbls -join ';') + ";$($mix -join '')amix=inputs=${n}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[a]"
        $args = @('-y','-i',$silent)
        foreach ($x in $ins) { $args += @('-i',$x) }
        $args += @('-filter_complex',$fc,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k',$out)
        & $ff @args
        if ($LASTEXITCODE -ne 0) { throw "audio mux failed: $tag" }
    } else {
        Copy-Item $silent $out -Force
    }

    $total = $T_SETUP + $T_REACTION + $T_CARD
    Write-Host "Built $out  (${total}s)" -ForegroundColor Green
    if ($have.Count) { Write-Host "  audio in mix: $($have -join ', ')" -ForegroundColor DarkGray }
    if ($miss.Count) { Write-Host "  audio missing: $($miss -join ', ')" -ForegroundColor DarkYellow }
}

foreach ($n in @('setup','reaction')) {
    if ($null -eq (Find-Clip $n)) {
        Write-Host "MISSING CLIP: $n - rendering placeholder slate" -ForegroundColor Yellow
    }
}

Build 1080 1920 '9x16'
Build 1080 1080 '1x1'
