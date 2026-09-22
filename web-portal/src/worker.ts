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

type VerifiedIdentity = { subject: string; role: 'customer' | 'artisan' | 'admin' | 'super_admin' };

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
  let role: VerifiedIdentity['role'] = ['customer', 'artisan', 'admin', 'super_admin'].includes(appRole)
    ? appRole
    : 'customer';
  const adminIds = (env.ADMIN_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (role === 'admin' && adminIds.length > 0 && !adminIds.includes(claims.sub)) {
    role = 'customer';
  }
  if (requireAdmin && role !== 'admin' && role !== 'super_admin') {
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

    // 5. Pruned duplicate edge voice endpoints: Unified onto canonical backend pipeline
    if (pathname === '/api/edge/sarvam-asr' || pathname === '/api/edge/extract-craft') {
      return withSecurityHeaders(new Response(
        JSON.stringify({
          success: false,
          error: 'DUPLICATE_PIPELINE_REMOVED',
          detail: 'Voice cataloging has been unified into the single canonical backend pipeline at /api/v1/voice/speak-catalog, /api/v1/voice/transcribe, and /api/v1/voice/extract-catalog.'
        }),
        { status: 410, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      ));
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
