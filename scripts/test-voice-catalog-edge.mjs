import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '../web-portal/node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gqtcpbllllaewzwqcyun.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxdGNwYmxsbGxhZXd6d3FjeXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTQ2ODgsImV4cCI6MjEwMzU3MDY4OH0.Nc0LgeD1IX8M5lmqF4d2rCHNx5rNLR3Q-FJokxyeYLo';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/voice-catalog`;

let passed = 0;
let total = 0;

function assert(condition, message, details = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message} ${details ? `(${details})` : ''}`);
  } else {
    console.log(`  ❌ [FAIL] ${message} ${details ? `(${details})` : ''}`);
  }
}

async function runEdgeVoiceTests() {
  console.log('='.repeat(80));
  console.log('🧪 SUPABASE EDGE FUNCTION VOICE-CATALOG SECURITY & ROBUSTNESS TEST SUITE');
  console.log('='.repeat(80));

  // 1. Missing Authentication (Should return 401 AUTH_REQUIRED)
  console.log('\n--- 1. Security: Missing Authentication ---');
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tts', text: 'परीक्षण' }),
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 401, 'Rejects unauthenticated request with HTTP 401', `Status: ${res.status}`);
    assert(data.code === 'AUTH_REQUIRED', 'Returns structured error code AUTH_REQUIRED', `Code: ${data.code}`);
    assert(data.request_id && data.request_id.startsWith('req_'), 'Generates and returns request_id', `ID: ${data.request_id}`);
    assert(data.success === false, 'success flag is false (no mock success)');
  } catch (err) {
    assert(false, 'Missing authentication test error', err.message);
  }

  // 2. Invalid Bearer Token (Should return 401 AUTH_INVALID_TOKEN or AUTH_VERIFICATION_ERROR)
  console.log('\n--- 2. Security: Invalid Bearer Token ---');
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_spoofed_jwt_token_12345',
      },
      body: JSON.stringify({ action: 'tts', text: 'परीक्षण' }),
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 401, 'Rejects forged JWT token with HTTP 401', `Status: ${res.status}`);
    assert(data.code === 'AUTH_INVALID_TOKEN' || data.code === 'AUTH_VERIFICATION_ERROR', 'Returns token validation error code', `Code: ${data.code}`);
  } catch (err) {
    assert(false, 'Invalid token test error', err.message);
  }

  // Authenticate valid test artisan
  console.log('\n--- Authenticating Valid Artisan Session ---');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'artisan@hunardhara.gov.in',
    password: 'Artisan@2026',
  });
  if (authErr || !authData?.session?.access_token) {
    console.error('Fatal: Could not authenticate test artisan', authErr);
    process.exit(1);
  }
  const token = authData.session.access_token;
  console.log('Authenticated successfully. User ID:', authData.user.id);

  // 3. Audio File Missing in Form-Data (Should return 400 AUDIO_FILE_MISSING)
  console.log('\n--- 3. Validation: Missing Audio File in Form-Data ---');
  try {
    const fd = new FormData();
    fd.append('action', 'transcribe');
    fd.append('language_code', 'hi-IN');

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 400, 'Rejects missing audio field with HTTP 400', `Status: ${res.status}`);
    assert(data.code === 'AUDIO_FILE_MISSING', 'Returns code AUDIO_FILE_MISSING', `Code: ${data.code}`);
  } catch (err) {
    assert(false, 'Missing audio field test error', err.message);
  }

  // 4. Empty Audio (0 Bytes) (Should return 400 AUDIO_EMPTY_OR_ZERO_LENGTH)
  console.log('\n--- 4. Validation: Empty Audio File (0 Bytes) ---');
  try {
    const emptyBlob = new Blob([], { type: 'audio/wav' });
    const fd = new FormData();
    fd.append('file', emptyBlob, 'empty.wav');
    fd.append('action', 'transcribe');

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 400, 'Rejects empty 0-byte audio with HTTP 400', `Status: ${res.status}`);
    assert(data.code === 'AUDIO_EMPTY_OR_ZERO_LENGTH', 'Returns code AUDIO_EMPTY_OR_ZERO_LENGTH', `Code: ${data.code}`);
  } catch (err) {
    assert(false, 'Empty audio test error', err.message);
  }

  // 5. Invalid Audio Format (Should return 400 INVALID_AUDIO_FORMAT)
  console.log('\n--- 5. Validation: Invalid File Format ---');
  try {
    const textBlob = new Blob(['Not an audio file, plain text payload'], { type: 'text/plain' });
    const fd = new FormData();
    fd.append('file', textBlob, 'document.txt');
    fd.append('action', 'transcribe');

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    assert(res.status === 400, 'Rejects text/plain non-audio file with HTTP 400', `Status: ${res.status}`);
    assert(data.code === 'INVALID_AUDIO_FORMAT', 'Returns code INVALID_AUDIO_FORMAT', `Code: ${data.code}`);
  } catch (err) {
    assert(false, 'Invalid format test error', err.message);
  }

  // 6. Successful Real Hindi Audio Transcription (Sarvam Saaras v4)
  console.log('\n--- 6. End-to-End: Real Hindi Audio Transcription ---');
  try {
    const fixtureCandidates = [
      path.resolve('tests/fixtures/hindi-test.wav'),
      path.resolve('../tests/fixtures/hindi-test.wav'),
    ];
    let fixturePath = fixtureCandidates.find(p => fs.existsSync(p));

    if (!fixturePath) {
      assert(false, 'Test fixture hindi-test.wav exists on disk');
    } else {
      const audioBuffer = fs.readFileSync(fixturePath);
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const fd = new FormData();
      fd.append('file', blob, 'hindi-test.wav');
      fd.append('action', 'transcribe');
      fd.append('language_code', 'hi-IN');

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      assert(res.status === 200, 'STT returns HTTP 200 OK', `Status: ${res.status}`);
      assert(data.success === true, 'Response reports success: true');
      assert(data.source === 'sarvam_saaras_v4', 'Model source confirms sarvam_saaras_v4', `Source: ${data.source}`);
      assert(data.transcript && data.transcript.includes('घोड़ा'), 'Transcript contains expected craft vocabulary', `Transcript: "${data.transcript}"`);
      assert(data.request_id && data.request_id.startsWith('req_'), 'Correlation request_id present in response', `Ref: ${data.request_id}`);
    }
  } catch (err) {
    assert(false, 'Real Hindi transcription test error', err.message);
  }

  // 7. End-to-End Speak-to-Catalog (Transcription + Craft Extraction + Confirmation Audio)
  console.log('\n--- 7. End-to-End: Speak-to-Catalog Workflow ---');
  try {
    const fixtureCandidates = [
      path.resolve('tests/fixtures/hindi-test.wav'),
      path.resolve('../tests/fixtures/hindi-test.wav'),
    ];
    let fixturePath = fixtureCandidates.find(p => fs.existsSync(p));

    if (fixturePath) {
      const audioBuffer = fs.readFileSync(fixturePath);
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const fd = new FormData();
      fd.append('file', blob, 'hindi-test.wav');
      fd.append('action', 'speak-catalog');
      fd.append('language_code', 'hi-IN');

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      assert(res.status === 200, 'Speak-catalog returns HTTP 200 OK', `Status: ${res.status}`);
      assert(data.success === true, 'Response reports success: true');
      assert(data.attributes && data.attributes.craft_type === 'Bastar Dhokra', 'Correctly classified craft as Bastar Dhokra', `Craft: ${data.attributes?.craft_type}`);
      assert(data.confirmation_audio_base64 && data.confirmation_audio_base64.length > 1000, 'Synthesizes TTS confirmation audio', `Audio length: ${data.confirmation_audio_base64?.length} chars`);
    }
  } catch (err) {
    assert(false, 'Speak-to-catalog test error', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`📊 TEST SUITE FINISHED: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  if (passed === total) {
    console.log('🏆 STATUS: 100% PRODUCTION VOICE ARCHITECTURE VERIFIED');
  } else {
    console.log('⚠️ STATUS: SOME TESTS FAILED');
  }
  console.log('='.repeat(80));
}

runEdgeVoiceTests().catch(console.error);
