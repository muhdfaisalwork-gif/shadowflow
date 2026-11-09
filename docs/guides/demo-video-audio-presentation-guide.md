# Guide: Building Presentation-Style Demo Videos with Synchronized Audio

This guide explains how to produce presentation-style demo videos with clear narration, background music, audio ducking, and smooth slide transitions. It covers both code-driven workflows (React Remotion) and headless script pipelines (Python edge-tts and FFmpeg).

---

## 1. Structure of a Presentation Demo Video

A product walkthrough or presentation video works best when structured like a live pitch rather than a passive screen recording.

### Pacing and Timing Rules

| Scene / Slide | Target Duration | Visual Focus | Audio / Narration Focus |
| :--- | :--- | :--- | :--- |
| **1. Hook & Title** | 3 to 4 seconds | High-contrast title card, product logo, single value statement | State the core outcome directly. No introductory pleasantries. |
| **2. The Friction / Problem** | 5 to 7 seconds | Current workflow pain (chaotic tabs, manual steps, API rate limits) | Quantify time or money lost in manual work. |
| **3. Architecture / Overview** | 6 to 8 seconds | Directed acyclic graph (DAG) or system diagram showing clean flow | Explain how data moves from trigger to result. |
| **4. Live Product Walkthrough** | 12 to 20 seconds | Screen recording or high-res UI snapshot with pan/zoom (Ken Burns) | Walk through the exact actions: "Click X, configure Y, run Z." |
| **5. Proof & Benchmarks** | 5 to 7 seconds | Concrete table or metrics chart (latency, cost, throughput) | Cite verifiable numbers (e.g., "65% lower inference cost"). |
| **6. Call to Action (CTA)** | 4 to 5 seconds | Clean end card with URL, GitHub repo link, and invite button | Direct the viewer to the exact next step. |

### Video Specifications

* **Resolution**: 1920 × 1080 (1080p, 16:9 aspect ratio).
* **Frame Rate**: 30 fps for standard presentations; 60 fps if showing fluid drag-and-drop canvas movement.
* **Speaking Rate**: 130 to 150 words per minute (~2.2 words per second).
* **Visual Density**: One central idea per slide. Keep text to under 25 words per frame. Use narration to carry the details.

---

## 2. Audio Engineering: Voiceover, Music, and Ducking

A presentation video needs balanced audio. If background music is too loud, viewers cannot follow the technical explanation. If there is no background music, speech pauses feel awkward.

### The Audio Layers

```
Layer 1: Voiceover (Narration)   ──► Primary signal (-14 to -16 LUFS, centered)
Layer 2: Background Music (BGM)  ──► Ducked during speech (-24 to -28 dB), swells during pauses (-18 dB)
Layer 3: Sound Effects (SFX)     ──► Subtle UI clicks / transition swooshes (-12 dB peak)
```

### What is Audio Ducking?

Audio ducking automatically attenuates (lowers) the background music whenever narration is speaking, and restores the volume when narration pauses between slides.

---

## 3. Method 1: Programmatic React Video with Remotion

If you want code-driven, reproducible demo videos with live browser preview, use **Remotion** and `@remotion/media`.

### Installation

```bash
# In your project or video workspace
npm install remotion @remotion/media @remotion/transitions
```

### 1. Slide Component with Spring Transitions (`Slide.tsx`)

```tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";

interface SlideProps {
  title: string;
  subtitle: string;
  imageSrc?: string;
  bullets?: string[];
}

export const Slide: React.FC<SlideProps> = ({ title, subtitle, imageSrc, bullets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring animation: smooth and organic
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 100 },
  });

  const opacity = Math.min(1, frame / 10);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0d0e12",
        color: "#ffffff",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: "80px",
        boxSizing: "border-box",
        opacity,
      }}
    >
      <div style={{ transform: `translateY(${(1 - entrance) * 30}px)` }}>
        <h1 style={{ fontSize: "56px", fontWeight: 800, margin: 0, color: "#f8fafc" }}>
          {title}
        </h1>
        <p style={{ fontSize: "24px", color: "#94a3b8", marginTop: "12px", marginBottom: "40px" }}>
          {subtitle}
        </p>
      </div>

      <div style={{ display: "flex", gap: "48px", flex: 1, alignItems: "center" }}>
        {imageSrc && (
          <div
            style={{
              flex: 1.2,
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              transform: `scale(${0.96 + entrance * 0.04})`,
            }}
          >
            <Img src={staticFile(imageSrc)} style={{ width: "100%", display: "block" }} />
          </div>
        )}

        {bullets && bullets.length > 0 && (
          <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: "16px" }}>
            {bullets.map((bullet, idx) => {
              const itemDelay = 15 + idx * 8;
              const itemSpring = spring({
                frame: Math.max(0, frame - itemDelay),
                fps,
                config: { damping: 12 },
              });
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "rgba(30, 41, 59, 0.7)",
                    border: "1px solid rgba(148, 163, 184, 0.15)",
                    padding: "16px 20px",
                    borderRadius: "12px",
                    fontSize: "20px",
                    color: "#e2e8f0",
                    transform: `translateX(${(1 - itemSpring) * 20}px)`,
                    opacity: Math.min(1, Math.max(0, (frame - itemDelay) / 5)),
                  }}
                >
                  {bullet}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
```

