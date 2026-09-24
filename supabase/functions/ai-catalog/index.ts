// Supabase Edge Function: ai-catalog
// Intelligent Indic Craft Extraction & Conversational Assistant (Sarvam 105B LLM + OpenRouter Failover)
// Strictly bounded timeouts, no infinite reasoning, zero fake success fallbacks.

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

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

Deno.serve(async (req: Request) => {
  const requestId = req.headers.get("x-request-id") || generateRequestId();
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "extract-craft";

    // -------------------------------------------------------------
    // Action: Chat (Hunar Saathi)
    // -------------------------------------------------------------
    if (action === "chat") {
      const message = (body.message || "").trim();
      const context = body.context || "";
      const systemPrompt = body.system_prompt || "You are Hunar Saathi, a warm, culturally respectful AI companion helping rural Indian artisans. Reply concisely and warmly in clear, simple Hindi.";

      if (!message) {
        return new Response(
          JSON.stringify({
            success: false,
            reply: "",
            error: "Message cannot be empty",
            code: "INVALID_INPUT",
            status: 400,
            request_id: requestId,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
        );
      }

      const res = await runChat(message, systemPrompt, context, requestId);
      return new Response(JSON.stringify(res), {
        status: res.status || (res.success ? 200 : 502),
        headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
      });
    }

    // -------------------------------------------------------------
    // Action: extract-craft
    // -------------------------------------------------------------
    const transcript = (body.transcript || "").trim();
    const languageCode = body.language_code || "hi-IN";

    if (!transcript) {
      return new Response(
        JSON.stringify({
          success: true,
          requires_clarification: true,
          message_hi: "कृपया अपने शिल्प का विवरण बोलें या लिखें।",
          message_en: "Please speak or write your craft description.",
          attributes: null,
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      );
    }

    const lower = transcript.toLowerCase();
    const isGreetingOnly =
      transcript.length < 20 &&
      (lower === "नमस्ते" || lower === "नमस्कार" || lower === "हेलो" || lower === "hello" || lower === "hi" || lower === "राम राम");

    if (isGreetingOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          requires_clarification: true,
          message_hi: "नमस्ते शिल्पकार जी! कृपया अपने शिल्प का नाम, सामग्री और बनाने का समय बताएं।",
          message_en: "Greetings artisan! Please describe your craft item, materials used, and time to make.",
          attributes: null,
          transcript,
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
      );
    }

    const extraction = await extractCraft(transcript, languageCode, requestId);
    return new Response(JSON.stringify(extraction), {
      status: extraction.status || (extraction.success ? 200 : 502),
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
    });
  } catch (err: any) {
    console.error("ai-catalog edge function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal AI service error",
        code: "INTERNAL_ERROR",
        status: 500,
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } }
    );
  }
});

// Run Chat with hard timeout (Sarvam 105B: 15s, OpenRouter: 12s)
// NO fake success fallbacks.
async function runChat(
  message: string,
  systemPrompt: string,
  context: string,
  requestId: string
): Promise<{ success: boolean; reply: string; model?: string; provider?: string; error?: string; code?: string; status?: number; request_id: string }> {
  // 1. Try Sarvam 105B
  if (SARVAM_API_KEY) {
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

        // If not a rate limit or auth error, try OpenRouter fallback
        if (res.status !== 429 && res.status !== 401 && res.status !== 403 && OPENROUTER_API_KEY) {
          console.warn(`Sarvam 105B returned HTTP ${res.status}, attempting OpenRouter fallback`);
        } else {
          return {
            success: false,
            reply: "",
            error: `AI provider error HTTP ${res.status}: ${errText}`,
            code,
            status,
            request_id: requestId,
          };
        }
      } else {
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
          provider: "sarvam",
          request_id: requestId,
        };
      }
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        if (!OPENROUTER_API_KEY) {
          return {
            success: false,
            reply: "",
            error: "AI response timed out. Please try again.",
            code: "AI_PROVIDER_TIMEOUT",
            status: 504,
            request_id: requestId,
          };
        }
        console.warn("Sarvam 105B timed out, attempting OpenRouter fallback");
      }
    }
  }

  // 2. OpenRouter Failover
  if (OPENROUTER_API_KEY) {
    try {
      const messages = [
        { role: "system", content: systemPrompt + (context ? `\nContext: ${context}` : "") },
        { role: "user", content: message },
      ];

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemma-4-31b-it:free",
          messages,
          max_tokens: 300,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(12000), // 12s bounded timeout
      });

      if (res.ok) {
        const data = await res.json();
        const reply = (data.choices?.[0]?.message?.content || "").trim();
        if (reply) {
          return {
            success: true,
            reply,
            model: "gemma-4-31b-it",
            provider: "openrouter",
            request_id: requestId,
          };
        }
      }
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
    }
  }

  // Return bounded structured error - NEVER fake success!
  return {
    success: false,
    reply: "",
    error: "AI chat service is currently unavailable. Please try again later.",
    code: "AI_PROVIDER_ERROR",
    status: 502,
    request_id: requestId,
  };
}

