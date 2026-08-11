#!/usr/bin/env python3
"""
Generate real Gemini TTS voice audio for the DentRX dashboard's demo calls.

Requires only the Python standard library. Run this on your own machine
(not in a repo/CI) with your Gemini API key, from inside the "dashboard"
folder of the repo (the one containing public/, src/, package.json):

    GEMINI_API_KEY=your_key_here python3 generate_voices.py

Needs transcript_data.json in the same folder as this script (both files
downloaded together). Writes directly into public/audio/, replacing the
existing Piper-generated .mp3 files with Gemini-generated .wav files.
"""

import os
import sys
import json
import base64
import wave
import re
import time
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT_PATH = os.path.join(SCRIPT_DIR, "transcript_data.json")

MODEL = "gemini-2.5-flash-preview-tts"
VOICE = {
    "agent": "Puck",
    "system": "Puck",
    "patient": "Leda",
}
STYLE_PREFIX = {
    "agent": "Say in a calm, professional, reassuring tone, like a dental office's phone assistant:",
    "system": "Say in a neutral, matter-of-fact narrator tone:",
    "patient": "Say in a natural, casual, friendly tone, like a patient on a phone call:",
}

OUT_DIR = os.path.join(os.getcwd(), "public", "audio")


def synth_line(api_key, speaker, text, max_retries=3):
    prompt = f'{STYLE_PREFIX[speaker]} "{text}"'
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={api_key}"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": VOICE[speaker]}
                }
            },
        },
    }).encode("utf-8")

    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                url, data=body, headers={"Content-Type": "application/json"}, method="POST"
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
            audio_b64 = part["data"]
            mime = part.get("mimeType", "audio/L16;rate=24000")
            m = re.search(r"rate=(\d+)", mime)
            rate = int(m.group(1)) if m else 24000
            pcm_bytes = base64.b64decode(audio_b64)
            return pcm_bytes, rate
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            if attempt == max_retries:
                raise RuntimeError(f"HTTP {e.code}: {detail}")
            print(f"    retry {attempt}/{max_retries} after HTTP {e.code}...")
            time.sleep(2 * attempt)
        except Exception as e:
            if attempt == max_retries:
                raise
            print(f"    retry {attempt}/{max_retries} after error: {e}")
            time.sleep(2 * attempt)


def write_wav(path, pcm_bytes, rate):
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit PCM
        wf.setframerate(rate)
        wf.writeframes(pcm_bytes)


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: set GEMINI_API_KEY first, e.g.:")
        print("  GEMINI_API_KEY=your_key_here python3 generate_voices.py")
        sys.exit(1)

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
            out_path = os.path.join(call_dir, f"{idx}.wav")
            print(f"[{done + 1}/{total}] {call_id} line {idx} ({speaker})...")
            try:
                pcm_bytes, rate = synth_line(api_key, speaker, text)
                write_wav(out_path, pcm_bytes, rate)
                done += 1
            except Exception as e:
                print(f"    FAILED: {e}")
                failed.append((call_id, idx, str(e)))
            time.sleep(0.3)  # be polite to the free-tier rate limit

    print()
    print(f"Done: {done}/{total} lines generated into {OUT_DIR}")
    if failed:
        print(f"{len(failed)} lines failed:")
        for cid, idx, err in failed:
            print(f"  {cid} line {idx}: {err}")
        print()
        print("Re-run the script to retry — it will overwrite existing files, including")
        print("any that already succeeded, so it's safe to just run it again.")


if __name__ == "__main__":
    main()
