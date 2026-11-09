#!/usr/bin/env python3
"""
generate_demo_video_audio.py
Synthesizes scene-synchronized neural narration for the 35-second demo-video.mp4.
Aligns speech clips with the 9 visual cuts in MainVideo.tsx and outputs a continuous 35s voiceover stem.
"""

import asyncio
import os
import subprocess
import sys
from typing import List, Dict, Any

VOICE = "en-US-AndrewMultilingualNeural"
RATE = "+18%"

# Visual Scene breakdown matching MainVideo.tsx (35.00s total duration)
DEMO_SCENES = [
    {
        "scene": 1,
        "name": "Hero Intro",
        "target_start": 0.2,
        "script": "ShadowFlow is an autonomous AI workflow engine."
    },
    {
        "scene": 2,
        "name": "Node Library",
        "target_start": 3.8,
        "script": "Choose from dozens of modular triggers, logic, and AI nodes."
    },
    {
        "scene": 3,
        "name": "Workflow Canvas",
        "target_start": 8.2,
        "script": "Wire directed graphs on an interactive visual canvas. Connect webhooks to reasoning models with zero vendor lock-in."
    },
    {
        "scene": 4,
        "name": "AI Copilot",
        "target_start": 16.5,
        "script": "Prompt our AI copilot to build validated workflows instantly."
    },
    {
        "scene": 5,
        "name": "Code Editor",
        "target_start": 21.0,
        "script": "Embed custom TypeScript with isolated sandbox execution."
    },
    {
        "scene": 6,
        "name": "Integrations",
        "target_start": 25.0,
        "script": "Connect external APIs and Anthropic MCP servers."
    },
    {
        "scene": 7,
        "name": "Real-Time Execution",
        "target_start": 28.8,
        "script": "Inspect real-time telemetry with sub-millisecond latency."
    },
    {
        "scene": 8,
        "name": "Closing CTA",
        "target_start": 32.2,
        "script": "Launch free at shadowflow dot work."
    }
]

def get_audio_duration(file_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(res.stdout.strip())
    except Exception as e:
        print(f"[Warning] Failed to read duration for {file_path}: {e}")
        return 3.0

async def synthesize_clip(text: str, output_path: str, voice: str, rate: str) -> None:
    import edge_tts
    for attempt in range(4):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(output_path)
            return
        except Exception as e:
            if attempt == 3:
                raise
            await asyncio.sleep(1.0)

async def build_35s_narration(output_dir: str) -> str:
    import edge_tts
    os.makedirs(output_dir, exist_ok=True)
    stems = []

    print(f"=== SYNTHESIZING 35-SECOND DEMO VIDEO NARRATION ({VOICE}, rate={RATE}) ===")

    for item in DEMO_SCENES:
        scene_idx = item["scene"]
        text = item["script"]
        clip_path = os.path.join(output_dir, f"scene_{scene_idx:02d}.mp3")
        print(f"  -> Scene {scene_idx} ({item['name']}): '{text}'")
        await synthesize_clip(text, clip_path, VOICE, RATE)
        actual_dur = get_audio_duration(clip_path)
        print(f"     Actual duration: {actual_dur:.2f}s (target start: {item['target_start']:.2f}s)")
        stems.append({
            "scene": scene_idx,
            "path": clip_path,
            "duration": actual_dur,
            "start": item["target_start"]
        })

    # Assemble using FFmpeg adelay filter graph into an exact 35-second track
    print("\n[Assembling exact 35-second voiceover stem with micro-delays...]")
    inputs = []
    filter_delays = []
    amix_inputs = []

    for idx, stem in enumerate(stems):
        inputs.extend(["-i", stem["path"]])
        delay_ms = int(stem["start"] * 1000)
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume=1.0[a{idx}];")
        amix_inputs.append(f"[a{idx}]")

    combined_filter = (
        "".join(filter_delays) +
        "".join(amix_inputs) +
        f"amix=inputs={len(stems)}:duration=longest:dropout_transition=0," +
        "atrim=0:35.0,apad=whole_dur=35.0[aout]"
    )

    master_voiceover_path = os.path.join(output_dir, "demo_voiceover_35s.aac")
    cmd = [
        "ffmpeg", "-v", "error",
        *inputs,
        "-filter_complex", combined_filter,
        "-map", "[aout]",
        "-t", "35.0",
        "-c:a", "aac",
        "-b:a", "192k",
        master_voiceover_path,
        "-y"
    ]

    subprocess.run(cmd, check=True)
    actual_master_dur = get_audio_duration(master_voiceover_path)
    print(f"[SUCCESS] Master 35-second voiceover stem created: {master_voiceover_path} (Duration: {actual_master_dur:.2f}s)")
    return master_voiceover_path

def main():
    output_dir = os.path.abspath(r"g:\Project F2F\flow2flow-main\output\demo_video_audio")
    asyncio.run(build_35s_narration(output_dir))

if __name__ == "__main__":
    main()
