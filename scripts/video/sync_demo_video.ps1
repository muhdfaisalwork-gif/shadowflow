<#
.SYNOPSIS
    sync_demo_video.ps1
    Ducks ambient background music beneath the 35-second neural narration,
    normalizes loudness to -16 LUFS, and multiplexes the synchronized audio into demo-video.mp4.
#>

[CmdletBinding()]
param (
    [string]$VoiceoverPath = "g:\Project F2F\flow2flow-main\output\demo_video_audio\demo_voiceover_35s.aac",
    [string]$AmbientMusicPath = "g:\Project F2F\flow2flow-main\remotion\public\audio\ambient.mp3",
    [string]$TargetVideoPath = "g:\Project F2F\flow2flow-main\public\demo-video.mp4"
)

Write-Host "=== SHADOWFLOW DEMO VIDEO AUDIO MULTIPLEXER ===" -ForegroundColor Cyan

if (-not (Test-Path $VoiceoverPath)) {
    Write-Error "Voiceover file not found: $VoiceoverPath"
    exit 1
}

if (-not (Test-Path $AmbientMusicPath)) {
    Write-Error "Ambient music file not found: $AmbientMusicPath"
    exit 1
}

if (-not (Test-Path $TargetVideoPath)) {
    Write-Error "Target video not found: $TargetVideoPath"
    exit 1
}

# 1. Mix Voiceover + Ambient Music with Sidechain Compression & Loudness Normalization
$mixedAudioPath = "g:\Project F2F\flow2flow-main\output\demo_video_audio\mixed_ducked_35s.aac"

Write-Host "[1/3] Mixing speech and music with FFmpeg sidechain ducking filter..." -ForegroundColor Yellow

$filterComplex = "[1:a]volume=0.28,atrim=0:35.0[bgm]; " + `
                 "[bgm][0:a]sidechaincompress=threshold=0.07:ratio=5:attack=40:release=350[ducked_bgm]; " + `
                 "[0:a][ducked_bgm]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:35.0[aout]"

& ffmpeg -v error `
    -i $VoiceoverPath `
    -i $AmbientMusicPath `
    -filter_complex $filterComplex `
    -map "[aout]" `
    -t 35.0 `
    -c:a aac -b:a 192k `
    $mixedAudioPath -y

if (-not (Test-Path $mixedAudioPath)) {
    Write-Error "Failed to produce mixed audio track."
    exit 1
}

Write-Host "[SUCCESS] Generated ducked audio stem: $mixedAudioPath" -ForegroundColor Green

# 2. Multiplex into public/demo-video.mp4 without touching video frames (-c:v copy)
Write-Host "[2/3] Multiplexing audio into $TargetVideoPath (Zero video re-encoding)..." -ForegroundColor Yellow

$tempVideo = $TargetVideoPath + ".temp.mp4"
& ffmpeg -v error `
    -i $TargetVideoPath `
    -i $mixedAudioPath `
    -map 0:v:0 `
    -map 1:a:0 `
    -c:v copy `
    -c:a aac -b:a 192k `
    -shortest `
    -t 35.0 `
    $tempVideo -y

if (Test-Path $tempVideo) {
    Move-Item -Path $tempVideo -Destination $TargetVideoPath -Force
    Write-Host "[SUCCESS] Updated $TargetVideoPath" -ForegroundColor Green
} else {
    Write-Error "Failed to update $TargetVideoPath"
    exit 1
}

# Also update the root demo-video.mp4 copy if it exists
$rootVideo = "g:\Project F2F\demo-video.mp4"
if (Test-Path $rootVideo) {
    Copy-Item -Path $TargetVideoPath -Destination $rootVideo -Force
    Write-Host "[SUCCESS] Synced copy to root: $rootVideo" -ForegroundColor DarkGray
}

# 3. Inspect final audio volume
Write-Host "[3/3] Inspecting final audio volume levels..." -ForegroundColor Yellow
& ffmpeg -i $TargetVideoPath -af "volumedetect" -f null NUL

Write-Host "`n=== DEMO VIDEO AUDIO RESTORATION COMPLETE ===" -ForegroundColor Cyan