### 2. Audio Ducking in Remotion (`PresentationComposition.tsx`)

Remotion supports frame-based dynamic volume interpolation for background music:

```tsx
import React from "react";
import { Composition, Sequence, staticFile, useVideoConfig, useCurrentFrame, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import { Slide } from "./Slide";

interface SlideData {
  title: string;
  subtitle: string;
  bullets: string[];
  imageSrc?: string;
  durationInSeconds: number;
  narrationAudio: string;
}

const presentationSlides: SlideData[] = [
  {
    title: "ShadowFlow Automation",
    subtitle: "Deterministic AI workflow engine running in WebAssembly",
    bullets: ["Zero external telemetry", "Sub-millisecond DAG scheduler", "Hybrid local and frontier routing"],
    imageSrc: "screens/canvas.png",
    durationInSeconds: 6,
    narrationAudio: "audio/slide1_hook.mp3",
  },
  {
    title: "Visual DAG Execution",
    subtitle: "Orchestrate multi-step browser and API tasks without lock-in",
    bullets: ["Model Context Protocol (MCP) native", "Self-healing node retries", "Export to Docker or edge workers"],
    imageSrc: "screens/dag_builder.png",
    durationInSeconds: 7,
    narrationAudio: "audio/slide2_dag.mp3",
  },
  {
    title: "Get Started Free",
    subtitle: "Deploy on your private infrastructure or cloud edge",
    bullets: ["Open source under Apache 2.0", "Inspect full code on GitHub", "Launch sandbox at shadowflow.work"],
    imageSrc: "screens/dashboard.png",
    durationInSeconds: 5,
    narrationAudio: "audio/slide3_cta.mp3",
  },
];

// Audio track that automatically ducks volume during active narration
const DuckedBackgroundMusic: React.FC<{
  speechWindows: Array<{ startFrame: number; endFrame: number }>;
}> = ({ speechWindows }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine target volume based on speech window proximity
  const isSpeaking = speechWindows.some(
    (w) => frame >= w.startFrame - fps * 0.3 && frame <= w.endFrame + fps * 0.4
  );

  const targetVolume = isSpeaking ? 0.08 : 0.28;

  return (
    <Audio
      src={staticFile("audio/ambient_bed.mp3")}
      loop
      volume={(f) =>
        interpolate(f, [frame - 5, frame], [targetVolume, targetVolume], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

export const PresentationComposition: React.FC = () => {
  const { fps } = useVideoConfig();

  let accumulatedFrame = 0;
  const speechWindows: Array<{ startFrame: number; endFrame: number }> = [];

  const sequencedSlides = presentationSlides.map((slide) => {
    const startFrame = accumulatedFrame;
    const durationFrames = Math.round(slide.durationInSeconds * fps);
    accumulatedFrame += durationFrames;

    speechWindows.push({
      startFrame,
      endFrame: startFrame + durationFrames - Math.round(fps * 0.5),
    });

    return { slide, startFrame, durationFrames };
  });

  return (
    <>
      {/* Background Music Layer */}
      <DuckedBackgroundMusic speechWindows={speechWindows} />

      {/* Slide & Narration Sequences */}
      {sequencedSlides.map(({ slide, startFrame, durationFrames }, i) => (
        <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
          <Slide
            title={slide.title}
            subtitle={slide.subtitle}
            bullets={slide.bullets}
            imageSrc={slide.imageSrc}
          />
          {/* Synchronized voiceover clip */}
          <Audio src={staticFile(slide.narrationAudio)} volume={1.0} />
        </Sequence>
      ))}
    </>
  );
};
```

