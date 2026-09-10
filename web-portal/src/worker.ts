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

    // =========================================================================
    // ROUTE PROTECTION & STATIC ASSET SERVING
    // =========================================================================
    const isProtectedRoute =
      pathname === '/artisan' ||
      pathname.startsWith('/artisan/') ||
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
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

    if (isProtectedRoute) {
      const authHeader = request.headers.get('Authorization');
      const cookieHeader = request.headers.get('Cookie') || '';

      const hasToken =
        Boolean(authHeader && authHeader.startsWith('Bearer ')) ||
        cookieHeader.includes('hunardhara_auth_token') ||
        cookieHeader.includes('sb-access-token');

      const isStaticAsset = pathname.includes('.') && !pathname.endsWith('.html');

      // If user is unauthenticated and not requesting an underlying static sub-asset, redirect immediately at the edge
      if (!hasToken && !isStaticAsset) {
        const loginUrl = new URL('/login', url.origin);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set(
          'msg',
          pathname.startsWith('/admin')
            ? 'Sign in as Administrator to access governance and cluster monitoring.'
            : 'Sign in to continue. Access your Artisan Studio, products, AI cataloging tools and earnings.'
        );
        return Response.redirect(loginUrl.toString(), 302);
      }
    }

    // Pass through to static assets
    return env.ASSETS.fetch(request);
  },
};
