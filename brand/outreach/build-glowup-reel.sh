#!/usr/bin/env bash
set -euo pipefail
A="/home/user/Tuveloz-website/brand/ads/ad-01-assets"
OUTDIR="/home/user/Tuveloz-website/brand/outreach/media"
mkdir -p "$OUTDIR"

# Smooth slow-push Ken Burns on stills, hard cuts, drop lands on the glow-up.
# before-grade = dimmer/desat; after-grade = brighter/pop. No text, no audio.
BEFORE="eq=brightness=-0.05:saturation=0.82:contrast=1.04"
AFTER="eq=brightness=0.015:saturation=1.10:contrast=1.06"

build () {
  local OUT="$1"; local W="$2"; local H="$3"
  local BW=$((W*2)); local BH=$((H*2))   # large canvas -> zoompan down = jitter-free
  local COV="scale=${BW}:${BH}:force_original_aspect_ratio=increase,crop=${BW}:${BH}"
  local ZP="zoompan=z='min(1.001+0.00055*on\,1.11)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30"
  ffmpeg -y -hide_banner -loglevel error \
    -loop 1 -framerate 30 -t 2.6 -i "$A/scene1.png" \
    -loop 1 -framerate 30 -t 2.0 -i "$A/scene3.png" \
    -loop 1 -framerate 30 -t 5.4 -i "$A/scene2.png" \
    -filter_complex \
    "[0:v]${COV},${ZP},${BEFORE},setsar=1,format=yuv420p[v0];\
     [1:v]${COV},${ZP},${BEFORE},setsar=1,format=yuv420p[v1];\
     [2:v]${COV},${ZP},${AFTER},setsar=1,format=yuv420p[v2];\
     [v0][v1][v2]concat=n=3:v=1:a=0[v]" \
    -map "[v]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart "$OUT"
}

build "$OUTDIR/trend-reel-glowup-9x16.mp4" 1080 1920
build "$OUTDIR/trend-reel-glowup-1x1.mp4" 1080 1080

for f in "$OUTDIR/trend-reel-glowup-9x16.mp4" "$OUTDIR/trend-reel-glowup-1x1.mp4"; do
  echo "== $f =="
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,nb_frames,pix_fmt \
    -show_entries format=duration,size -of default=noprint_wrappers=1 "$f"
done