#!/usr/bin/env python3
"""
Generate real Edge TTS (Microsoft neural) voice audio for the DentRX
dashboard's demo calls. Free, no API key, no signup, no billing.

First install the library (one-time):
    pip install edge-tts

Then run this from inside the "dashboard" folder of the repo (the one
containing public/, src/, package.json), with transcript_data.json in
the same folder as this script:

    python3 generate_voices_edge.py

Writes directly into public/audio/ as .mp3 — the same filenames Piper
already produced, so this cleanly replaces them (the player already
looks for .mp3 first).
"""

import os
import sys
import json
import asyncio

try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts isn't installed. Run this first:")
    print("  pip install edge-tts")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT_PATH = os.path.join(SCRIPT_DIR, "transcript_data.json")
OUT_DIR = os.path.join(os.getcwd(), "public", "audio")

VOICE = {
    "agent": "en-US-GuyNeural",     # calm, professional male voice
    "system": "en-US-GuyNeural",
    "patient": "en-US-AriaNeural",  # natural, friendly female voice
}


async def synth_line(speaker, text, out_path, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            communicate = edge_tts.Communicate(text, VOICE[speaker])
            await communicate.save(out_path)
            return
        except Exception as e:
            if attempt == max_retries:
                raise
            print(f"    retry {attempt}/{max_retries} after error: {e}")
            await asyncio.sleep(1.5 * attempt)


async def main():
    if not os.path.exists(TRANSCRIPT_PATH):
        print(f"ERROR: transcript_data.json not found next to this script ({SCRIPT_DIR})")
        sys.exit(1)

    with open(TRANSCRIPT_PATH) as f:
        transcript_data = json.load(f)

    total = sum(len(lines) for _, lines in transcript_data)
    done = 0
    failed = []

    print(f"Generating {total} lines across {len(transcript_data)} calls into {OUT_DIR}")
    print()

    for call_id, lines in transcript_data:
        call_dir = os.path.join(OUT_DIR, call_id)
        os.makedirs(call_dir, exist_ok=True)
        for idx, (speaker, text) in enumerate(lines):
            out_path = os.path.join(call_dir, f"{idx}.mp3")
            print(f"[{done + 1}/{total}] {call_id} line {idx} ({speaker})...")
            try:
                await synth_line(speaker, text, out_path)
                done += 1
            except Exception as e:
                print(f"    FAILED: {e}")
                failed.append((call_id, idx, str(e)))

    print()
    print(f"Done: {done}/{total} lines generated into {OUT_DIR}")
    if failed:
        print(f"{len(failed)} lines failed:")
        for cid, idx, err in failed:
            print(f"  {cid} line {idx}: {err}")
        print()
        print("Re-run the script to retry — it's safe, it just overwrites files again.")


if __name__ == "__main__":
    asyncio.run(main())
