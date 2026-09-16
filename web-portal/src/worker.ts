interface Env {
  AI: {
    run: (model: string, input: any) => Promise<any>;
  };
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  SARVAM_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_JWT_ISSUER?: string;
  SUPABASE_JWT_AUDIENCE?: string;
  ADMIN_USER_IDS?: string;
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Worker secrets are injected through Cloudflare's secret configuration.
function getSarvamApiKey(env: any): string {
  return typeof env?.SARVAM_API_KEY === 'string' ? env.SARVAM_API_KEY.trim() : '';
}

// OpenRouter AI Config (High-Performance Indic & Reasoning Fallback)
const OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
function getOpenRouterKey(env: any): string {
  return typeof env?.OPENROUTER_API_KEY === 'string' ? env.OPENROUTER_API_KEY.trim() : '';
}

// Defensive Security Headers (OWASP A05:2021 & Clickjacking Protection)
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
};

function withSecurityHeaders(res: Response): Response {
  const newHeaders = new Headers(res.headers);
  for (const [key, val] of Object.entries(SECURITY_HEADERS)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, val);
    }
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

// In-memory sliding window rate limiter for edge AI endpoints (OWASP A04:2021 DoS mitigation)
const ipRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientIp: string, maxRequests = 45, windowMs = 60000): boolean {
  const now = Date.now();
  const record = ipRateLimits.get(clientIp);
  if (!record || now > record.resetTime) {
    ipRateLimits.set(clientIp, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) {
    return false;
  }
  record.count += 1;
  return true;
}

type VerifiedIdentity = { subject: string; role: 'customer' | 'artisan' | 'admin' };

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function jsonFromBase64Url(value: string): Record<string, any> | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    return null;
  }
}

function authFailure(status: number, error: string): Response {
  return withSecurityHeaders(new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }));
}

async function verifySupabaseRequest(
  request: Request,
  env: Env,
  requireAdmin = false,
): Promise<{ identity?: VerifiedIdentity; response?: Response }> {
  if (!env.SUPABASE_JWT_SECRET || !env.SUPABASE_JWT_ISSUER || !env.SUPABASE_JWT_AUDIENCE) {
    return { response: authFailure(503, 'AUTH_CONFIGURATION_ERROR') };
  }

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return { response: authFailure(401, 'AUTHENTICATION_REQUIRED') };
  }

  const token = authorization.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return { response: authFailure(401, 'INVALID_TOKEN') };

  const header = jsonFromBase64Url(parts[0]);
  const claims = jsonFromBase64Url(parts[1]);
  if (!header || !claims || header.alg !== 'HS256') return { response: authFailure(401, 'INVALID_TOKEN') };

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const validSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!validSignature) return { response: authFailure(401, 'INVALID_TOKEN') };
  } catch {
    return { response: authFailure(401, 'INVALID_TOKEN') };
  }

  const now = Math.floor(Date.now() / 1000);
  const audienceValid = Array.isArray(claims.aud)
    ? claims.aud.includes(env.SUPABASE_JWT_AUDIENCE)
    : claims.aud === env.SUPABASE_JWT_AUDIENCE;
  if (
    typeof claims.sub !== 'string' || !claims.sub ||
    claims.iss !== env.SUPABASE_JWT_ISSUER || !audienceValid ||
    typeof claims.exp !== 'number' || claims.exp <= now ||
    (typeof claims.nbf === 'number' && claims.nbf > now)
  ) {
    return { response: authFailure(401, 'INVALID_TOKEN') };
  }

  const appRole = claims.app_metadata?.role;
  let role: VerifiedIdentity['role'] = ['customer', 'artisan', 'admin'].includes(appRole)
    ? appRole
    : 'customer';
  const adminIds = (env.ADMIN_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (role === 'admin' && !adminIds.includes(claims.sub)) {
    role = 'customer';
  }
  if (requireAdmin && role !== 'admin') {
    return { response: authFailure(403, 'FORBIDDEN') };
  }
  return { identity: { subject: claims.sub, role } };
}

