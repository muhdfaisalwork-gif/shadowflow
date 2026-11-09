#!/usr/bin/env python3
"""
generate_tts_narration.py
Generates synchronized neural voiceover MP3 audio files from presentation slide speaker notes using edge-tts.
Outputs exact audio durations and an aligned timeline JSON for video compositing.
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from typing import Dict, Any, List

DEFAULT_VOICE = "en-US-AndrewMultilingualNeural"

def get_audio_duration_seconds(file_path: str) -> float:
    """Uses ffprobe to inspect exact audio duration in seconds."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        print(f"[Warning] Failed to read duration for {file_path} via ffprobe: {e}")
        return 5.0

async def synthesize_speech(text: str, output_path: str, voice: str) -> None:
    """Synthesizes text into MP3 via edge-tts."""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

async def process_manifest(manifest_path: str, output_dir: str, voice: str) -> Dict[str, Any]:
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    slides = data.get("slides", [])
    if not slides:
        print("[Error] Manifest contains no slides.")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    timeline: List[Dict[str, Any]] = []
    current_time_offset = 0.0

    print(f"[TTS] Synthesizing narration for {len(slides)} slides using voice: '{voice}'...")

    for idx, slide in enumerate(slides, start=1):
        slide_title = slide.get("title", f"Slide {idx}")
        notes = slide.get("speaker_notes", "").strip()
        pause_after = float(slide.get("pause_after_seconds", 0.8))

        if not notes:
            notes = slide_title

        audio_filename = f"slide_{idx:02d}.mp3"
        audio_path = os.path.join(output_dir, audio_filename)

        print(f"  -> Slide {idx}: {slide_title} ({len(notes.split())} words)")
        await synthesize_speech(notes, audio_path, voice)

        duration = get_audio_duration_seconds(audio_path)
        total_slide_duration = duration + pause_after

        slide_entry = {
            "slide_index": idx,
            "title": slide_title,
            "image": slide.get("image_path", ""),
            "audio_file": audio_filename,
            "audio_path": os.path.abspath(audio_path),
            "start_time_seconds": round(current_time_offset, 3),
            "speech_duration_seconds": round(duration, 3),
            "total_duration_seconds": round(total_slide_duration, 3),
            "notes": notes,
        }
        timeline.append(slide_entry)
        current_time_offset += total_slide_duration

    timeline_data = {
        "presentation_title": data.get("title", "Presentation Demo Video"),
        "voice": voice,
        "total_video_duration_seconds": round(current_time_offset, 3),
        "slides_count": len(slides),
        "timeline": timeline,
    }

    timeline_path = os.path.join(output_dir, "timeline.json")
    with open(timeline_path, "w", encoding="utf-8") as f:
        json.dump(timeline_data, f, indent=2)

    print(f"\n[Success] Generated {len(slides)} audio files.")
    print(f"[Success] Total presentation length: {current_time_offset:.2f} seconds.")
    print(f"[Success] Timeline manifest saved to: {timeline_path}")
    return timeline_data

def main():
    parser = argparse.ArgumentParser(description="Generate synchronized presentation narration with edge-tts.")
    parser.add_argument("--manifest", default="scripts/video/presentation_manifest.sample.json", help="Path to slide manifest JSON")
    parser.add_argument("--output-dir", default="output/audio", help="Output directory for generated audio files")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Voice identifier (default: {DEFAULT_VOICE})")

    args = parser.parse_args()

    if not os.path.exists(args.manifest):
        print(f"[Error] Manifest file not found at: {args.manifest}")
        sys.exit(1)

    asyncio.run(process_manifest(args.manifest, args.output_dir, args.voice))

if __name__ == "__main__":
    main()