// Extract Craft with hard timeout (Sarvam 105B: 15s, OpenRouter: 12s)
// NO fake attributes invented on failure.
async function extractCraft(
  transcript: string,
  languageCode: string,
  requestId: string
): Promise<any> {
  const clean = transcript.trim();
  const prompt = `You are a handicraft cataloging AI for Indian artisans.
Extract structured craft attributes from this artisan description:
"${clean}"

Respond with ONLY valid JSON without markdown formatting:
{
  "product_name_hi": "उत्पाद का नाम हिंदी में या null",
  "product_name_en": "Product Name in English or null",
  "craft_type": "Specific Craft Name (e.g. Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Painting, Channapatna Toys) or null",
  "materials": ["material 1"],
  "dimensions": null,
  "color": null,
  "production_days": null,
  "material_cost": null,
  "description_hi": "विस्तृत विवरण हिंदी में",
  "description_en": "Detailed description in English",
  "voice_script_hi": "शिल्पकार के लिए वॉयस पुष्टि स्क्रिप्ट"
}`;

  // 1. Try Sarvam 105B
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

        if (res.status === 429 || res.status === 401 || res.status === 403 || !OPENROUTER_API_KEY) {
          return {
            success: false,
            error: `AI provider error HTTP ${res.status}: ${errText}`,
            code,
            status,
            request_id: requestId,
          };
        }
      } else {
        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content || "").trim();

        if (!raw) {
          return {
            success: false,
            error: "AI returned an empty response.",
            code: "AI_EMPTY_RESPONSE",
            status: 422,
            request_id: requestId,
          };
        }

        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
          return {
            success: false,
            error: "AI response did not contain valid JSON format.",
            code: "AI_INVALID_JSON",
            status: 422,
            request_id: requestId,
          };
        }

        try {
          const parsed = JSON.parse(match[0]);
          normalizeCraft(parsed, clean);
          return {
            success: true,
            requires_clarification: false,
            attributes: parsed,
            confidence_score: 0.95,
            source: "sarvam_105b",
            request_id: requestId,
          };
        } catch {
          return {
            success: false,
            error: "Failed to parse JSON attributes from AI response.",
            code: "AI_INVALID_JSON",
            status: 422,
            request_id: requestId,
          };
        }
      }
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        if (!OPENROUTER_API_KEY) {
          return {
            success: false,
            error: "AI response timed out. Please try again.",
            code: "AI_PROVIDER_TIMEOUT",
            status: 504,
            request_id: requestId,
          };
        }
        console.warn("Sarvam 105B extraction timed out, attempting OpenRouter fallback");
      }
    }
  }

  // 2. Try OpenRouter Fallback
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
        signal: AbortSignal.timeout(12000), // 12s bounded timeout
      });

      if (res.ok) {
        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content || "").trim();
        if (raw) {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            normalizeCraft(parsed, clean);
            return {
              success: true,
              requires_clarification: false,
              attributes: parsed,
              confidence_score: 0.9,
              source: "openrouter_gemma",
              request_id: requestId,
            };
          }
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
      console.warn("OpenRouter fallback extraction failed:", e);
    }
  }

  // Truthfulness Guarantee: NO fake successful AI output or fabricated attributes
  return {
    success: false,
    error: "AI craft extraction failed. Please try again.",
    code: "AI_PROVIDER_ERROR",
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
