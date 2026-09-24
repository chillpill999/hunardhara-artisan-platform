// Supabase Edge Function: voice-catalog
// Sovereign Indic Voice Processing (Sarvam Saaras v4 ASR + Sarvam Bulbul TTS + End-to-End Speak-to-Catalog)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = [
    "https://hunardhara.technogamerzthenextlevel.workers.dev",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
  ];
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : (origin.endsWith(".workers.dev") ? origin : "*");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Expose-Headers": "x-request-id",
  };
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

interface StructuredVoiceError {
  success: false;
  transcript?: string;
  error: string;
  code: string;
  status: number;
  provider?: string;
  provider_status?: number;
  request_id: string;
}

interface TranscribeSuccess {
  success: true;
  transcript: string;
  language_code: string;
  source: string;
  request_id: string;
  provider_request_id?: string;
}

type TranscribeResult = TranscribeSuccess | StructuredVoiceError;

interface TTSResponse {
  success: boolean;
  audio_base64?: string;
  format: string;
  source: string;
  speaker?: string;
  language_code?: string;
  message: string;
  error?: string;
  code?: string;
  request_id: string;
}

function getWavDuration(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  // Verify 'RIFF' and 'WAVE' magic
  if (
    bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 || bytes[9] !== 0x41 || bytes[10] !== 0x56 || bytes[11] !== 0x45
  ) {
    return null;
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    if (chunkId === "fmt " && offset + 24 <= bytes.length) {
      byteRate = bytes[offset + 16] | (bytes[offset + 17] << 8) | (bytes[offset + 18] << 16) | (bytes[offset + 19] << 24);
    } else if (chunkId === "data") {
      dataSize = chunkSize > 0 ? chunkSize : (bytes.length - (offset + 8));
      break;
    }
    offset += 8 + (chunkSize > 0 ? chunkSize : 0);
  }
  if (byteRate > 0 && dataSize > 0) {
    return dataSize / byteRate;
  }
  return null;
}

