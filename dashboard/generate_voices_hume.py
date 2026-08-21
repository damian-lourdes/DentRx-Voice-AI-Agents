#!/usr/bin/env python3
"""
Generate real Hume AI (Octave) voice audio for the DentRX dashboard's
demo calls, using two voices picked from Hume's Voice Library. Free
tier covers this easily (~10K chars/month, no card).

Requires only the Python standard library. Run this on your own machine
with your Hume API key, from inside the "dashboard" folder of the repo
(the one containing public/, src/, package.json), with
transcript_data.json in the same folder as this script:

    HUME_API_KEY=your_key_here python3 generate_voices_hume.py

Writes directly into public/audio/ as .mp3 — same filenames Piper/Edge
TTS already used, so this cleanly replaces them.
"""

import os
import sys
import json
import base64
import time
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT_PATH = os.path.join(SCRIPT_DIR, "transcript_data.json")
OUT_DIR = os.path.join(os.getcwd(), "public", "audio")

VOICE_ID = {
    "agent": "82a76fb8-3524-4e87-9265-9795c8e4ede6",
    "system": "82a76fb8-3524-4e87-9265-9795c8e4ede6",
    "patient": "5bbc32c1-a1f6-44e8-bedb-9870f23619e2",
}

API_URL = "https://api.hume.ai/v0/tts"


def synth_line(api_key, speaker, text, out_path, max_retries=3):
    body = {
        "utterances": [{
            "text": text,
            "voice": {"id": VOICE_ID[speaker], "provider": "HUME_AI"},
        }],
        "format": {"type": "mp3"},
    }
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                API_URL,
                data=json.dumps(body).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "X-Hume-Api-Key": api_key,
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            audio_b64 = data["generations"][0]["audio"]
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))
            return
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            if e.code == 429:
                wait = 20 * attempt
                if attempt == max_retries:
                    raise RuntimeError(f"HTTP {e.code}: {detail}")
                print(f"    rate limited, waiting {wait}s before retry {attempt}/{max_retries}...")
                time.sleep(wait)
                continue
            if attempt == max_retries:
                raise RuntimeError(f"HTTP {e.code}: {detail}")
            print(f"    retry {attempt}/{max_retries} after HTTP {e.code}...")
            time.sleep(2 * attempt)
        except Exception as e:
            if attempt == max_retries:
                raise
            print(f"    retry {attempt}/{max_retries} after error: {e}")
            time.sleep(2 * attempt)


def main():
    api_key = os.environ.get("HUME_API_KEY")
    if not api_key:
        print("ERROR: set HUME_API_KEY first, e.g.:")
        print("  HUME_API_KEY=your_key_here python3 generate_voices_hume.py")
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
            out_path = os.path.join(call_dir, f"{idx}.mp3")
            marker_path = os.path.join(call_dir, f"{idx}.hume_done")
            if os.path.exists(marker_path):
                print(f"[{done + 1}/{total}] {call_id} line {idx} ({speaker})... already done, skipping")
                done += 1
                continue
            print(f"[{done + 1}/{total}] {call_id} line {idx} ({speaker})...")
            try:
                synth_line(api_key, speaker, text, out_path)
                with open(marker_path, "w") as mf:
                    mf.write("ok")
                done += 1
            except Exception as e:
                print(f"    FAILED: {e}")
                failed.append((call_id, idx, str(e)))
            time.sleep(4.5)  # stay under free-tier rate limit (~15 requests/minute)

    print()
    print(f"Done: {done}/{total} lines generated into {OUT_DIR}")
    if failed:
        print(f"{len(failed)} lines failed:")
        for cid, idx, err in failed:
            print(f"  {cid} line {idx}: {err}")


if __name__ == "__main__":
    main()
