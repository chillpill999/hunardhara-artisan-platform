interface Env {
  AI: {
    run: (model: string, input: any) => Promise<any>;
  };
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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
    // CLOUDFLARE WORKERS AI EDGE ENDPOINTS (Free 10K neurons/day)
    // =========================================================================

    // 1. Edge Chat Endpoint (Llama 3.1 8B Instruct)
    if (pathname === '/api/edge/chat' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const userMsg = body.message || '';
        const context = body.context || '';
        const systemPrompt = body.system_prompt || (context ? `${ARTISAN_SYSTEM_PROMPT}\nसंदर्भ: ${context}` : ARTISAN_SYSTEM_PROMPT);

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
                { role: 'user', content: userMsg }
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
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            reply: 'माफ़ कीजिये, अभी सहायता उपलब्ध नहीं हो पा रही है। कृपया पुनः प्रयास करें।',
            error: err?.message || String(err)
          }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Edge Vision Cataloging Endpoint (Llama 3.2 11B Vision)
    if (pathname === '/api/edge/vision-catalog' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const base64Image = body.image_base64 || '';
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const prompt = `You are a certified Indian Handicraft expert for the Ministry of Social Justice and Empowerment (MoSJE).
Inspect this craft photo and return a strict JSON object with these exact keys:
{
  "title": "Clean craft title",
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

        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          prompt,
          image: [...bytes],
          max_tokens: 512
        });

        const rawText = aiResponse.response || '';
        let parsedJson = null;
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) parsedJson = JSON.parse(match[0]);
        } catch {}

        return new Response(
          JSON.stringify({
            success: true,
            catalog: parsedJson || { raw_analysis: rawText },
            model: '@cf/meta/llama-3.2-11b-vision-instruct',
            provider: 'cloudflare_workers_ai'
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err?.message || String(err)
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
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err?.message || String(err)
          }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Edge Sarvam Bulbul TTS Endpoint
    if (pathname === '/api/edge/sarvam-tts' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const text = (body.text || '').trim();
        const lang = body.language_code || 'hi-IN';
        const speaker = body.speaker || 'shubh';
        const model = body.model || 'bulbul:v3';

        const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': 'sk_u4pghxvt_p0vQqzymYE21Skp2UKwr7S66',
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
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Sarvam TTS status ${sarvamRes.status}`);
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err?.message || String(err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Edge Sarvam Saarika ASR Endpoint
    if (pathname === '/api/edge/sarvam-asr' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const file = formData.get('audio') as File;
        const lang = (formData.get('language_code') as string) || 'hi-IN';

        if (!file) {
          return new Response(JSON.stringify({ success: false, error: 'No audio file' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const sarvamForm = new FormData();
        sarvamForm.append('file', file, 'artisan_recording.wav');
        sarvamForm.append('model', 'saarika:v2.5');
        sarvamForm.append('language_code', lang);

        const sRes = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: {
            'api-subscription-key': 'sk_u4pghxvt_p0vQqzymYE21Skp2UKwr7S66',
          },
          body: sarvamForm,
        });

        if (sRes.ok) {
          const sData: any = await sRes.json();
          return new Response(
            JSON.stringify({
              success: true,
              transcript: sData.transcript || '',
              language_code: sData.language_code || lang,
              source: 'sarvam_saarika_edge',
            }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Sarvam ASR status ${sRes.status}`);
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err?.message || String(err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // STRICT ADMIN ROUTE PROTECTION & DIRECT LINK BLOCKING
    // =========================================================================
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
    if (isAdminRoute) {
      const authHeader = request.headers.get('Authorization');
      const cookieHeader = request.headers.get('Cookie') || '';
      const isStaticAsset = pathname.includes('.') && !pathname.endsWith('.html');

      if (!isStaticAsset) {
        const adminEmailMatch = cookieHeader.match(/hunardhara_admin_email=([^;]+)/);
        const adminEmail = adminEmailMatch ? decodeURIComponent(adminEmailMatch[1]).trim().toLowerCase() : '';

        const AUTHORIZED_ADMIN_EMAILS = [
          'aryanrockstar2007@gmail.com',
        ];

        const hasToken =
          Boolean(authHeader && authHeader.startsWith('Bearer ')) ||
          cookieHeader.includes('hunardhara_auth_token') ||
          cookieHeader.includes('sb-access-token');

        // 1. Block unauthenticated direct URL access
        if (!hasToken || !adminEmail) {
          const loginUrl = new URL('/login', url.origin);
          loginUrl.searchParams.set('redirect', pathname);
          loginUrl.searchParams.set('blocked', 'direct_admin_link');
          loginUrl.searchParams.set(
            'msg',
            'प्रशासकीय लिंक अवरोधित: Direct admin link is blocked. Only the authorized administrator has access.'
          );
          return Response.redirect(loginUrl.toString(), 302);
        }

        // 2. Token present, but email is NOT authorized
        if (!AUTHORIZED_ADMIN_EMAILS.includes(adminEmail)) {
          return new Response(
            `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>403 Forbidden - HunarDhara Admin</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #ef4444; border-radius: 24px; max-width: 480px; width: 100%; padding: 32px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: #7f1d1d; color: #fca5a5; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px; color: #f87171; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }
    .email { background: #0f172a; padding: 10px; border-radius: 12px; font-family: monospace; font-size: 13px; color: #f8fafc; margin-bottom: 24px; border: 1px solid #334155; }
    .btn { display: inline-block; background: #c85a32; color: white; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 9999px; transition: 0.2s; }
    .btn:hover { background: #b84e28; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">प्रशासकीय लिंक अवरोधित • Direct Admin Access Blocked</div>
    <h1>403 Forbidden: Unauthorised Email</h1>
    <p>Direct access to the HunarDhara Admin Panel is strictly restricted. Only the designated platform administrator is authorized to access this route.</p>
    <div class="email">Attempted Account: ${adminEmail || 'Unknown'}</div>
    <a href="/" class="btn">बाज़ार पर वापस जाएं (Marketplace)</a>
  </div>
</body>
</html>`,
            { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      }
    }

    // Standard protected routes (Artisan studio, earnings, orders, etc.)
    const isOtherProtectedRoute =
      pathname === '/artisan' ||
      pathname.startsWith('/artisan/') ||
      pathname === '/studio' ||
      pathname === '/earnings' ||
      pathname === '/dashboard' ||
      pathname === '/inventory' ||
      pathname === '/profile' ||
      pathname === '/orders' ||
      pathname.startsWith('/orders/') ||
      pathname === '/cart' ||
      pathname.startsWith('/cart/') ||
      pathname === '/account' ||
      pathname.startsWith('/account/');

    if (isOtherProtectedRoute) {
      const authHeader = request.headers.get('Authorization');
      const cookieHeader = request.headers.get('Cookie') || '';

      const hasToken =
        Boolean(authHeader && authHeader.startsWith('Bearer ')) ||
        cookieHeader.includes('hunardhara_auth_token') ||
        cookieHeader.includes('sb-access-token');

      const isStaticAsset = pathname.includes('.') && !pathname.endsWith('.html');

      if (!hasToken && !isStaticAsset) {
        const loginUrl = new URL('/login', url.origin);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set(
          'msg',
          'Sign in to continue. Access your Artisan Studio, products, AI cataloging tools and earnings.'
        );
        return Response.redirect(loginUrl.toString(), 302);
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

    // Pass through to static assets
    return env.ASSETS.fetch(request);
  },
};