### 3. Rendering the Video

```bash
# Launch interactive timeline preview
npx remotion studio

# Render final 1080p MP4 with AAC audio
npx remotion render PresentationComposition out/presentation.mp4 --codec=h264
```

---

## 4. Method 2: Headless Python + FFmpeg Pipeline

If you want a lightweight CLI pipeline without running a Node.js rendering stack, use Python's `edge-tts` combined with FFmpeg.

### Workflow Overview

1. Write your slide text and speaker notes in `manifest.json`.
2. Generate neural voiceover `.mp3` files for each slide using `edge-tts`.
3. Capture slide visuals (or export PNG slides).
4. Run FFmpeg with `sidechaincompress` to mix voiceover and background music into a single 1080p MP4.

### 1. Narration Generation Script (`scripts/video/generate_tts_narration.py`)

Run this script to turn speaker notes into clean speech audio:

```bash
python scripts/video/generate_tts_narration.py --manifest scripts/video/presentation_manifest.sample.json
```

It outputs:
* `temp/audio/slide_01.mp3`
* `temp/audio/slide_02.mp3`
* `temp/audio/combined_voiceover.mp3`
* Exact millisecond timestamps for each slide.

### 2. Audio Ducking with FFmpeg (`sidechaincompress`)

In FFmpeg, ducking is handled cleanly by the `sidechaincompress` filter:

```bash
ffmpeg -loop 1 -i slide.png -i voiceover.mp3 -i background_music.mp3 -filter_complex ^
  "[2:a]volume=0.35[bgm]; ^
   [bgm][1:a]sidechaincompress=threshold=0.08:ratio=5:attack=40:release=350[ducked_music]; ^
   [1:a][ducked_music]amix=inputs=2:duration=first:dropout_transition=2[aout]" ^
  -map 0:v -map "[aout]" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest output.mp4
```

* **`threshold=0.08`**: Sensitivity threshold. Compression engages as soon as speech starts.
* **`ratio=5`**: Compression ratio. Reduces background music volume by ~14 dB while speech is present.
* **`attack=40`**: Time in milliseconds for music volume to drop once speech begins.
* **`release=350`**: Time in milliseconds for music volume to gently fade back up after speech pauses.

---

## 5. Converting PowerPoint (.pptx) or Markdown Slides

If your team already maintains slides in PowerPoint (`.pptx`) or Markdown (`Slidev` / `Marp`):

### Exporting High-Resolution Slide Images

1. **From PowerPoint (`.pptx`)**:
   * Open PowerPoint -> *File* -> *Export* -> *Change File Type* -> *PNG Portable Network Graphics*.
   * Select *All Slides* at 1920 × 1080.
2. **From Slidev**:
   ```bash
   npx slidev export --format png --output slides-export/
   ```
3. **From Marp**:
   ```bash
   npx @marp-team/marp-cli slides.md --images png -o output/
   ```

### Aligning Speaker Notes with Narration

Extract speaker notes directly into your manifest:

```json
{
  "slides": [
    {
      "slide_number": 1,
      "image_path": "slides/slide_01.png",
      "speaker_notes": "ShadowFlow is an autonomous workflow platform designed for high-throughput execution without cloud vendor fees.",
      "pause_after_seconds": 1.0
    }
  ]
}
```

The automation script generates audio from `speaker_notes` and sets each slide's display duration to match `audio_duration + pause_after_seconds`.

---

## 6. Audio Standards & Delivery Checklist

Before publishing your presentation video:

* [ ] **Loudness Normalization**: Normalize speech to **-16 LUFS** (standard for web and YouTube).
  ```bash
  ffmpeg -i raw_mix.mp4 -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:v copy final_normalized.mp4
  ```
* [ ] **No Dead Air**: Leave 0.5s to 1.0s of ducked background music at the start before the first sentence begins.
* [ ] **Clean Pacing**: Do not compress speech speed above 1.15x. Clear articulation is more important than speed.
* [ ] **Music License**: Use royalty-free ambient music (Creative Commons Zero or purchased stock tracks) to prevent automated copyright strikes.
* [ ] **Subtitles**: Include automated captions (burned into frames or exported as `.srt`) for viewers watching on mute.