async function verifyAuth(req: Request, requestId: string, corsHeaders: Record<string, string>): Promise<{ authorized: boolean; errorResponse?: Response; user?: any }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      errorResponse: new Response(
        JSON.stringify({
          success: false,
          error: "Authentication required. Bearer token missing in Authorization header.",
          code: "AUTH_REQUIRED",
          status: 401,
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      )
    };
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
      return {
        authorized: false,
        errorResponse: new Response(
          JSON.stringify({
            success: false,
            error: `Invalid or expired session token: ${error?.message || "User not found"}`,
            code: "AUTH_INVALID_TOKEN",
            status: 401,
            request_id: requestId,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        )
      };
    }

    const userRole = user.app_metadata?.role || user.user_metadata?.role || "artisan";
    return { authorized: true, user: { ...user, role: userRole } };
  } catch (err: any) {
    return {
      authorized: false,
      errorResponse: new Response(
        JSON.stringify({
          success: false,
          error: `Authentication verification error: ${err.message}`,
          code: "AUTH_VERIFICATION_ERROR",
          status: 401,
          request_id: requestId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      )
    };
  }
}

Deno.serve(async (req: Request) => {
  const requestId = req.headers.get("x-request-id") || generateRequestId();
  const corsHeaders = getCorsHeaders(req);

  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Validate Production Authentication / Authorization
  const auth = await verifyAuth(req, requestId, corsHeaders);
  if (!auth.authorized) {
    return auth.errorResponse!;
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
      const audioFile = (formData.get("file") || formData.get("audio")) as File | null;
      const languageCode = (formData.get("language_code") as string) || "hi-IN";
      const action = (formData.get("action") as string) || actionParam || "transcribe";

      // Validation 1: File existence
      if (!audioFile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No audio file provided in form-data ('file' or 'audio' field required)",
            code: "AUDIO_FILE_MISSING",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      // Validation 2: Byte length
      const audioBytes = new Uint8Array(await audioFile.arrayBuffer());
      if (audioBytes.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio file is empty or zero length",
            code: "AUDIO_EMPTY_OR_ZERO_LENGTH",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      // Validation 3: Maximum size limit (25 MB)
      if (audioBytes.length > 26214400) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio file exceeds maximum allowed size of 25MB for REST transcription",
            code: "AUDIO_FILE_TOO_LARGE",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      // Validation 4: Duration limit (<= 30 seconds)
      const explicitDurationStr = (formData.get("duration_seconds") || formData.get("duration") || "") as string;
      const explicitDuration = explicitDurationStr ? parseFloat(explicitDurationStr) : 0;
      if (explicitDuration > 30.0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio recording is too long. Please keep it under 30 seconds.",
            code: "AUDIO_DURATION_TOO_LONG",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const wavDuration = getWavDuration(audioBytes);
      if (wavDuration !== null && wavDuration > 30.0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio recording is too long. Please keep it under 30 seconds.",
            code: "AUDIO_DURATION_TOO_LONG",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      // Validation 5: Supported formats
      const filename = audioFile.name || "recording.wav";
      const validExtensions = [".wav", ".webm", ".ogg", ".opus", ".mp3", ".m4a", ".flac", ".aac"];
      const hasValidExt = validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
      const isAudioMime = !audioFile.type || audioFile.type.startsWith("audio/") || audioFile.type.includes("webm") || audioFile.type === "application/octet-stream";
      if (!hasValidExt && !isAudioMime) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unsupported audio format for '${filename}'. Supported formats: WAV, WebM, OGG, Opus, MP3, M4A, FLAC, AAC.`,
            code: "INVALID_AUDIO_FORMAT",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      // Call Sarvam Saaras v4 STT
      const asrResult = await transcribeWithSarvam(audioBytes, filename, languageCode, requestId);
      if (!asrResult.success) {
        return new Response(
          JSON.stringify(asrResult),
          { status: asrResult.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const transcript = (asrResult.transcript || "").trim();

      // Action: Simple Transcribe
      if (action === "transcribe") {
        return new Response(
          JSON.stringify(asrResult),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      // Action: End-to-End Speak-to-Catalog
      if (action === "speak-catalog" || action === "speak_catalog") {
        if (!transcript) {
          return new Response(
            JSON.stringify({
              success: false,
              transcript: "",
              error: "No speech was recognized. Please speak clearly and try again.",
              code: "STT_EMPTY_TRANSCRIPT",
              status: 422,
              request_id: requestId,
            }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
          );
        }

        const extractResult = await extractCraftAttributes(transcript, languageCode, requestId);

        if (extractResult.requires_clarification) {
          return new Response(
            JSON.stringify({
              success: true,
              requires_clarification: true,
              transcript: transcript,
              attributes: null,
              message_hi: extractResult.message_hi,
              message_en: extractResult.message_en,
              confirmation_audio_base64: null,
              source: "sarvam_saaras_v4",
              request_id: requestId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
          );
        }

        if (!extractResult.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: extractResult.error || "Failed to extract craft attributes",
              code: extractResult.code || "AI_EXTRACTION_FAILED",
              status: extractResult.status || 502,
              request_id: requestId,
            }),
            { status: extractResult.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
          );
        }

        let confirmationAudioBase64: string | null = null;
        if (extractResult.attributes) {
          try {
            const script = extractResult.attributes.voice_script_hi || `आपका उत्पाद ${extractResult.attributes.product_name_hi || "शिल्प"} तैयार है।`;
            const ttsRes = await synthesizeWithSarvam(script, languageCode, "shubh", "bulbul:v3", requestId);
            if (ttsRes.success && ttsRes.audio_base64) {
              confirmationAudioBase64 = ttsRes.audio_base64;
            }
          } catch (e) {
            console.warn("TTS confirmation synthesis skipped (non-fatal):", e);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            requires_clarification: false,
            transcript: transcript,
            attributes: extractResult.attributes || null,
            message_hi: extractResult.message_hi,
            message_en: extractResult.message_en,
            confirmation_audio_base64: confirmationAudioBase64,
            source: "sarvam_saaras_v4",
            request_id: requestId,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }
    }

    // -------------------------------------------------------------
    // Route 2: Application/JSON (TTS, Chat, or Transcribe from base64)
    // -------------------------------------------------------------
    const body = await req.json();
    const action = body.action || actionParam;

    // Sub-route: TTS
    if (action === "tts" || action === "text-to-speech" || body.text) {
      const text = body.text || "";
      const languageCode = body.language_code || body.target_language_code || "hi-IN";
      const speaker = body.speaker || "shubh";
      const model = body.model || "bulbul:v3";

      if (!text.trim()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Text is required for TTS synthesis",
            code: "TEXT_REQUIRED",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const ttsResult = await synthesizeWithSarvam(text, languageCode, speaker, model, requestId);
      return new Response(
        JSON.stringify(ttsResult),
        { status: ttsResult.success ? 200 : (ttsResult.code === "MISSING_PROVIDER_SECRET" ? 500 : 502), headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
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

      if (bytes.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio file is empty or zero length",
            code: "AUDIO_EMPTY_OR_ZERO_LENGTH",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const durationParam = body.duration_seconds || body.duration || 0;
      if (durationParam > 30.0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio recording is too long. Please keep it under 30 seconds.",
            code: "AUDIO_DURATION_TOO_LONG",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const wavDuration = getWavDuration(bytes);
      if (wavDuration !== null && wavDuration > 30.0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Audio recording is too long. Please keep it under 30 seconds.",
            code: "AUDIO_DURATION_TOO_LONG",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const asrResult = await transcribeWithSarvam(bytes, filename, languageCode, requestId);
      return new Response(
        JSON.stringify(asrResult),
        { status: asrResult.success ? 200 : (asrResult.status || 502), headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      );
    }

    // Sub-route: Chat (Hunar Saathi)
    if (action === "chat" || body.message) {
      const message = body.message || "";
      const context = body.context || "";
      const systemPrompt = body.system_prompt || "You are Hunar Saathi, a warm, culturally respectful AI companion helping rural Indian artisans. Reply primarily in clear, simple Hindi.";

      const chatResult = await chatWithSarvam(message, systemPrompt, context, requestId);
      return new Response(
        JSON.stringify(chatResult),
        { status: chatResult.success ? 200 : (chatResult.status || 502), headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      );
    }

    // Sub-route: Speakers list
    if (action === "speakers") {
      return new Response(
        JSON.stringify({
          success: true,
          recommended_hindi: [
            { id: "shubh", name: "Shubh (शुभ)", tone: "Friendly, warm male guide", gender: "male" },
            { id: "sanchita_hi_assistant", name: "Sanchita (संचिता)", tone: "Compassionate female assistant", gender: "female" },
            { id: "roopa_hi_conversational", name: "Roopa (रूपा)", tone: "Artisan conversational elder", gender: "female" },
            { id: "aditya_hi_conversational", name: "Aditya (आदित्य)", tone: "Youthful advisor", gender: "male" }
          ],
          default: "shubh",
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid action or payload. Specify action='transcribe', 'tts', 'chat', or 'speak-catalog'.",
        code: "INVALID_ACTION",
        status: 400,
        request_id: requestId,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
    );
  } catch (err: any) {
    console.error("voice-catalog edge function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal voice service error",
        code: "INTERNAL_ERROR",
        status: 500,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
    );
  }
});

// Helper: Transcribe audio using Sarvam Saaras v4 STT API with bounded timeout & at most 1 retry
async function transcribeWithSarvam(
  audioBytes: Uint8Array,
  filename: string,
  languageCode: string,
  requestId: string
): Promise<TranscribeResult> {
  if (!SARVAM_API_KEY) {
    return {
      success: false,
      transcript: "",
      error: "SARVAM_API_KEY is not configured in Supabase Edge Function environment",
      code: "MISSING_PROVIDER_SECRET",
      status: 500,
      provider: "sarvam",
      request_id: requestId,
    };
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "wav";
  let mimeType = "audio/wav";
  if (ext === "webm") mimeType = "audio/webm";
  else if (ext === "ogg" || ext === "opus") mimeType = "audio/ogg";
  else if (ext === "mp3") mimeType = "audio/mpeg";
  else if (ext === "m4a") mimeType = "audio/m4a";
  else if (ext === "flac") mimeType = "audio/flac";
  else if (ext === "aac") mimeType = "audio/aac";

  const fileBlob = new Blob([audioBytes], { type: mimeType });

  let attempt = 0;
  const maxAttempts = 2; // Initial attempt + at most 1 retry for 429/503/network error

  while (attempt < maxAttempts) {
    attempt++;
    const fd = new FormData();
    fd.append("file", fileBlob, filename);
    fd.append("model", "saaras:v4");
    fd.append("mode", "transcribe");
    fd.append("language_code", languageCode || "hi-IN");

    try {
      const res = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
        },
        body: fd,
        signal: AbortSignal.timeout(25000), // 25s upstream timeout
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");

        // 400 / 422 -> SARVAM_VALIDATION_ERROR (status 400) - No retry
        if (res.status === 400 || res.status === 422) {
          return {
            success: false,
            transcript: "",
            error: `Sarvam validation error: HTTP ${res.status}: ${errText}`,
            code: "SARVAM_VALIDATION_ERROR",
            status: 400,
            provider: "sarvam",
            provider_status: res.status,
            request_id: requestId,
          };
        }

        // 401 / 403 -> SARVAM_AUTH_ERROR (status 502) - No retry
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            transcript: "",
            error: `Sarvam authentication error: HTTP ${res.status}: ${errText}`,
            code: "SARVAM_AUTH_ERROR",
            status: 502,
            provider: "sarvam",
            provider_status: res.status,
            request_id: requestId,
          };
        }

        // 429 -> SARVAM_RATE_LIMIT (status 429) - Retry once if first attempt
        if (res.status === 429) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          return {
            success: false,
            transcript: "",
            error: "Sarvam rate limit exceeded. Please wait a moment and try again.",
            code: "SARVAM_RATE_LIMIT",
            status: 429,
            provider: "sarvam",
            provider_status: res.status,
            request_id: requestId,
          };
        }

        // 503 -> SARVAM_SERVICE_UNAVAILABLE (status 503) - Retry once if first attempt
        if (res.status === 503) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          return {
            success: false,
            transcript: "",
            error: "Sarvam speech recognition service temporarily unavailable. Please try again.",
            code: "SARVAM_SERVICE_UNAVAILABLE",
            status: 503,
            provider: "sarvam",
            provider_status: res.status,
            request_id: requestId,
          };
        }

        // 500 or other upstream error -> SARVAM_UPSTREAM_ERROR (status 502) - No retry
        return {
          success: false,
          transcript: "",
          error: `Sarvam upstream error: HTTP ${res.status}: ${errText}`,
          code: "SARVAM_UPSTREAM_ERROR",
          status: 502,
          provider: "sarvam",
          provider_status: res.status,
          request_id: requestId,
        };
      }

      const data = await res.json();
      const transcript = (data.transcript || "").trim();

      // Empty transcript check: Must return 422 STT_EMPTY_TRANSCRIPT
      if (!transcript) {
        return {
          success: false,
          transcript: "",
          error: "No speech was recognized. Please speak clearly and try again.",
          code: "STT_EMPTY_TRANSCRIPT",
          status: 422,
          provider: "sarvam",
          request_id: requestId,
        };
      }

      return {
        success: true,
        transcript,
        language_code: data.language_code || languageCode,
        source: "sarvam_saaras_v4",
        provider_request_id: data.request_id,
        request_id: requestId,
      };
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        return {
          success: false,
          transcript: "",
          error: "Speech recognition timed out. Please try again.",
          code: "STT_TIMEOUT",
          status: 504,
          provider: "sarvam",
          request_id: requestId,
        };
      }

      // Network error: allow 1 retry
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      return {
        success: false,
        transcript: "",
        error: e.message || "Network error connecting to speech service",
        code: "STT_NETWORK_ERROR",
        status: 502,
        provider: "sarvam",
        request_id: requestId,
      };
    }
  }

  return {
    success: false,
    transcript: "",
    error: "Speech recognition failed after bounded retry.",
    code: "STT_NETWORK_ERROR",
    status: 502,
    provider: "sarvam",
    request_id: requestId,
  };
}

// Helper: Synthesize speech using Sarvam Bulbul TTS (bounded <= 12s timeout)
async function synthesizeWithSarvam(
  text: string,
  languageCode: string,
  speaker: string,
  model: string,
  requestId: string
): Promise<TTSResponse> {
  if (!SARVAM_API_KEY) {
    return {
      success: false,
      format: "wav",
      source: "sarvam_bulbul",
      message: "SARVAM_API_KEY missing in environment",
      error: "Missing API key",
      code: "MISSING_PROVIDER_SECRET",
      request_id: requestId,
    };
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
      signal: AbortSignal.timeout(12000), // Bounded 12s timeout
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        format: "wav",
        source: "sarvam_bulbul",
        message: `Sarvam TTS HTTP ${res.status}: ${errText}`,
        error: errText,
        code: res.status === 401 || res.status === 403 ? "SARVAM_AUTH_ERROR" : "SARVAM_TTS_ERROR",
        request_id: requestId,
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
        request_id: requestId,
      };
    }

    return {
      success: false,
      format: "wav",
      source: "sarvam_bulbul",
      message: "No audio returned from Sarvam Bulbul",
      code: "SARVAM_EMPTY_AUDIO",
      request_id: requestId,
    };
  } catch (e: any) {
    return {
      success: false,
      format: "wav",
      source: "sarvam_bulbul",
      message: e.message || "TTS error",
      error: e.message,
      code: e.name === "TimeoutError" || e.name === "AbortError" ? "TTS_TIMEOUT" : "TTS_REQUEST_FAILED",
      request_id: requestId,
    };
  }
}

// Helper: Chat completion via Sarvam 105B (bounded 15s timeout, NO fake success fallback)
async function chatWithSarvam(message: string, systemPrompt: string, context?: string, requestId: string = "") {
  if (!message.trim()) {
    return {
      success: false,
      reply: "",
      error: "Message cannot be empty",
      code: "INVALID_INPUT",
      status: 400,
      request_id: requestId,
    };
  }

  if (!SARVAM_API_KEY) {
    return {
      success: false,
      reply: "",
      error: "SARVAM_API_KEY is not configured",
      code: "MISSING_PROVIDER_SECRET",
      status: 500,
      request_id: requestId,
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
        max_tokens: 300,
        temperature: 0.2,
        reasoning_effort: null,
      }),
      signal: AbortSignal.timeout(15000), // 15s hard timeout
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let code = "AI_PROVIDER_ERROR";
      let status = 502;
      if (res.status === 401 || res.status === 403) {
        code = "AI_AUTH_ERROR";
        status = 502;
      } else if (res.status === 429) {
        code = "AI_RATE_LIMIT";
        status = 429;
      }
      return {
        success: false,
        reply: "",
        error: `AI provider error HTTP ${res.status}: ${errText}`,
        code,
        status,
        request_id: requestId,
      };
    }

    const data = await res.json();
    const reply = (data.choices?.[0]?.message?.content || "").trim();
    if (!reply) {
      return {
        success: false,
        reply: "",
        error: "AI returned an empty response.",
        code: "AI_EMPTY_RESPONSE",
        status: 422,
        request_id: requestId,
      };
    }

    return {
      success: true,
      reply,
      model: "sarvam-105b",
      request_id: requestId,
    };
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return {
        success: false,
        reply: "",
        error: "AI response timed out. Please try again.",
        code: "AI_PROVIDER_TIMEOUT",
        status: 504,
        request_id: requestId,
      };
    }
    return {
      success: false,
      reply: "",
      error: e.message || "Network error connecting to AI provider",
      code: "AI_PROVIDER_ERROR",
      status: 502,
      request_id: requestId,
    };
  }
}

// Helper: Extract craft attributes via Sarvam LLM (bounded 15s timeout, NO fake attributes)
async function extractCraftAttributes(transcript: string, languageCode: string, requestId: string): Promise<any> {
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
      request_id: requestId,
    };
  }

  const prompt = `You are a handicraft cataloging AI for Indian artisans.
Extract structured craft attributes from this artisan description:
"${clean}"

Respond with ONLY valid JSON without markdown formatting:
{
  "product_name_hi": "उत्पाद का नाम हिंदी में या null",
  "product_name_en": "Product Name in English or null",
  "craft_type": "Specific Craft (e.g. Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Painting, Channapatna Toys) or null",
  "materials": ["material 1"],
  "dimensions": null,
  "color": null,
  "production_days": null,
  "material_cost": null,
  "description_hi": "विस्तृत विवरण हिंदी में",
  "description_en": "Detailed description in English",
  "voice_script_hi": "पुष्टि ऑडियो स्क्रिप्ट"
}`;

  if (SARVAM_API_KEY) {
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
          max_tokens: 500,
          temperature: 0.1,
          reasoning_effort: null,
        }),
        signal: AbortSignal.timeout(15000), // 15s hard timeout
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.choices?.[0]?.message?.content || "";
        if (!rawText.trim()) {
          return {
            success: false,
            error: "AI returned an empty response.",
            code: "AI_EMPTY_RESPONSE",
            status: 422,
            request_id: requestId,
          };
        }
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          normalizeCraft(parsed, clean);
          return { success: true, requires_clarification: false, attributes: parsed, request_id: requestId };
        }
      }
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        return {
          success: false,
          error: "AI response timed out. Please try again.",
          code: "AI_PROVIDER_TIMEOUT",
          status: 504,
          request_id: requestId,
        };
      }
      console.warn("Sarvam extraction error in voice-catalog:", e);
    }
  }

  // Fallback to OpenRouter Gemma if configured
  if (OPENROUTER_API_KEY) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it:free",
          messages: [
            { role: "system", content: "You are a strict JSON-only API. Output only raw JSON." },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(12000), // 12s timeout
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          normalizeCraft(parsed, clean);
          return { success: true, requires_clarification: false, attributes: parsed, request_id: requestId };
        }
      }
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        return {
          success: false,
          error: "AI response timed out. Please try again.",
          code: "AI_PROVIDER_TIMEOUT",
          status: 504,
          request_id: requestId,
        };
      }
      console.warn("OpenRouter fallback error in voice-catalog:", e);
    }
  }

  // Strict Truthfulness: DO NOT fabricate fake success attributes
  return {
    success: false,
    error: "AI craft extraction failed. Please try again.",
    code: "AI_EXTRACTION_FAILED",
    status: 502,
    request_id: requestId,
  };
}

function normalizeCraft(parsed: any, clean: string) {
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
  if (days != null && cost != null && !isNaN(days) && !isNaN(cost) && days > 0 && cost > 0) {
    const floor = Math.round((cost + days * 650) / 10) * 10;
    parsed.wage_floor = floor;
    parsed.recommended_price = Math.round((floor * 1.25) / 10) * 10;
  }
}