const ARTISAN_SYSTEM_PROMPT = `आप 'हुनर साथी' (Hunar Saathi) हैं - हुनरधारा (Hunardhara) मंच के समर्पित AI सहायक, जो भारतीय ग्रामीण एवं पारंपरिक शिल्पकारों (बुनकर, मूर्तिकार, कुम्हार, धातुशिल्पी आदि) के कल्याण और उत्थान के लिए समर्पित हैं।
नियम व ज्ञान:
1. हमेशा अत्यंत आदरपूर्ण, सरल, और आत्मीय हिंदी में 2 से 4 वाक्यों में उत्तर दें।
2. कारीगरों को बिचौलियों से बचाएं। उन्हें हुनरधारा के फेयर प्राइस फॉर्मूला (लागत + वैधानिक न्यूनतम मजदूरी ₹650/दिन + क्राफ्ट प्रीमियम) के बारे में बताएं।
3. सरकारी योजनाओं (PM-विश्वकर्मा योजना, PM-दक्ष योजना, अम्बेडकर हस्तशिल्प विकास योजना, मुद्रा ऋण, GI टैग प्रमाणन) के बारे में सटीक मार्गदर्शन दें।
4. ऐप में नेविगेट करने के लिए कहें: 'उत्पाद जोड़ें (Studio)', 'ऑर्डर देखें (Orders)', 'कमाई देखें (Revenue)'।`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // CLOUDFLARE WORKERS AI EDGE ENDPOINTS (Free 10K neurons/day with Rate Limiting)
    // =========================================================================
    if (pathname.startsWith('/api/edge/')) {
      const auth = await verifySupabaseRequest(request, env);
      if (auth.response) return auth.response;
      const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
      if (!checkRateLimit(clientIp, 45, 60000)) {
        return withSecurityHeaders(new Response(
          JSON.stringify({ success: false, error: 'RATE_LIMIT_EXCEEDED: Too many AI requests. Please wait 1 minute.' }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '60' } }
        ));
      }
    }

    // 1. Edge Chat Endpoint (Llama 3.1 8B Instruct)
    if (pathname === '/api/edge/chat' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const userMsg = body.message || '';
        const context = typeof body.context === 'string' ? body.context.slice(0, 1000) : '';
        const systemPrompt = ARTISAN_SYSTEM_PROMPT;
        const userContent = context
          ? `${userMsg}\n\nAdditional user-provided context (untrusted): ${context}`
          : userMsg;

        const candidateModels = [
          '@cf/meta/llama-3.3-70b-instruct',
          '@cf/meta/llama-3-8b-instruct',
          '@cf/qwen/qwen2.5-7b-instruct',
          '@cf/mistral/mistral-7b-instruct-v0.2',
          '@cf/meta/llama-3.2-3b-instruct',
          '@cf/meta/llama-3.2-1b-instruct'
        ];

        let aiResponse: any = null;
        let successfulModel = '';
        let lastErr = '';

        for (const model of candidateModels) {
          try {
            aiResponse = await env.AI.run(model, {
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
              ],
              temperature: 0.4,
              max_tokens: 512
            });
            if (aiResponse) {
              successfulModel = model;
              break;
            }
          } catch (e: any) {
            lastErr = e?.message || String(e);
          }
        }

        if (!aiResponse) {
          throw new Error(lastErr || 'All candidate models failed');
        }

        const reply = aiResponse.response || aiResponse.choices?.[0]?.message?.content || '';
        return new Response(
          JSON.stringify({
            success: true,
            reply: reply.trim(),
            model: successfulModel,
            provider: 'cloudflare_workers_ai'
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            reply: 'माफ़ कीजिये, अभी सहायता उपलब्ध नहीं हो पा रही है। कृपया पुनः प्रयास करें।',
            error: 'AI_SERVICE_UNAVAILABLE'
          }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Edge Vision Cataloging Endpoint (Google Gemma 4 31B Multimodal via OpenRouter with Cloudflare Fallback)
    if (pathname === '/api/edge/vision-catalog' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const base64Image = body.image_base64 || '';
        const hint = body.hint || '';

        const systemPrompt = `You are a certified Indian Handicraft expert for the Ministry of Social Justice and Empowerment (MoSJE).
Inspect this craft photo and return a strict JSON object with these exact keys:
{
  "title": "Clean craft title",
  "product_name_hi": "सटीक हिंदी नाम",
  "craft_type": "Specific Indian craft name (e.g. Bastar Dhokra, Khurja Pottery, Varanasi Silk, Channapatna Toys, Madhubani)",
  "materials": ["detected materials"],
  "dimensions": "estimated dimensions in cm",
  "technique": "traditional craft technique",
  "dominant_colors": ["colors"],
  "estimated_labor_hours": 16,
  "description_hindi": "2-line attractive description in Hindi",
  "description_english": "2-line attractive description in English",
  "suggested_retail_price": 2500
}`;

        let parsedJson = null;
        let usedModel = OPENROUTER_MODEL;
        let provider = 'openrouter';

        // 1. Primary: Try OpenRouter Google Gemma 4 31B Multimodal Vision
        const openrouterKey = getOpenRouterKey(env);
        if (openrouterKey && base64Image) {
          try {
            const formattedImage = base64Image.startsWith('data:')
              ? base64Image
              : `data:image/jpeg;base64,${base64Image}`;

            const orReq = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openrouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://hunardhara.workers.dev',
                'X-Title': 'HunarDhara Artisan Platform'
              },
              body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                  { role: 'system', content: systemPrompt },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: `Please inspect this handicraft photo. ${hint ? `Artisan hint: ${hint}` : ''}` },
                      { type: 'image_url', image_url: { url: formattedImage } }
                    ]
                  }
                ],
                max_tokens: 1024,
                temperature: 0.1
              })
            });

            if (orReq.ok) {
              const orData: any = await orReq.json();
              const rawText = orData.choices?.[0]?.message?.content || '';
              const match = rawText.match(/\{[\s\S]*\}/);
              if (match) {
                parsedJson = JSON.parse(match[0]);
              }
            }
          } catch {
            console.warn('OpenRouter vision attempt failed');
          }
        }

        // 2. Secondary Fallback: Cloudflare Workers AI Llama 3.2 Vision
        if (!parsedJson && env.AI && base64Image) {
          try {
            const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const aiResponse = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
              prompt: systemPrompt,
              image: [...bytes],
              max_tokens: 512
            });

            const rawText = aiResponse.response || '';
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) parsedJson = JSON.parse(match[0]);
            usedModel = '@cf/meta/llama-3.2-11b-vision-instruct';
            provider = 'cloudflare_workers_ai';
          } catch {
            console.warn('Cloudflare Workers AI vision fallback failed');
          }
        }

        if (!parsedJson) {
          return new Response(
            JSON.stringify({ success: false, error: 'VISION_ANALYSIS_UNAVAILABLE' }),
            { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            catalog: parsedJson,
            model: usedModel,
            provider
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'VISION_ANALYSIS_UNAVAILABLE'
          }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Edge Speech-to-Text Whisper Endpoint
    if (pathname === '/api/edge/transcribe' && request.method === 'POST') {
      try {
        const audioBytes = await request.arrayBuffer();
        const aiResponse = await env.AI.run('@cf/openai/whisper', {
          audio: [...new Uint8Array(audioBytes)]
        });

        return new Response(
          JSON.stringify({
            success: true,
            transcript: aiResponse.text || '',
            vtt: aiResponse.vtt || null,
            model: '@cf/openai/whisper',
            provider: 'cloudflare_workers_ai'
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'TRANSCRIPTION_UNAVAILABLE'
          }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Edge Sarvam Bulbul TTS Endpoint (Key Rotation & No-Cache)
    if (pathname === '/api/edge/sarvam-tts' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const text = (body.text || '').trim();
        const lang = body.language_code || 'hi-IN';
        const speaker = body.speaker || 'shubh';
        const model = body.model || 'bulbul:v3';
        const sarvamKey = getSarvamApiKey(env);

        if (!sarvamKey) {
          return new Response(JSON.stringify({ success: false, error: 'SARVAM_API_KEY not configured' }), {
            status: 503,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': sarvamKey,
          },
          body: JSON.stringify({
            inputs: [text.slice(0, 500)],
            target_language_code: lang,
            speaker: speaker,
            pitch: 0,
            pace: 1.0,
            loudness: 1.0,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: model,
          }),
        });

        if (sarvamRes.ok) {
          const sData: any = await sarvamRes.json();
          const audios = sData.audios || [];
          return new Response(
            JSON.stringify({
              success: true,
              audio_base64: audios[0] || '',
              format: 'wav',
              source: 'sarvam_ai_edge',
            }),
            {
              headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              },
            }
          );
        }
        throw new Error(`Sarvam TTS status ${sarvamRes.status}`);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'SPEECH_SYNTHESIS_UNAVAILABLE' }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Dual-Engine Edge ASR Endpoint (Sarvam Saarika v2.5 + Cloudflare Whisper Fallback)
    if (pathname === '/api/edge/sarvam-asr' && request.method === 'POST') {
      try {
        const isDev = env?.ENVIRONMENT === 'development';
        const formData = await request.formData();
        const file = formData.get('audio') as File;
        const lang = (formData.get('language_code') as string) || 'hi-IN';

        if (!file) {
          return new Response(JSON.stringify({ success: false, error: 'No audio file provided' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const arrayBuf = await file.arrayBuffer();
        const fileSize = arrayBuf.byteLength;

        // Quality Gate: Reject empty audio (< 800 bytes)
        if (fileSize < 800) {
          return new Response(
            JSON.stringify({
              success: false,
              transcript: '',
              error: 'AUDIO_TOO_SHORT_OR_SILENT',
              message: 'आवाज़ बहुत छोटी या शांत है। कृपया माइक के पास बोलें।',
            }),
            {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
              },
            }
          );
        }

        let transcript = '';
        let sourceEngine = '';
        const sarvamKey = getSarvamApiKey(env);

        // Map regional Indic dialect codes for Sarvam ASR compatibility
        const asrLang = (lang === 'bho-IN' || lang === 'mai-IN') ? 'hi-IN' : lang;

        // 1. Primary: Sarvam Saarika v2.5
        if (sarvamKey) {
          try {
            const sarvamForm = new FormData();
            const u8 = new Uint8Array(arrayBuf.slice(0, 12));
            let audioFileName = 'recording.webm';
            let audioMime = 'audio/webm';
            if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) {
              audioMime = 'audio/wav';
              audioFileName = 'recording.wav';
            } else if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) {
              audioMime = 'audio/ogg';
              audioFileName = 'recording.ogg';
            } else if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) {
              audioMime = 'audio/webm';
              audioFileName = 'recording.webm';
            } else if (file.type?.includes('wav') || file.name?.endsWith('.wav')) {
              audioMime = 'audio/wav';
              audioFileName = 'recording.wav';
            }
            const audioBlob = new Blob([arrayBuf], { type: audioMime });

            sarvamForm.append('file', audioBlob, audioFileName);
            sarvamForm.append('model', 'saarika:v2.5');
            sarvamForm.append('language_code', asrLang);

            const sRes = await fetch('https://api.sarvam.ai/speech-to-text', {
              method: 'POST',
              headers: {
                'api-subscription-key': sarvamKey,
              },
              body: sarvamForm,
            });

            if (sRes.ok) {
              const sData: any = await sRes.json();
              if (sData.transcript && sData.transcript.trim()) {
                transcript = sData.transcript.trim();
                sourceEngine = 'sarvam_saarika_edge';
              }
            }
          } catch {
            console.warn('Sarvam ASR attempt failed');
          }
        }

        // 2. Secondary: Cloudflare Workers AI Whisper Fallback
        if (!transcript && env.AI) {
          try {
            const whisperRes = await env.AI.run('@cf/openai/whisper', {
              audio: [...new Uint8Array(arrayBuf)],
            });
            if (whisperRes && whisperRes.text && whisperRes.text.trim()) {
              transcript = whisperRes.text.trim();
              sourceEngine = 'cloudflare_whisper_edge';
            }
          } catch {
            console.warn('Cloudflare Whisper fallback failed');
          }
        }

        const debugData = isDev ? {
          audio_received: { size_bytes: fileSize, mime: file.type, name: file.name },
          transcript_received: { text: transcript, source: sourceEngine },
          language_detected: lang,
        } : undefined;

        if (transcript) {
          return new Response(
            JSON.stringify({
              success: true,
              transcript,
              language_code: lang,
              source: sourceEngine,
              ...(debugData ? { _debug_telemetry: debugData } : {}),
            }),
            {
              headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            transcript: '',
            error: 'NO_SPEECH_DETECTED',
            message: 'आवाज़ स्पष्ट रूप से सुनाई नहीं दी। कृपया माइक के पास बोलें।',
            ...(debugData ? { _debug_telemetry: debugData } : {}),
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'SPEECH_RECOGNITION_UNAVAILABLE' }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Edge Craft Attribute Extractor (Sarvam 105B Indic LLM + Strict Explicit Fallback + Telemetry)
    if (pathname === '/api/edge/extract-craft' && request.method === 'POST') {
      try {
        const isDev = env?.ENVIRONMENT === 'development';
        const body: any = await request.json();
        const transcript = (body.transcript || '').trim();
        const lang = body.language_code || 'hi-IN';

        if (!transcript) {
          return new Response(JSON.stringify({ success: false, error: 'Empty transcript provided' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Semantic & Quality Gating: Detect pure greetings or missing craft content
        const words = transcript.split(/\s+/).filter(Boolean);
        const lowerT = transcript.toLowerCase();
        const isJustGreeting = /^(नमस्ते|प्रणाम|हेलो|हाय|hello|hi|good\s*morning|haan|ha|theek\s*hai)[\s.!,]*$/i.test(transcript);
        const hasCraftTerm = /(घंटी|साड़ी|खिलौना|पॉट|बर्तन|पेंटिंग|चित्र|मूर्ति|दीपक|कालीन|दरी|मोजरी|जूती|दुपट्टा|शॉल|चाक|लकड़ी|पीतल|मिट्टी|सिल्क|चमड़ा|ऊन|बांस|bell|saree|toy|pot|pottery|painting|statue|carpet|rug|leather|wood|brass|silk|clay)/i.test(transcript);

        if (isJustGreeting || (words.length < 3 && !hasCraftTerm)) {
          return new Response(
            JSON.stringify({
              success: true,
              requires_clarification: true,
              message_hi: 'आवाज़ में उत्पाद का विवरण नहीं मिला। कृपया अपने शिल्प का नाम (जैसे घंटी, साड़ी, खिलौना, पॉट), सामग्री, और बनाने के दिन बताएं।',
              message_en: 'No product craft details detected. Please describe your item name (e.g. bell, saree, toy, pottery), material used, and days to make.',
              transcript,
            }),
            {
              headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
              },
            }
          );
        }

        const systemPrompt = `You are Hunardhara AI Artisan Commerce Assistant for the Ministry of Social Justice and Empowerment (MoSJE).
Analyze the artisan's exact spoken words and extract structured craft catalog attributes.
Return ONLY a valid JSON object without markdown formatting or backticks:
{
  "product_name_hi": "सटीक हिंदी नाम (based strictly on what they described)",
  "product_name_en": "Accurate English Title",
  "craft_type": "Specific Craft Name or null",
  "materials": ["only explicitly mentioned materials"],
  "color": "only explicitly mentioned colors or null",
  "dimensions": "dimensions if explicitly mentioned or null",
  "production_days": 4,
  "material_cost": 500,
  "description_hi": "कारीगर के विवरण पर आधारित सुंदर और सत्यनिष्ठ विवरण",
  "description_en": "Attractive, truthful product description anchored in artisan words",
  "voice_script_hi": "बधाई हो! आपका उत्पाद तैयार है।"
}

CRITICAL TRUTHFULNESS RULES:
1. NEVER default to saree, silk, or Varanasi unless the artisan explicitly mentioned saree, silk, or katan!
2. Extract the actual craft described (e.g. brass bell, wooden toy, clay pot, Madhubani art, leather mojari, bamboo basket, handloom cotton).
3. If days or costs are mentioned in speech, extract them as numbers (e.g. 2, 300). If days or costs are NOT explicitly stated, set them to null. NEVER guess days or cost!
4. If materials, color, or dimensions were NOT mentioned, do NOT hallucinate them; leave color or dimensions as null and materials as empty array.`;

        let parsedJson: any = null;
        let usedModel = '';
        let rawAiResponse = '';
        const sarvamKey = getSarvamApiKey(env);

        // 1. Primary: Sovereign Sarvam 105B Indic LLM (Native Indic & Dialect Reasoning)
        if (sarvamKey) {
          try {
            const sarvamRes = await fetch('https://api.sarvam.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'api-subscription-key': sarvamKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sarvam-105b-conversations',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Artisan Spoken Description:\n"${transcript}"` },
                ],
                temperature: 0.1,
              }),
            });

            if (sarvamRes.ok) {
              const sData: any = await sarvamRes.json();
              rawAiResponse = sData.choices?.[0]?.message?.content || '';
              const match = rawAiResponse.match(/\{[\s\S]*\}/);
              if (match) {
                parsedJson = JSON.parse(match[0]);
                usedModel = 'sarvam-105b-conversations';
              }
            }
          } catch {
            console.warn('Sarvam extraction attempt failed');
          }
        }

        // 2. Secondary: OpenRouter Indic/Reasoning Fallback
        if (!parsedJson) {
          const openrouterKey = getOpenRouterKey(env);
          if (openrouterKey) {
            try {
              const orReq = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openrouterKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://hunardhara.workers.dev',
                  'X-Title': 'HunarDhara Artisan Platform',
                },
                body: JSON.stringify({
                  model: OPENROUTER_MODEL,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Artisan Spoken Description:\n"${transcript}"` },
                  ],
                  max_tokens: 800,
                  temperature: 0.1,
                }),
              });

              if (orReq.ok) {
                const orData: any = await orReq.json();
                rawAiResponse = orData.choices?.[0]?.message?.content || '';
                const match = rawAiResponse.match(/\{[\s\S]*\}/);
                if (match) {
                  parsedJson = JSON.parse(match[0]);
                  usedModel = OPENROUTER_MODEL;
                }
              }
            } catch {
              console.warn('OpenRouter extraction attempt failed');
            }
          }
        }

        // 3. Tertiary: Cloudflare Workers AI LLMs
        if (!parsedJson && env.AI) {
          const candidateModels = [
            '@cf/meta/llama-3.3-70b-instruct',
            '@cf/qwen/qwen2.5-7b-instruct',
            '@cf/meta/llama-3-8b-instruct',
          ];

          for (const model of candidateModels) {
            try {
              const aiRes = await env.AI.run(model, {
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Artisan Spoken Description: "${transcript}"` },
                ],
                temperature: 0.1,
                max_tokens: 800,
              });
              const text = aiRes.response || aiRes.choices?.[0]?.message?.content || '';
              rawAiResponse = text;
              const match = text.match(/\{[\s\S]*\}/);
              if (match) {
                parsedJson = JSON.parse(match[0]);
                usedModel = model;
                break;
              }
            } catch {
              console.warn(`Model ${model} extraction failed`);
            }
          }
        }

        // Failed real providers must fail closed. Do not turn unavailable AI
        // analysis into fabricated attributes or a successful response.
        if (!parsedJson) {
          return new Response(
            JSON.stringify({ success: false, error: 'ATTRIBUTE_EXTRACTION_UNAVAILABLE' }),
            { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
          );
        }

        // This legacy explicit-facts parser is retained below only for source
        // history compatibility; the fail-closed response above makes it
        // unreachable in production.
        // 4. Strict Explicit-Facts-Only Fallback (Zero Hallucination, Zero Canned Templates)
        if (!parsedJson) {
          const t = transcript.toLowerCase();

          // Extract production days explicitly stated
          let days: number | null = null;
          let daysDetected = false;
          const daysMatch = t.match(/(\d+)\s*(din|दिन|day|days|hafte|हफ्ते|हफ्ता|week|weeks)/);
          if (daysMatch) {
            const num = parseInt(daysMatch[1], 10);
            if (num > 0 && num <= 90) {
              days = daysMatch[2].includes('haft') || daysMatch[2].includes('हफ्') || daysMatch[2].includes('week') ? num * 7 : num;
              daysDetected = true;
            }
          } else if (t.includes('हफ्ता') || t.includes('one week')) {
            days = 7;
            daysDetected = true;
          } else if (t.includes('दो दिन') || t.includes('2 days')) {
            days = 2;
            daysDetected = true;
          } else if (t.includes('तीन दिन') || t.includes('3 days')) {
            days = 3;
            daysDetected = true;
          }

          // Extract material cost explicitly stated
          let matCost: number | null = null;
          let costDetected = false;
          const costMatch = t.match(/(?:₹|rs\.?|रुपये?|रू\.|cost|price|लागत)\s*(\d+)/) || t.match(/(\d+)\s*(?:रुपये?|रू\.|rs\.?|लागत)/);
          if (costMatch) {
            const cost = parseInt(costMatch[1], 10);
            if (cost >= 50 && cost <= 500000) {
              matCost = cost;
              costDetected = true;
            }
          } else if (t.includes('दो सौ') || t.includes('200')) {
            matCost = 200;
            costDetected = true;
          } else if (t.includes('तीन सौ') || t.includes('300')) {
            matCost = 300;
            costDetected = true;
          } else if (t.includes('पांच सौ') || t.includes('500')) {
            matCost = 500;
            costDetected = true;
          }

          // Explicit materials detection
          const materials: string[] = [];
          if (t.includes('पीतल') || t.includes('brass')) materials.push('पीतल (Brass)');
          if (t.includes('बेल मेटल') || t.includes('bell metal')) materials.push('बेल मेटल (Bell Metal)');
          if (t.includes('मिट्टी') || t.includes('clay') || t.includes('terracotta')) materials.push('प्राकृतिक मिट्टी (Clay)');
          if (t.includes('शीशम') || t.includes('सागवान') || t.includes('लकड़ी') || t.includes('wood')) materials.push('काष्ठ (Natural Wood)');
          if (t.includes('चमड़ा') || t.includes('leather')) materials.push('चर्म (Leather)');
          if (t.includes('बांस') || t.includes('bamboo')) materials.push('बांस (Bamboo)');
          if (t.includes('सिल्क') || t.includes('silk') || t.includes('रेशम')) materials.push('शुद्ध सिल्क (Pure Silk)');
          if (t.includes('कॉटन') || t.includes('सूती') || t.includes('cotton')) materials.push('सूती धागा (Cotton)');
          if (t.includes('प्राकृतिक रंग') || t.includes('natural color')) materials.push('प्राकृतिक वनस्पति रंग');

          // Explicit color detection
          let color: string | null = null;
          if (t.includes('लाल') || t.includes('red')) color = 'लाल (Red)';
          else if (t.includes('नीला') || t.includes('blue')) color = 'नीला (Blue)';
          else if (t.includes('हरा') || t.includes('green')) color = 'हरा (Green)';
          else if (t.includes('पीला') || t.includes('yellow')) color = 'पीला (Yellow)';
          else if (t.includes('काला') || t.includes('black')) color = 'काला (Black)';
          else if (t.includes('सफेद') || t.includes('white')) color = 'सफेद (White)';
          else if (t.includes('सुनहरा') || t.includes('golden') || t.includes('gold')) color = 'सुनहरा (Golden)';

          // Explicit craft detection
          let craft = 'पारंपरिक हस्तशिल्प (Handicraft)';
          let nameHi = 'हस्तनिर्मित शिल्प';
          let nameEn = 'Handcrafted Item';

          if (t.includes('घंटी') || t.includes('bell')) {
            craft = 'धातु शिल्प (Metal Craft)';
            nameHi = 'हाथ से बनी पीतल की घंटी';
            nameEn = 'Handcrafted Brass Bell';
          } else if (t.includes('घड़ा') || t.includes('घइला') || t.includes('घैला') || t.includes('पॉट') || t.includes('pottery') || t.includes('कुल्हड़')) {
            craft = 'मृत्तिका शिल्प (Pottery)';
            nameHi = 'चाक पर बना हस्तनिर्मित घड़ा / पॉट';
            nameEn = 'Handcrafted Clay Pot';
          } else if (t.includes('खिलौना') || t.includes('toy')) {
            craft = 'काष्ठ खिलौना शिल्प (Wooden Toy Craft)';
            nameHi = 'हस्तनिर्मित लकड़ी का खिलौना';
            nameEn = 'Handcrafted Wooden Toy';
          } else if (t.includes('पेंटिंग') || t.includes('चित्र') || t.includes('मधुबनी') || t.includes('painting')) {
            craft = t.includes('मधुबनी') ? 'मधुबनी लोक चित्रकला' : 'पारंपरिक हस्तचित्रकला';
            nameHi = t.includes('मधुबनी') ? 'हस्तचित्रित मधुबनी पेंटिंग' : 'हस्तचित्रित पारंपरिक पेंटिंग';
            nameEn = t.includes('मधुबनी') ? 'Handpainted Madhubani Folk Art' : 'Handpainted Traditional Painting';
          } else if (t.includes('मोजरी') || t.includes('जूती') || t.includes('चप्पल') || t.includes('leather')) {
            craft = 'चर्म शिल्प (Leather Craft)';
            nameHi = 'हस्तनिर्मित लेदर मोजरी';
            nameEn = 'Handcrafted Leather Mojari';
          } else if (t.includes('साड़ी') || t.includes('saree')) {
            craft = t.includes('सिल्क') || t.includes('बनारस') ? 'बनारसी सिल्क हथकरघा' : 'हथकरघा साड़ी';
            nameHi = t.includes('सिल्क') ? 'पारंपरिक शुद्ध सिल्क साड़ी' : 'हस्तनिर्मित हथकरघा साड़ी';
            nameEn = t.includes('सिल्क') ? 'Traditional Pure Silk Saree' : 'Handloom Woven Saree';
          }

          parsedJson = {
            product_name_hi: nameHi,
            product_name_en: nameEn,
            craft_type: craft,
            materials,
            color,
            dimensions: null, // Never invent dimensions in fallback!
            production_days: days,
            material_cost: matCost,
            description_hi: `कारीगर द्वारा स्वयं वर्णित विवरण: "${transcript}"`,
            description_en: `Authentic artisan product described as: "${transcript}"`,
            voice_script_hi: `बधाई हो! आपका उत्पाद '${nameHi}' तैयार है।`,
            facts_detected: {
              days: daysDetected,
              cost: costDetected,
              materials: materials.length > 0,
              color: Boolean(color),
            },
          };
          usedModel = 'edge_factual_extractor';
        }

        // Decoupled Statutory Wage Floor & Fair Pricing Calculation
        const hasValidDays = parsedJson.production_days !== null && parsedJson.production_days !== undefined && Number(parsedJson.production_days) > 0;
        const hasValidCost = parsedJson.material_cost !== null && parsedJson.material_cost !== undefined && Number(parsedJson.material_cost) >= 0;

        const verificationRequired: string[] = [];

        if (hasValidDays && hasValidCost) {
          const daysNum = Number(parsedJson.production_days);
          const costNum = Number(parsedJson.material_cost);
          const wageFloor = costNum + (daysNum * 650);
          const recPrice = Math.round((wageFloor * 1.25) / 50) * 50;
          parsedJson.production_days = daysNum;
          parsedJson.material_cost = costNum;
          parsedJson.wage_floor = wageFloor;
          parsedJson.recommended_price = recPrice;
        } else {
          parsedJson.production_days = hasValidDays ? Number(parsedJson.production_days) : null;
          parsedJson.material_cost = hasValidCost ? Number(parsedJson.material_cost) : null;
          parsedJson.wage_floor = null;
          parsedJson.recommended_price = null;
          if (!hasValidDays) verificationRequired.push('production_days');
          if (!hasValidCost) verificationRequired.push('material_cost');
        }

        if (!parsedJson.materials || parsedJson.materials.length === 0) {
          verificationRequired.push('materials');
        }
        parsedJson.verification_required = verificationRequired;
        parsedJson.source = 'edge_ai_extractor';
        parsedJson.model = usedModel;

        // Confidence calculation
        let confidenceScore = 0.5;
        if (usedModel.includes('sarvam')) confidenceScore = 0.95;
        else if (usedModel.includes('nemotron') || usedModel.includes('llama')) confidenceScore = 0.88;
        else if (parsedJson.facts_detected?.days && parsedJson.facts_detected?.materials) confidenceScore = 0.80;
        parsedJson.confidence_score = confidenceScore;

        const debugData = isDev ? {
          transcript_received: transcript,
          language_detected: lang,
          model_used: usedModel,
          prompt_sent_preview: systemPrompt.slice(0, 180) + '...',
          raw_ai_response: rawAiResponse.slice(0, 300),
          final_catalog_output: {
            title_hi: parsedJson.product_name_hi,
            title_en: parsedJson.product_name_en,
            craft: parsedJson.craft_type,
            days: parsedJson.production_days,
            cost: parsedJson.material_cost,
            price: parsedJson.recommended_price,
            confidence: parsedJson.confidence_score,
          },
        } : undefined;

        return new Response(
          JSON.stringify({
            success: true,
            attributes: parsedJson,
            ...(debugData ? { _debug_telemetry: debugData } : {}),
          }),
          {
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            },
          }
        );
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'ATTRIBUTE_EXTRACTION_UNAVAILABLE' }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Dynamic craft detail routes (e.g. newly published products like /craft/prod-live-* or UUIDs)
    if (pathname.startsWith('/craft/')) {
      const isTxt = pathname.endsWith('.txt') || url.searchParams.has('_rsc');
      const isHtml = pathname.endsWith('.html') || !pathname.includes('.');

      if (isTxt) {
        let res = await env.ASSETS.fetch(request);
        const cleanPath = pathname.endsWith('.txt') ? pathname.slice(0, -4) : pathname;
        const targetId = cleanPath.replace('/craft/', '').split('/')[0].split('?')[0];

        const isStaticSeed = [
          'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
          'prod-varanasi-001', 'prod-bastar-001', 'prod-bastar-002',
          'prod-khurja-001', 'prod-madhubani-001', 'prod-channapatna-001'
        ].includes(targetId);

        if (!isStaticSeed) {
          const fallbackReq = new Request(new URL('/craft/prod-001.txt', url.origin));
          const fallbackRes = await env.ASSETS.fetch(fallbackReq);
          const txt = await fallbackRes.text();
          const rewrittenTxt = txt.replaceAll('prod-001', targetId);
          return new Response(rewrittenTxt, {
            status: 200,
            headers: {
              'Content-Type': 'text/x-component; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
        return res;
      }

      if (isHtml) {
        let res = await env.ASSETS.fetch(request);
        const cleanPath = pathname.endsWith('.html') ? pathname.slice(0, -5) : pathname;
        const targetId = cleanPath.replace('/craft/', '').split('/')[0].split('?')[0];

        // If not a static seed asset, dynamically load the craft shell
        const isStaticSeed = [
          'prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005',
          'prod-varanasi-001', 'prod-bastar-001', 'prod-bastar-002',
          'prod-khurja-001', 'prod-madhubani-001', 'prod-channapatna-001'
        ].includes(targetId);

        if (!isStaticSeed) {
          const fallbackReq = new Request(new URL('/craft/prod-001.html', url.origin));
          const fallbackRes = await env.ASSETS.fetch(fallbackReq);
          const htmlText = await fallbackRes.text();
          const rewrittenHtml = htmlText.replaceAll('prod-001', targetId);
          return new Response(rewrittenHtml, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Dynamic-Craft': targetId,
            },
          });
        }
        return res;
      }
    }

    // Pass through to static assets with security headers attached
    const assetRes = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetRes);
  },
};
