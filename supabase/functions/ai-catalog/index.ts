// Supabase Edge Function: ai-catalog
// Intelligent Indic Craft Extraction & Conversational Assistant (Sarvam 105B LLM + OpenRouter Failover)

const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "extract-craft";

    if (action === "chat") {
      const message = body.message || "";
      const context = body.context || "";
      const systemPrompt = body.system_prompt || "You are Hunar Saathi, a warm, culturally respectful AI companion helping rural Indian artisans. Reply primarily in clear, simple Hindi.";

      const res = await runChat(message, systemPrompt, context);
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: extract-craft
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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extraction = await extractCraft(transcript, languageCode);
    return new Response(JSON.stringify(extraction), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-catalog edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal AI extraction error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractCraft(transcript: string, languageCode: string): Promise<any> {
  const prompt = `You are a handicraft cataloging AI for Indian artisans.
Extract structured craft attributes from this artisan description:
"${transcript}"

Respond with ONLY valid JSON without markdown formatting:
{
  "product_name_hi": "उत्पाद का नाम हिंदी में",
  "product_name_en": "Product Name in English",
  "craft_type": "Specific Craft Name (e.g. Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Painting, Channapatna Toys)",
  "materials": ["material 1", "material 2"],
  "dimensions": null or "string dimensions",
  "color": null or "color name",
  "production_days": null or integer number of days,
  "material_cost": null or integer cost in INR,
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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          normalizeCraft(parsed, transcript);
          return {
            success: true,
            requires_clarification: false,
            attributes: parsed,
            confidence_score: 0.95,
            source: "sarvam_105b",
          };
        }
      }
    } catch (e) {
      console.warn("Sarvam 105B extraction failed, trying OpenRouter fallback:", e);
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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          normalizeCraft(parsed, transcript);
          return {
            success: true,
            requires_clarification: false,
            attributes: parsed,
            confidence_score: 0.9,
            source: "openrouter_gemma",
          };
        }
      }
    } catch (e) {
      console.warn("OpenRouter fallback failed:", e);
    }
  }

  // 3. Fallback Heuristic
  const fallbackAttrs: any = {
    product_name_hi: "पारंपरिक हस्तशिल्प",
    product_name_en: "Traditional Handcrafted Art",
    craft_type: "Indian Handicraft",
    materials: ["प्राकृतिक सामग्री"],
    dimensions: null,
    color: null,
    production_days: 3,
    material_cost: 500,
    description_hi: transcript,
    description_en: "Authentic handmade Indian craft directly from master artisans.",
    voice_script_hi: "बधाई हो! आपका उत्पाद विवरण तैयार है।",
  };
  normalizeCraft(fallbackAttrs, transcript);

  return {
    success: true,
    requires_clarification: false,
    attributes: fallbackAttrs,
    confidence_score: 0.8,
    source: "heuristic_engine",
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
  if (days != null && cost != null && !isNaN(days) && !isNaN(cost)) {
    const floor = Math.round((cost + days * 650) / 10) * 10;
    parsed.wage_floor = floor;
    parsed.recommended_price = Math.round((floor * 1.25) / 10) * 10;
  }
}

async function runChat(message: string, systemPrompt: string, context?: string) {
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
    console.warn("Chat failed:", e);
  }

  return {
    success: true,
    reply: "नमस्ते! मैं हुनर साथी हूँ। मैं आपके शिल्प को डिजिटल दुनिया तक पहुँचाने में आपकी सहायता करूँगा।",
    model: "fallback",
  };
}
