// /api/tts.js
// Server-side proxy for ElevenLabs text-to-speech.
// The API key lives only in this function's environment — the browser
// never sees it, it only ever talks to this endpoint.

const VOICE_IDS = {
  agent: "wAGzRVkxKEs8La0lmdrE",   // Sully — mature, deep, calm
  patient: "yj30vwTGJxSHezdAGsv9", // Jessa — easygoing, natural
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { text, speaker } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing 'text'" });
    return;
  }
  if (text.length > 600) {
    res.status(400).json({ error: "Text too long for a single line" });
    return;
  }

  const voiceId = VOICE_IDS[speaker] || VOICE_IDS.agent;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured on this deployment" });
    return;
  }

  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.8 },
        }),
      }
    );

    if (!elevenRes.ok) {
      const detail = await elevenRes.text();
      res.status(elevenRes.status).json({ error: "ElevenLabs request failed", detail });
      return;
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    // Cache aggressively — the same call/line text always produces the same audio,
    // so repeat plays (or repeat demos) don't re-spend ElevenLabs credits.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: "TTS request failed", detail: String(err) });
  }
}
