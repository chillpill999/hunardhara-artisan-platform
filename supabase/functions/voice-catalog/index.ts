// Supabase Edge Function: voice-catalog
// Sovereign Indic Voice Processing (Sarvam Saarika ASR + Sarvam Bulbul TTS + End-to-End Speak-to-Catalog)

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface TranscribeResponse {
  success: boolean;
  transcript: string;
  language_code?: string;
  source?: string;
  error?: string;
}

interface TTSResponse {
  success: boolean;
  audio_base64?: string;
  format: string;
  source: string;
  speaker?: string;
  language_code?: string;
  message: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const actionParam = url.searchParams.get("action");
  const contentType = req.headers.get("content-type") || "";

  try {
    // -------------------------------------------------------------
    // Route 1: Multipart Form Data (ASR or Speak-to-Catalog)
    // -------------------------------------------------------------
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = (formData.get("audio") || formData.get("file")) as File | null;
      const languageCode = (formData.get("language_code") as string) || "hi-IN";
      const action = (formData.get("action") as string) || actionParam || "transcribe";

      if (!audioFile) {
        return new Response(
          JSON.stringify({ success: false, error: "No audio file provided in form-data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const audioBytes = new Uint8Array(await audioFile.arrayBuffer());
      if (audioBytes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "AUDIO_EMPTY_OR_ZERO_LENGTH" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Transcribe via Sarvam Saarika / Saaras
      const asrResult = await transcribeWithSarvam(audioBytes, audioFile.name || "audio.wav", languageCode);
      if (!asrResult.success) {
        return new Response(
          JSON.stringify(asrResult),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const transcript = (asrResult.transcript || "").trim();

      // If action is only transcribe, return transcript
      if (action === "transcribe") {
        return new Response(
          JSON.stringify(asrResult),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If action is speak-to-catalog, run end-to-end extraction
      if (action === "speak-catalog" || action === "speak_catalog") {
        if (!transcript) {
          return new Response(
            JSON.stringify({ success: false, error: "AUDIO_SILENT_OR_INCOMPREHENSIBLE" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const extractResult = await extractCraftAttributes(transcript, languageCode);

        let confirmationAudioBase64: string | null = null;
        if (extractResult.success && !extractResult.requires_clarification && extractResult.attributes) {
          try {
            const script = extractResult.attributes.voice_script_hi || `आपका उत्पाद ${extractResult.attributes.product_name_hi || "शिल्प"} तैयार है।`;
            const ttsRes = await synthesizeWithSarvam(script, languageCode, "shubh", "bulbul:v3");
            if (ttsRes.success && ttsRes.audio_base64) {
              confirmationAudioBase64 = ttsRes.audio_base64;
            }
          } catch (e) {
            console.warn("TTS confirmation synthesis skipped:", e);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            requires_clarification: extractResult.requires_clarification || false,
            transcript: transcript,
            attributes: extractResult.attributes || null,
            message_hi: extractResult.message_hi,
            message_en: extractResult.message_en,
            confirmation_audio_base64: confirmationAudioBase64,
            source: "sarvam_ai_suite"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // -------------------------------------------------------------
    // Route 2: Application/JSON (TTS, Chat, or Transcribe from base64)
    // -------------------------------------------------------------
    const body = await req.json();
    const action = body.action || actionParam;

    // Sub-route: TTS
    if (action === "tts" || body.text) {
      const text = body.text || "";
      const languageCode = body.language_code || "hi-IN";
      const speaker = body.speaker || "shubh";
      const model = body.model || "bulbul:v3";

      if (!text.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: "Text is required for TTS synthesis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ttsResult = await synthesizeWithSarvam(text, languageCode, speaker, model);
      return new Response(
        JSON.stringify(ttsResult),
        { status: ttsResult.success ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sub-route: Chat (Hunar Saathi)
    if (action === "chat" || body.message) {
      const message = body.message || "";
      const context = body.context || "";
      const systemPrompt = body.system_prompt || "You are Hunar Saathi, a warm, culturally respectful AI companion helping rural Indian artisans. Reply primarily in clear, simple Hindi.";

      const chatResult = await chatWithSarvam(message, systemPrompt, context);
      return new Response(
        JSON.stringify(chatResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sub-route: Transcribe from base64
    if (action === "transcribe" && body.audio_base64) {
      const binaryString = atob(body.audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const filename = body.filename || "recording.wav";
      const languageCode = body.language_code || "hi-IN";

      const asrResult = await transcribeWithSarvam(bytes, filename, languageCode);
      return new Response(
        JSON.stringify(asrResult),
        { status: asrResult.success ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sub-route: Speakers list
    if (action === "speakers") {
      return new Response(
        JSON.stringify({
          recommended_hindi: [
            { id: "shubh", name: "Shubh (शुभ)", tone: "Friendly, warm male guide", gender: "male" },
            { id: "sanchita_hi_assistant", name: "Sanchita (संचिता)", tone: "Compassionate female assistant", gender: "female" },
            { id: "roopa_hi_conversational", name: "Roopa (रूपा)", tone: "Artisan conversational elder", gender: "female" },
            { id: "aditya_hi_conversational", name: "Aditya (आदित्य)", tone: "Youthful advisor", gender: "male" }
          ],
          default: "shubh"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action or payload. Specify action='transcribe', 'tts', 'chat', or 'speak-catalog'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("voice-catalog edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal voice service error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Transcribe audio using Sarvam ASR
async function transcribeWithSarvam(
  audioBytes: Uint8Array,
  filename: string,
  languageCode: string
): Promise<TranscribeResponse> {
  if (!SARVAM_API_KEY) {
    return { success: false, transcript: "", error: "SARVAM_API_KEY missing in environment" };
  }

  const boundary = "----SarvamDenoBoundary" + Math.random().toString(36).substring(2);
  const ext = filename.split(".").pop()?.toLowerCase() || "wav";
  let mimeType = "audio/wav";
  if (ext === "webm") mimeType = "audio/webm";
  else if (ext === "ogg" || ext === "opus") mimeType = "audio/ogg";
  else if (ext === "mp3") mimeType = "audio/mpeg";
  else if (ext === "m4a") mimeType = "audio/m4a";

  const fileBlob = new Blob([audioBytes], { type: mimeType });
  const fd = new FormData();
  fd.append("model", "saarika:v2.5");
  fd.append("language_code", languageCode.startsWith("hi") ? "hi-IN" : languageCode);
  fd.append("file", fileBlob, filename);

  try {
    const res = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: fd,
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, transcript: "", error: `Sarvam ASR HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return {
      success: true,
      transcript: data.transcript || "",
      language_code: data.language_code || languageCode,
      source: "sarvam_saarika",
    };
  } catch (e: any) {
    return { success: false, transcript: "", error: e.message || "ASR request failed" };
  }
}

// Helper: Synthesize speech using Sarvam Bulbul TTS
async function synthesizeWithSarvam(
  text: string,
  languageCode: string,
  speaker: string,
  model: string
): Promise<TTSResponse> {
  if (!SARVAM_API_KEY) {
    return { success: false, format: "wav", source: "sarvam_bulbul", message: "SARVAM_API_KEY missing", error: "Missing API key" };
  }

  try {
    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: languageCode.startsWith("hi") ? "hi-IN" : languageCode,
        speaker: speaker || "shubh",
        model: model || "bulbul:v3",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        format: "wav",
        source: "sarvam_bulbul",
        message: `Sarvam TTS HTTP ${res.status}: ${errText}`,
        error: errText,
      };
    }

    const data = await res.json();
    const audios = data.audios || [];
    if (audios.length > 0) {
      return {
        success: true,
        audio_base64: audios[0],
        format: "wav",
        source: "sarvam_bulbul",
        speaker,
        language_code: languageCode,
        message: "Speech synthesized successfully",
      };
    }

    return {
      success: false,
      format: "wav",
      source: "sarvam_bulbul",
      message: "No audio returned from Sarvam Bulbul",
    };
  } catch (e: any) {
    return {
      success: false,
      format: "wav",
      source: "sarvam_bulbul",
      message: e.message || "TTS error",
      error: e.message,
    };
  }
}

// Helper: Chat completion via Sarvam 105B
async function chatWithSarvam(message: string, systemPrompt: string, context?: string) {
  if (!SARVAM_API_KEY) {
    return {
      success: true,
      reply: "मैं समझ गया। आप निश्चिंत रहें, आपका हुनर अनमोल है। आप चाहें तो ऊपर दिए गए बटन दबाकर उत्पाद जोड़ सकते हैं।",
      model: "offline_fallback",
    };
  }

  try {
    const messages = [
      { role: "system", content: systemPrompt + (context ? `\nContext: ${context}` : "") },
      { role: "user", content: message },
    ];

    const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sarvam-105b-conversations",
        messages,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "";
      return { success: true, reply, model: "sarvam-105b" };
    }
  } catch (e) {
    console.warn("Sarvam chat failed:", e);
  }

  return {
    success: true,
    reply: "नमस्ते! मैं हुनर साथी हूँ। मैं आपके शिल्प को डिजिटल दुनिया तक पहुँचाने में आपकी सहायता करूँगा।",
    model: "fallback",
  };
}

// Helper: Extract craft attributes via Sarvam LLM
async function extractCraftAttributes(transcript: string, languageCode: string): Promise<any> {
  const clean = transcript.trim();
  const lower = clean.toLowerCase();

  const isGreetingOnly =
    clean.length < 15 &&
    (lower.includes("नमस्ते") || lower.includes("नमस्कार") || lower.includes("हेलो") || lower.includes("hello") || lower.includes("hi"));

  if (isGreetingOnly) {
    return {
      success: true,
      requires_clarification: true,
      message_hi: "नमस्ते शिल्पकार जी! कृपया अपने शिल्प का नाम, सामग्री और बनाने का समय बताएं।",
      message_en: "Greetings artisan! Please describe your craft item, materials used, and time to make.",
      attributes: null,
    };
  }

  const prompt = `You are a handicraft cataloging AI for Indian artisans.
Extract structured craft attributes from this artisan description:
"${clean}"

Respond with ONLY valid JSON without markdown formatting:
{
  "product_name_hi": "उत्पाद का नाम हिंदी में",
  "product_name_en": "Product Name in English",
  "craft_type": "Specific Craft (e.g. Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Painting, Channapatna Toys)",
  "materials": ["material 1", "material 2"],
  "dimensions": null or "string dimensions",
  "color": null or "color name",
  "production_days": null or integer number of days,
  "material_cost": null or integer cost in INR,
  "description_hi": "विस्तृत विवरण हिंदी में",
  "description_en": "Detailed description in English",
  "voice_script_hi": "पुष्टि ऑडियो स्क्रिप्ट"
}`;

  try {
    const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sarvam-105b-conversations",
        messages: [
          { role: "system", content: "You are a strict JSON-only API. Never output preamble, explanation, or markdown fences." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || "";
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        normalizeCraft(parsed, clean);
        return { success: true, requires_clarification: false, attributes: parsed };
      }
    }
  } catch (e) {
    console.warn("Sarvam extraction error in voice-catalog:", e);
  }

  // Fallback extraction heuristic
  const fallbackAttrs: any = {
    product_name_hi: "पारंपरिक हस्तशिल्प",
    product_name_en: "Traditional Handcrafted Art",
    craft_type: "Indian Handicraft",
    materials: ["प्राकृतिक सामग्री"],
    dimensions: null,
    color: null,
    production_days: 3,
    material_cost: 500,
    description_hi: clean,
    description_en: "Handcrafted authentic Indian artisan product.",
    voice_script_hi: "बधाई हो! आपका उत्पाद विवरण तैयार है।",
  };
  normalizeCraft(fallbackAttrs, clean);
  return { success: true, requires_clarification: false, attributes: fallbackAttrs };
}

function normalizeCraft(parsed: any, clean: string) {
  const ctLower = (parsed.craft_type || "").toLowerCase();
  const textLower = clean.toLowerCase();

  if (textLower.includes("वाराणसी") || textLower.includes("बनारस") || textLower.includes("varanasi") || textLower.includes("banarasi") || textLower.includes("कतान")) {
    parsed.craft_type = "Varanasi Silk";
  } else if (textLower.includes("बस्तर") || textLower.includes("bastar") || textLower.includes("ढोकरा") || textLower.includes("dhokra")) {
    parsed.craft_type = "Bastar Dhokra";
  } else if (textLower.includes("खुर्जा") || textLower.includes("khurja") || textLower.includes("पॉटरी")) {
    parsed.craft_type = "Khurja Pottery";
  } else if (textLower.includes("मधुबनी") || textLower.includes("मिथिला") || textLower.includes("madhubani")) {
    parsed.craft_type = "Madhubani Painting";
  } else if (textLower.includes("चन्नपटना") || textLower.includes("चन्नापटना") || textLower.includes("channapatna")) {
    parsed.craft_type = "Channapatna Toys";
  }

  const days = parsed.production_days != null ? Number(parsed.production_days) : null;
  const cost = parsed.material_cost != null ? Number(parsed.material_cost) : null;
  if (days != null && cost != null && !isNaN(days) && !isNaN(cost)) {
    const floor = Math.round((cost + days * 650) / 10) * 10;
    parsed.wage_floor = floor;
    parsed.recommended_price = Math.round((floor * 1.25) / 10) * 10;
  }
}
