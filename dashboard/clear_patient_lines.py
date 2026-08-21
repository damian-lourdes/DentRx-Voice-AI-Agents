#!/usr/bin/env python3
"""
Clears only the patient-voice audio files (and their .hume_done markers)
so the next run of generate_voices_hume.py regenerates just those lines
with the new patient voice — agent lines are untouched and stay skipped.

Run from inside the "dashboard" folder, with transcript_data.json present:
    python3 clear_patient_lines.py
"""
import os
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSCRIPT_PATH = os.path.join(SCRIPT_DIR, "transcript_data.json")
AUDIO_DIR = os.path.join(os.getcwd(), "public", "audio")

with open(TRANSCRIPT_PATH) as f:
    transcript_data = json.load(f)

cleared = 0
for call_id, lines in transcript_data:
    for idx, (speaker, text) in enumerate(lines):
        if speaker != "patient":
            continue
        for ext in (".mp3", ".hume_done"):
            path = os.path.join(AUDIO_DIR, call_id, f"{idx}{ext}")
            if os.path.exists(path):
                os.remove(path)
                cleared += 1

print(f"Cleared {cleared} files. Now re-run: python3 generate_voices_hume.py")
