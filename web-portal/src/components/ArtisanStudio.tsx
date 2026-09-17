'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  speakToCatalog,
  transcribeAudio,
  extractCraftFromVoice,
  synthesizeSpeech,
  saveUploadedProduct,
  analyzeCraftImage,
  createBackendProduct
} from '@/lib/api';
import { Product } from '@/lib/types';
import {
  Camera,
  Upload,
  Mic,
  MicOff,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  X,
  Plus,
  Minus,
  SwitchCamera,
  Edit3,
  Eye,
  Check,
  Sparkles,
  Languages,
  Radio,
  Clock,
  Coins,
  Palette,
  AlertCircle,
  Calculator
} from 'lucide-react';

interface ExtractedAttributes {
  productName: string;
  productNameHi: string;
  craftType: string;
  materials: string[];
  color: string | null;
  dimensions: string | null;
  productionDays: number | null;
  materialCost: number | null;
  recommendedPrice: number | null;
  wageFloor: number | null;
  descriptionHi: string;
  descriptionEn: string;
  voiceScriptHi: string;
  confidenceScore?: number;
  verificationRequired?: string[];
  factsDetected?: {
    days?: boolean;
    cost?: boolean;
    materials?: boolean;
    color?: boolean;
  };
}

const INDIC_LANGUAGES = [
  { code: 'hi-IN', label: '🇮🇳 हिंदी (Hindi)' },
  { code: 'en-IN', label: '🇬🇧 English (India)' },
  { code: 'bho-IN', label: 'भोजपुरी (Bhojpuri)' },
  { code: 'mai-IN', label: 'मैथिली (Maithili)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
];

const VOICE_PRESETS = [
  {
    label: 'बनारसी साड़ी',
    icon: '🥻',
    lang: 'hi-IN',
    text: 'यह शुद्ध कतान सिल्क की बनारसी साड़ी है, लाल और सुनहरा रंग, 10 दिन में बुनी गई, शुद्ध सोने की ज़री का काम है।',
    image: '/static/studio/varanasi_silk.jpg'
  },
  {
    label: 'बस्तर ढोकरा',
    icon: '🪔',
    lang: 'hi-IN',
    text: 'यह बस्तर का पारंपरिक ढोकरा शिल्प है, बेल मेटल और पीतल से 5 दिन में लॉस्ट-वैक्स तकनीक से बनी नंदी की मूर्ति है।',
    image: '/static/studio/bastar_dhokra.jpg'
  },
  {
    label: 'खुर्जा पॉटरी',
    icon: '🏺',
    lang: 'hi-IN',
    text: 'यह खुर्जा की हस्तनिर्मित ग्लेज्ड सिरेमिक वाटर पॉट है, टेराकोटा और कोबाल्ट नीले रंग में 3 दिन में चाक पर बनी है।',
    image: '/static/studio/khurja_pottery.jpg'
  },
  {
    label: 'मधुबनी पेंटिंग',
    icon: '🎨',
    lang: 'hi-IN',
    text: 'यह मधुबनी जीवन वृक्ष की हस्तचित्रित पेंटिंग है, तुषार सिल्क पर प्राकृतिक रंगों और बांस की कलम से 8 दिन में बनी है।',
    image: '/static/studio/madhubani_art.jpg'
  }
];

// Pure JS standard 16-bit PCM Mono WAV Encoder
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');

  /* FMT sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true); // Sample rate (16000 Hz)
  view.setUint32(28, sampleRate * 2, true); // Byte rate (16000 * 1 * 2)
  view.setUint16(32, 2, true); // Block align (1 * 2)
  view.setUint16(34, 16, true); // Bits per sample (16-bit)

  /* DATA sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit signed PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Downsample Float32Array buffer to 16,000 Hz
function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate = 16000): Float32Array {
  if (outputRate >= inputRate) return buffer;
  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

// Calculate RMS energy of Float32Array audio samples
function calculateRMS(samples: Float32Array): number {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

// Inline AudioWorkletProcessor script for zero-dependency raw PCM capture
const AUDIO_WORKLET_PROCESSOR_CODE = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
`;

export default function ArtisanStudio() {
  const { user, role, profile } = useAuth();

  // Mode: Prioritize Voice ("Speak First") by default
  const [entryMode, setEntryMode] = useState<'voice' | 'photo'>('voice');

  // Steps: 2 (Voice), 1 (Photo), 3 (AI Processing), 5 (Confirmation), 6 (Published)
  const [step, setStep] = useState<number>(2);

  // Selected Indic Language
  const [selectedLanguage, setSelectedLanguage] = useState<string>('hi-IN');

  // Photo State
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rawTranscript, setRawTranscript] = useState('');
  const rawTranscriptRef = useRef<string>('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [clarificationNotice, setClarificationNotice] = useState<{
    messageHi: string;
    messageEn?: string;
    transcript?: string;
  } | null>(null);
  const [quickEditField, setQuickEditField] = useState<string | null>(null);

  // AudioWorklet, Web Audio & MediaRecorder Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Sarvam Bulbul TTS Audio Player State
  const [ttsAudioBase64, setTtsAudioBase64] = useState<string | null>(null);
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // AI Processing State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState('');

  // AI Extracted Details - Starts strictly EMPTY/NULL until speech or image is processed
  const [extractedData, setExtractedData] = useState<ExtractedAttributes | null>(null);

  // Client-side live interim speech preview (used ONLY for real-time visual feedback while mic is live)
  const [livePreviewTranscript, setLivePreviewTranscript] = useState('');

  // Edit Mode on Step 5
  const [isEditMode, setIsEditMode] = useState(false);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState('prod-001');

  // AI Multimodal Vision State
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [visionAnalysisDone, setVisionAnalysisDone] = useState(false);
  const [visionDetectedCraft, setVisionDetectedCraft] = useState<string | null>(null);

  const runImageUnderstanding = async (imgData: string) => {
    setIsAnalyzingImage(true);
    try {
      const analysis = await analyzeCraftImage(imgData);
      if (analysis && analysis.craft_type) {
        setVisionAnalysisDone(true);
        setVisionDetectedCraft(analysis.craft_type);
        setExtractedData(prev => ({
          productName: analysis.product_name_en || prev?.productName || 'Handcrafted Heritage Item',
          productNameHi: analysis.product_name_hi || prev?.productNameHi || 'हस्तनिर्मित शिल्प',
          craftType: analysis.craft_type,
          materials: analysis.materials && analysis.materials.length > 0 ? analysis.materials : (prev?.materials || []),
          color: prev?.color || (analysis.dominant_colors?.[0] || ''),
          dimensions: analysis.estimated_dimensions || prev?.dimensions || '',
          productionDays: analysis.estimated_production_days ?? prev?.productionDays ?? null,
          materialCost: prev?.materialCost ?? null,
          wageFloor: prev?.wageFloor ?? null,
          recommendedPrice: analysis.suggested_retail_price ?? prev?.recommendedPrice ?? null,
          descriptionHi: analysis.description_hi || prev?.descriptionHi || 'कारीगर द्वारा निर्मित पारंपरिक कलाकृति।',
          descriptionEn: analysis.description_en || prev?.descriptionEn || 'Authentic handcrafted heritage item.',
          voiceScriptHi: `बधाई हो! आपका शिल्प ${analysis.product_name_hi} एआई द्वारा पहचाना गया है।`,
          confidenceScore: 0.90
        }));
      }
    } catch (err) {
      console.warn('Image understanding note:', err);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // Recalculate price when days or material changes
  const updatePricing = (newDays: number, newCost: number) => {
    const days = Math.max(1, newDays);
    const cost = Math.max(0, newCost);
    const wageFloor = cost + (days * 650);
    const fairPrice = Math.round((wageFloor * 1.25) / 50) * 50;
    setExtractedData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        productionDays: days,
        materialCost: cost,
        wageFloor,
        recommendedPrice: fairPrice,
        verificationRequired: (prev.verificationRequired || []).filter(v => v !== 'production_days' && v !== 'material_cost'),
        voiceScriptHi: `बधाई हो! आपका उत्पाद ${prev.productNameHi} तैयार है। ${days} दिनों के परिश्रम और सामग्री को जोड़कर इसका उचित बिक्री मूल्य ₹${fairPrice.toLocaleString('en-IN')} तय किया गया है।`
      };
    });
  };

  // Camera Handlers
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      alert('कैमरा शुरू नहीं हो पाया। कृपया नीचे दिए गए "गैलरी से चुनें" बटन का उपयोग करें।');
      setIsCameraActive(false);
    }
  };

  const toggleCameraFacing = async () => {
    stopCamera();
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotoUrl(dataUrl);
        stopCamera();
        runImageUnderstanding(dataUrl);
        setStep(2); // Advance to voice step
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('फ़ाइल का आकार 10MB से कम होना चाहिए।');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setPhotoUrl(dataUrl);
        stopCamera();
        runImageUnderstanding(dataUrl);
        setStep(2); // Advance to voice step
      };
      reader.readAsDataURL(file);
    }
  };

  // Voice Recording Handlers with AudioWorklet-First 16kHz PCM WAV Recording & Server/Edge ASR
  const startRecording = async () => {
    setVoiceError(null);
    setClarificationNotice(null);
    rawTranscriptRef.current = '';
    setRawTranscript('');
    setLivePreviewTranscript('');
    setExtractedData(null);
    setAudioUrl(null);
    setTtsAudioBase64(null);
    pcmChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();

    try {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      // 1. Client-Side Live Speech Recognition for instantaneous real-time visual feedback ONLY
      if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = selectedLanguage;
            recognition.onresult = (event: any) => {
              let live = '';
              for (let i = 0; i < event.results.length; i++) {
                live += event.results[i][0].transcript + ' ';
              }
              const cleaned = live.trim();
              if (cleaned) {
                setLivePreviewTranscript(cleaned);
              }
            };
            recognition.onerror = (e: any) => {
              console.warn('Web speech recognition preview note:', e);
            };
            recognition.start();
            recognitionRef.current = recognition;
          } catch (e) {
            console.log('Web speech init note:', e);
          }
        }
      }

      // 2. Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      let workletRegistered = false;
      if (audioCtx.audioWorklet) {
        try {
          const blob = new Blob([AUDIO_WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await audioCtx.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          const workletNode = new AudioWorkletNode(audioCtx, 'pcm-recorder-processor');
          workletNode.port.onmessage = (e) => {
            if (e.data && e.data.length > 0) {
              pcmChunksRef.current.push(new Float32Array(e.data));
            }
          };

          source.connect(workletNode);
          // Connect to a 0-gain sink to keep audio processing alive without feedback
          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0;
          workletNode.connect(silentGain);
          silentGain.connect(audioCtx.destination);

          workletNodeRef.current = workletNode;
          workletRegistered = true;
        } catch (workletErr) {
          console.warn('AudioWorklet registration note, falling back to ScriptProcessor:', workletErr);
        }
      }

      // Fallback 1: ScriptProcessorNode
      if (!workletRegistered) {
        try {
          const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
          scriptNode.onaudioprocess = (e) => {
            const channel = e.inputBuffer.getChannelData(0);
            pcmChunksRef.current.push(new Float32Array(channel));
          };
          source.connect(scriptNode);
          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0;
          scriptNode.connect(silentGain);
          silentGain.connect(audioCtx.destination);
          scriptProcessorRef.current = scriptNode;
        } catch (spErr) {
          console.warn('ScriptProcessor fallback note:', spErr);
        }
      }

      // Fallback 2: MediaRecorder for safety
      try {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        mediaRecorder.start(250);
      } catch (mrErr) {
        console.warn('MediaRecorder init note:', mrErr);
      }

      setIsRecording(true);
    } catch (micErr) {
      console.warn('Microphone access note:', micErr);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setIsRecording(false);
      setVoiceError('⚠️ माइक्रोफ़ोन की अनुमति नहीं मिली या माइक उपलब्ध नहीं है (Microphone unavailable or permission denied). आप नीचे सीधे उत्पाद का विवरण लिख सकते हैं या त्वरित विकल्प चुन सकते हैं।');
    }
  };

  const stopRecording = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setLivePreviewTranscript('');

    const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
    setIsRecording(false);

    // Stop MediaRecorder if running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }

    // Stop media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect worklet / script processor
    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect(); } catch {}
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }

    const audioCtx = audioContextRef.current;
    const inputSampleRate = audioCtx?.sampleRate || 44100;
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Quality Gate 1: Check recording duration (must be >= 1.2 seconds)
    if (duration < 1.2) {
      setVoiceError(`⚠️ रिकॉर्डिंग बहुत छोटी थी (केवल ${duration.toFixed(1)} सेकंड)। कृपया कम से कम 2-3 सेकंड तक बोलें।`);
      return;
    }

    // Merge Float32Array PCM chunks
    const totalSamples = pcmChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    let wavBlob: Blob | null = null;
    let rms = 0;

    if (totalSamples > 0) {
      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of pcmChunksRef.current) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      rms = calculateRMS(merged);

      // Quality Gate 2: Inspect RMS signal energy (reject pure silence / faint hiss < 0.008)
      if (rms < 0.008) {
        setVoiceError(`⚠️ आवाज़ बहुत धीमी या मौन है (Voice too faint or silent: RMS ${rms.toFixed(4)})। कृपया माइक के पास साफ़ आवाज़ में बोलें।`);
        return;
      }

      // Downsample to 16,000 Hz and encode to 16-bit PCM WAV
      const downsampled = downsampleBuffer(merged, inputSampleRate, 16000);
      wavBlob = encodeWAV(downsampled, 16000);
    } else if (audioChunksRef.current.length > 0) {
      wavBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    if (!wavBlob) {
      setVoiceError('⚠️ कोई ऑडियो रिकॉर्ड नहीं हुआ। कृपया पुनः प्रयास करें।');
      return;
    }

    setAudioUrl(URL.createObjectURL(wavBlob));

    // Telemetry: Milestone 1 (Audio Received) - sanitized in production
    const isDev = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.search.includes('debug=true'));
    if (isDev) {
      console.log('🎙️ [Hunardhara Telemetry] 1. Audio Received:', {
        duration_sec: Number(duration.toFixed(2)),
        rms_energy: Number(rms.toFixed(4)),
        size_bytes: wavBlob.size,
        sample_rate: 16000,
        format: 'audio/wav',
      });
    }

    // Wipe previous transcript and extracted data before processing
    rawTranscriptRef.current = '';
    setRawTranscript('');
    setExtractedData(null);
    setVoiceError(null);
    setClarificationNotice(null);

    setIsAiProcessing(true);
    setStep(3);
    setAiProcessingStage('आवाज़ का विश्लेषण एवं शिल्प पहचान (Sarvam Saarika ASR)...');

    try {
      // ONE Canonical Speak-to-Catalog Pipeline: 16kHz mono WAV -> real Sarvam ASR -> real craft extraction -> frontend review
      const speakResult = await speakToCatalog(wavBlob, selectedLanguage);

      if (!speakResult.success) {
        setIsAiProcessing(false);
        setStep(2);
        setVoiceError(`⚠️ ${speakResult.error || 'आवाज़ स्पष्ट रूप से पहचानी नहीं जा सकी। कृपया माइक के पास साफ़ आवाज़ में पुनः बोलें।'}`);
        return;
      }

      if (speakResult.requires_clarification) {
        setIsAiProcessing(false);
        setStep(2);
        const spoken = (speakResult.transcript || '').trim();
        setRawTranscript(spoken);
        rawTranscriptRef.current = spoken;
        setClarificationNotice({
          messageHi: speakResult.message_hi || 'आवाज़ में उत्पाद का विवरण नहीं मिला। कृपया अपने शिल्प का नाम (जैसे घंटी, साड़ी, खिलौना, पॉट), सामग्री, और बनाने के दिन बताएं।',
          messageEn: speakResult.message_en || 'No craft details detected. Please mention your product name, materials, and days to make.',
          transcript: spoken
        });
        return;
      }

      const spokenText = (speakResult.transcript || '').trim();
      if (!spokenText) {
        setIsAiProcessing(false);
        setStep(2);
        setVoiceError('⚠️ आवाज़ स्पष्ट रूप से पहचानी नहीं जा सकी। कृपया माइक के पास साफ़ आवाज़ में पुनः बोलें।');
        return;
      }

      rawTranscriptRef.current = spokenText;
      setRawTranscript(spokenText);

      const craftData = speakResult.attributes;
      if (!craftData) {
        setIsAiProcessing(false);
        setStep(2);
        setVoiceError('⚠️ शिल्प विवरण प्राप्त नहीं हो सका। कृपया पुनः प्रयास करें।');
        return;
      }

      setAiProcessingStage('सांविधिक मजदूरी (₹650/दिन) एवं न्यायसंगत मूल्य निर्धारण...');

      const days = craftData.production_days ?? null;
      const cost = craftData.material_cost ?? null;
      const floor = craftData.wage_floor ?? (days !== null && cost !== null ? cost + days * 650 : null);
      const price = craftData.recommended_price ?? (floor !== null ? Math.round((floor * 1.25) / 50) * 50 : null);
      const prodNameHi = craftData.product_name_hi || '';
      const prodNameEn = craftData.product_name_en || '';
      const voiceScript = craftData.voice_script_hi || (price !== null
        ? `बधाई हो! आपका उत्पाद ${prodNameHi ? prodNameHi + ' ' : ''}तैयार है। ${days} दिनों के परिश्रम और सामग्री को जोड़कर इसका उचित बिक्री मूल्य ₹${price.toLocaleString('en-IN')} तय किया गया है।`
        : `बधाई हो! आपका उत्पाद ${prodNameHi ? prodNameHi + ' ' : ''}पहचाना गया है। कृपया उचित मूल्य तय करने के लिए निर्माण समय और सामग्री लागत की पुष्टि करें।`);

      const newExtracted: ExtractedAttributes = {
        productName: prodNameEn,
        productNameHi: prodNameHi,
        craftType: craftData.craft_type || '',
        materials: craftData.materials && craftData.materials.length > 0 ? craftData.materials : [],
        color: craftData.color || '',
        dimensions: craftData.dimensions || '',
        productionDays: days,
        materialCost: cost,
        wageFloor: floor,
        recommendedPrice: price,
        descriptionHi: craftData.description_hi || spokenText,
        descriptionEn: craftData.description_en || '',
        voiceScriptHi: voiceScript,
        confidenceScore: craftData.confidence_score ?? 0.95,
        factsDetected: craftData.facts_detected,
        verificationRequired: craftData.verification_required || []
      };

      setExtractedData(newExtracted);

      // Pre-cache confirmation TTS audio for playback in Step 5
      if (speakResult.confirmation_audio_base64) {
        setTtsAudioBase64(speakResult.confirmation_audio_base64);
      } else {
        synthesizeSpeech(voiceScript, selectedLanguage, 'shubh')
          .then((ttsRes) => {
            if (ttsRes.success && ttsRes.audio_base64) {
              setTtsAudioBase64(ttsRes.audio_base64);
            }
          })
          .catch(() => {});
      }

      setIsAiProcessing(false);
    } catch (err: any) {
      setIsAiProcessing(false);
      setStep(2);
      setVoiceError(`⚠️ आवाज़ प्रसंस्करण में त्रुटि: ${err?.message || 'अज्ञात त्रुटि'}`);
    }
  };

  // Process Spoken Description with Sarvam 105B LLM & Bulbul TTS
  const processVoiceDescription = async (spokenText: string, presetImage?: string) => {
    setRawTranscript(spokenText);
    setVoiceError(null);
    setClarificationNotice(null);
    setExtractedData(null);

    const isDev = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.search.includes('debug=true'));
    if (isDev) {
      console.log('📝 [Hunardhara Telemetry] 2. Transcript Received:', spokenText);
      console.log('🌐 [Hunardhara Telemetry] 3. Language Detected:', selectedLanguage);
      console.log('🤖 [Hunardhara Telemetry] 4. Prompt Sent to AI: Sarvam 105B Indic LLM pipeline');
    }

    // Call Craft Extraction Endpoint
    const craftData = await extractCraftFromVoice(spokenText, selectedLanguage);

    // Clarification & Quality Gating: If greeting-only or missing craft details, DO NOT advance!
    if (craftData.requires_clarification) {
      setClarificationNotice({
        messageHi: craftData.message_hi || 'आवाज़ में उत्पाद का विवरण नहीं मिला। कृपया अपने शिल्प का नाम (जैसे घंटी, साड़ी, खिलौना, पॉट), सामग्री, और बनाने के दिन बताएं।',
        messageEn: craftData.message_en || 'No craft details detected. Please mention your product name, materials, and days to make.',
        transcript: spokenText
      });
      setStep(2); // Stay on Step 2
      return;
    }

    setStep(3);
    setIsAiProcessing(true);
    setAiProcessingStage('आवाज़ का सटीक विश्लेषण...');

    try {
      setTimeout(() => {
        setAiProcessingStage('शिल्प विवरण व सामग्री का विश्लेषण...');
      }, 700);

      setTimeout(() => {
        setAiProcessingStage('सांविधिक मजदूरी (₹650/दिन) एवं न्यायसंगत मूल्य निर्धारण...');
      }, 1400);

      // Only assign photo if user explicitly chose an optional demo example with an image
      if (!photoUrl && presetImage) {
        setPhotoUrl(presetImage);
      }

      const days = craftData.production_days ?? null;
      const cost = craftData.material_cost ?? null;
      const floor = craftData.wage_floor ?? (days !== null && cost !== null ? cost + days * 650 : null);
      const price = craftData.recommended_price ?? (floor !== null ? Math.round((floor * 1.25) / 50) * 50 : null);
      const titleHi = craftData.product_name_hi || '';
      const voiceScript = craftData.voice_script_hi || (price !== null
        ? `बधाई हो! आपका उत्पाद ${titleHi || 'शिल्प'} तैयार है। ${days ?? ''} दिनों के परिश्रम और सामग्री को जोड़कर इसका उचित बिक्री मूल्य ₹${price.toLocaleString('en-IN')} तय किया गया है।`
        : `बधाई हो! आपका उत्पाद ${titleHi || 'शिल्प'} पहचाना गया है। कृपया उचित मूल्य तय करने के लिए निर्माण समय और सामग्री लागत की पुष्टि करें।`);

      const newExtracted: ExtractedAttributes = {
        productName: craftData.product_name_en || '',
        productNameHi: craftData.product_name_hi || '',
        craftType: craftData.craft_type || '',
        materials: craftData.materials && craftData.materials.length > 0 ? craftData.materials : [],
        color: craftData.color || '',
        dimensions: craftData.dimensions || '',
        productionDays: days,
        materialCost: cost,
        wageFloor: floor,
        recommendedPrice: price,
        descriptionHi: craftData.description_hi || spokenText || '',
        descriptionEn: craftData.description_en || '',
        voiceScriptHi: voiceScript,
        confidenceScore: craftData.confidence_score ?? 0.92,
        factsDetected: craftData.facts_detected,
        verificationRequired: craftData.verification_required || []
      };

      setExtractedData(newExtracted);

      if (isDev) {
        console.log('⚡ [Hunardhara Telemetry] 5. Raw AI Response:', craftData);
        console.log('🏷️ [Hunardhara Telemetry] 6. Final Catalog Output:', {
          title_hi: newExtracted.productNameHi,
          title_en: newExtracted.productName,
          craft: newExtracted.craftType,
          days: newExtracted.productionDays,
          cost: newExtracted.materialCost,
          price: newExtracted.recommendedPrice,
          confidence: newExtracted.confidenceScore,
        });
      }

      // Pre-synthesize TTS Audio for Step 5
      setTimeout(() => {
        setAiProcessingStage('आवाज़ में पुष्टिकरण तैयार किया जा रहा है...');
      }, 1900);

      const ttsRes = await synthesizeSpeech(voiceScript, selectedLanguage, 'shubh');
      if (ttsRes.success && ttsRes.audio_base64) {
        setTtsAudioBase64(ttsRes.audio_base64);
      }
    } catch (e) {
      console.warn('Voice processing pipeline notice:', e);
    } finally {
      setTimeout(() => {
        setIsAiProcessing(false);
        setStep(5); // Advance to Confirmation Screen
      }, 2400);
    }
  };

  // Play / Pause Sarvam AI TTS Audio
  const togglePlayTts = () => {
    if (audioPlayerRef.current) {
      if (isPlayingTts) {
        audioPlayerRef.current.pause();
        setIsPlayingTts(false);
      } else {
        audioPlayerRef.current.play().then(() => {
          setIsPlayingTts(true);
        }).catch(() => {
          setIsPlayingTts(false);
        });
      }
      return;
    }

    if (ttsAudioBase64) {
      const audio = new Audio(`data:audio/wav;base64,${ttsAudioBase64}`);
      audioPlayerRef.current = audio;
      audio.onended = () => setIsPlayingTts(false);
      audio.onerror = () => setIsPlayingTts(false);
      audio.play().then(() => {
        setIsPlayingTts(true);
      }).catch(() => {
        setIsPlayingTts(false);
      });
    } else {
      // Fallback: Browser Web Speech synthesis if offline
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (isPlayingTts) {
          window.speechSynthesis.cancel();
          setIsPlayingTts(false);
        } else {
          const text = extractedData?.voiceScriptHi || extractedData?.descriptionHi || '';
          if (!text) return;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = selectedLanguage;
          utterance.onend = () => setIsPlayingTts(false);
          utterance.onerror = () => setIsPlayingTts(false);
          setIsPlayingTts(true);
          window.speechSynthesis.speak(utterance);
        }
      }
    }
  };

  // Publish to Database & Live Marketplace
  const handleConfirmAndPublish = async () => {
    if (!extractedData) return;

    // Strict Authorization: Only authenticated artisans or admins may publish products
    if (!user || (role !== 'artisan' && role !== 'admin')) {
      alert('कृपया उत्पाद प्रकाशित करने के लिए शिल्पकार के रूप में लॉगिन करें (Only authorized artisans can publish craft catalogs).');
      return;
    }

    const finalTitle = extractedData.productNameHi?.trim() || extractedData.productName?.trim();
    const finalCraft = extractedData.craftType?.trim();
    if (!finalTitle || !finalCraft) {
      alert('कृपया प्रकाशन से पहले उत्पाद का नाम और शिल्प प्रकार अवश्य दर्ज करें (Product name and craft type are required before publishing).');
      setIsEditMode(true);
      return;
    }

    setIsPublishing(true);
    try {
      let newId = `prod-live-${Date.now().toString().slice(-6)}`;

      // Resolve final studio image (No keyword forcing; use actual captured photo or neutral craft placeholder)
      const finalStudioImage = photoUrl || '/static/studio/placeholder_craft.jpg';

      let clusterId = 'cluster-general-handicraft';
      const ct = finalCraft.toLowerCase();
      if (ct.includes('varanasi') || ct.includes('banarasi') || ct.includes('katan') || ct.includes('बनारसी')) {
        clusterId = 'cluster-varanasi-silk';
      } else if (ct.includes('bastar') || ct.includes('dhokra') || ct.includes('बस्तर') || ct.includes('ढोकरा')) {
        clusterId = 'cluster-bastar-dhokra';
      } else if (ct.includes('khurja') || ct.includes('खुर्जा')) {
        clusterId = 'cluster-khurja-pottery';
      } else if (ct.includes('madhubani') || ct.includes('mithila') || ct.includes('मधुबनी') || ct.includes('मिथिला')) {
        clusterId = 'cluster-madhubani-painting';
      } else if (ct.includes('channapatna') || ct.includes('चन्नापटना')) {
        clusterId = 'cluster-channapatna-toys';
      }

      // Persist to backend database with authenticated artisan credentials
      const backendCreateRes = await createBackendProduct({
        title: finalTitle,
        description: extractedData.descriptionHi || extractedData.descriptionEn || '',
        description_hindi: extractedData.descriptionHi || '',
        description_english: extractedData.descriptionEn || '',
        craft_type: finalCraft,
        cluster_id: clusterId,
        listing_price: extractedData.recommendedPrice ?? (extractedData.wageFloor ?? 500),
        cost_materials: extractedData.materialCost ?? 0,
        labor_hours: (extractedData.productionDays ?? 1) * 8,
        stock_quantity: 5,
        artisan_id: user.id,
        materials: extractedData.materials,
        studio_image_url: finalStudioImage,
      });

      if (backendCreateRes.success && backendCreateRes.data?.id) {
        newId = backendCreateRes.data.id;
      }

      const newProduct: Product = {
        id: newId,
        artisan_id: user.id,
        cluster_id: clusterId,
        title_en: extractedData.productName || finalTitle,
        title_hi: extractedData.productNameHi || finalTitle,
        craft_type: finalCraft,
        materials: extractedData.materials,
        dimensions: extractedData.dimensions || '',
        production_time_days: extractedData.productionDays ?? 1,
        technique: 'हस्तशिल्प कारीगरी (Artisanal Craftwork)',
        color: extractedData.color || '',
        description_en: extractedData.descriptionEn,
        description_hi: extractedData.descriptionHi,
        seo_tags: [finalCraft, 'Handmade', 'GI Craft', 'Hunardhara Live'],
        studio_image_url: finalStudioImage,
        floor_price: extractedData.wageFloor ?? 0,
        recommended_retail_d2c: extractedData.recommendedPrice ?? 0,
        wholesale_b2b: extractedData.recommendedPrice ? Math.round(extractedData.recommendedPrice * 0.75) : 0,
        available_stock: 5,
        is_published: true,
        created_at: new Date().toISOString(),
        artisan_name: user.user_metadata?.full_name || profile?.full_name || 'प्रमाणित शिल्पकार (Verified Artisan)',
        artisan_state: user.user_metadata?.state || profile?.state || '',
        gi_certified: Boolean((user.user_metadata as any)?.gi_certified),
      };

      // 1. Immediately persist locally (Guaranteed zero-latency live presentation upload)
      saveUploadedProduct(newProduct);
      setPublishedId(newId);

      // 2. AI Learning Loop: Record Artisan Review Outcome (Correct vs Wrong/Feedback)
      try {
        const reviewPayload = {
          review_type: isEditMode ? 'WRONG' : 'CORRECT',
          craft_type: extractedData.craftType || 'Traditional Craft',
          input_data: {
            transcript: rawTranscript,
            photo_available: !!photoUrl,
            entry_mode: entryMode
          },
          ai_product_card: {
            title_hi: extractedData.productNameHi,
            title_en: extractedData.productName,
            craft_type: extractedData.craftType,
            materials: extractedData.materials,
            production_days: extractedData.productionDays,
            material_cost: extractedData.materialCost,
            price: extractedData.recommendedPrice
          },
          corrections: isEditMode ? {
            edited_name_hi: extractedData.productNameHi,
            edited_material_cost: extractedData.materialCost,
            edited_production_days: extractedData.productionDays
          } : null,
          language: selectedLanguage
        };

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://hunardhara-artisan-platform.onrender.com/api/v1';
          await fetch(`${apiBase}/ai/assistant/review-outcome`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(reviewPayload),
          });
        }
      } catch (err) {
        console.warn('AI learning loop note:', err);
      }

      // 3. Sync to Supabase if session exists
      if (user) {
        try {
          const { data, error } = await supabase
            .from('craft_products')
            .insert({
              id: newId,
              artisan_id: user.id,
              title_en: extractedData.productName,
              title_hi: extractedData.productNameHi,
              craft_type: extractedData.craftType,
              materials: extractedData.materials,
              dimensions: extractedData.dimensions || 'Standard',
              technique: 'हस्तशिल्प कारीगरी (Artisanal Craftwork)',
              color: extractedData.color,
              description_en: extractedData.descriptionEn,
              description_hi: extractedData.descriptionHi,
              seo_tags: [extractedData.craftType, 'Handmade', 'GI Craft', 'Hunardhara Live'],
              image_url: finalStudioImage,
              price: extractedData.recommendedPrice,
              cost_materials: extractedData.materialCost,
              production_time_days: extractedData.productionDays,
              available_stock: 5,
              status: 'published',
              is_published: true,
            })
            .select('id')
            .single();

          if (!error && data?.id) {
            setPublishedId(data.id);
          }
        } catch (err) {
          console.warn('Supabase sync note:', err);
        }
      }
    } catch (err) {
      console.warn('Publishing pipeline note:', err);
    } finally {
      setIsPublishing(false);
      setStep(6); // Success Celebration Screen
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Studio Header Card */}
      <div className="bg-[#1b4332] text-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#2d6a4f]/30">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e9a83a]/20 border border-[#e9a83a]/40 text-xs font-bold text-[#e9a83a]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>सर्वम एआई (Sarvam AI) द्वारा संचालित</span>
            </div>
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
              बोलें. फोटो लें. बेचें.
            </h2>
            <p className="text-xs sm:text-sm text-[#e8f5e9] font-light">
              बिना टाइप किए, केवल अपनी मातृभाषा में बोलकर अपना उत्पाद ऑनलाइन बाज़ार में सूचीबद्ध करें।
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#c85a32] text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-md">
            🎤
          </div>
        </div>

        {/* Mode Selector: Speak First vs Photo First */}
        {step <= 2 && (
          <div className="mt-5 grid grid-cols-2 gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setEntryMode('voice');
                setStep(2);
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                step === 2
                  ? 'bg-[#c85a32] text-white shadow-sm'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>🎤 बोलकर शुरू करें (Speak First)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEntryMode('photo');
                setStep(1);
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                step === 1
                  ? 'bg-white text-[#1b4332] shadow-sm'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>📷 फोटो लें (Take Photo)</span>
            </button>
          </div>
        )}

        {/* Step Progress Tracker */}
        {step < 6 && (
          <div className="mt-4 pt-3.5 border-t border-white/15 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#e9a83a] text-[#1b4332] font-extrabold flex items-center justify-center text-xs shadow-xs">
                {step === 1 ? '1' : step === 2 ? '1' : step === 3 ? '2' : '3'}
              </span>
              <span className="font-semibold text-white">
                {step === 2 && 'कदम 1: अपनी भाषा में बोलें (Sarvam Voice)'}
                {step === 1 && 'कदम 1: शिल्प की फोटो लें (Photo)'}
                {step === 3 && 'कदम 2: AI समझ रहा है (Sarvam 105B Engine)'}
                {step === 5 && 'कदम 3: आवाज़ में पुष्टि करें (Listen & Confirm)'}
              </span>
            </div>
            <span className="text-white/70 text-[11px] font-mono">
              {step <= 2 ? 'चरण 1/3' : step === 3 ? 'चरण 2/3' : 'चरण 3/3'}
            </span>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* STEP 2: VOICE FIRST WORKFLOW (PRIORITIZED OPTION)                     */}
      {/* ===================================================================== */}
      {step === 2 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-6 bento-shadow">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-lg sm:text-xl font-bold text-[#231f1e] flex items-center gap-2">
                <Mic className="w-5 h-5 text-[#c85a32]" />
                <span>बोलकर अपने शिल्प के बारे में बताएं</span>
              </h3>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1b4332] bg-[#1b4332]/10 px-2.5 py-0.5 rounded-full">
                शून्य टाइपिंग (Zero Typing)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              सामग्री, रंग और बनाने में लगे दिन अपनी भाषा में बोलें। सर्वम ASR और क्लाउडफ़्लेयर AI सब कुछ समझ लेंगे।
            </p>
          </div>

          {/* Voice Error Notice Banner */}
          {voiceError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-2 text-xs text-amber-900 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{voiceError}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    आप नीचे दिए गए टेक्स्ट बॉक्स में सीधे लिखकर भी आगे बढ़ सकते हैं।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="text-amber-700 hover:text-amber-900 font-bold text-base leading-none p-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Clarification Gating Notice (When greeting-only or missing craft details) */}
          {clarificationNotice && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
                    <span>⚠️ अतिरिक्त जानकारी आवश्यक है (Clarification Needed)</span>
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    {clarificationNotice.messageHi}
                  </p>
                  {clarificationNotice.messageEn && (
                    <p className="text-[11px] text-amber-700 italic">
                      {clarificationNotice.messageEn}
                    </p>
                  )}
                </div>
              </div>

              {clarificationNotice.transcript && (
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 text-xs text-[#231f1e]">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-0.5">
                    सुना गया वाक्य (Detected):
                  </span>
                  <span className="italic font-medium">"{clarificationNotice.transcript}"</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-3.5 py-1.5 bg-[#c85a32] text-white rounded-xl text-xs font-bold hover:bg-[#b84e28] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>दोबारा बोलें (Speak Again)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClarificationNotice(null)}
                  className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  बंद करें (Dismiss)
                </button>
              </div>
            </div>
          )}

          {/* 1-Tap Quick Bilingual Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6f5f58]">
              <span className="flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-[#1b4332]" />
                <span>अपनी बोलने की भाषा चुनें (Speaking Language):</span>
              </span>
              <span className="text-[11px] text-[#1b4332] font-bold">
                सक्रिय: {INDIC_LANGUAGES.find(l => l.code === selectedLanguage)?.label || selectedLanguage}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {INDIC_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setSelectedLanguage(l.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedLanguage === l.code
                      ? 'bg-[#1b4332] text-white shadow-xs'
                      : 'bg-[#faf7f2] text-[#6f5f58] hover:bg-[#e6ded3] border border-[#e6ded3]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* If a photo was already taken */}
          {photoUrl && (
            <div className="flex items-center gap-3 p-3 bg-[#faf7f2] rounded-2xl border border-[#e6ded3]">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-[#e6ded3] shrink-0">
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-[#1b4332] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  <span>फोटो संलग्न है</span>
                </span>
                <button
                  onClick={() => setStep(1)}
                  className="text-[11px] text-[#c85a32] hover:underline font-semibold block mt-0.5"
                >
                  दूसरी फोटो लें (Change Photo)
                </button>
              </div>
            </div>
          )}

          {/* Big Thumb Microphone Button */}
          <div className="p-6 bg-gradient-to-b from-[#faf7f2] to-[#f4ede4] rounded-3xl border border-[#e6ded3] text-center space-y-4 shadow-inner">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-28 h-28 rounded-full mx-auto flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 cursor-pointer relative ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse ring-8 ring-red-500/20'
                  : 'bg-[#c85a32] hover:bg-[#b84e28] text-white ring-8 ring-[#c85a32]/15'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-10 h-10" />
                  <span className="text-[11px] font-bold mt-1 font-mono">
                    00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-10 h-10" />
                  <span className="text-[10px] font-bold mt-1 tracking-wider uppercase">
                    बोलें
                  </span>
                </>
              )}
            </button>

            <div className="space-y-1">
              <span className="font-sans text-base sm:text-lg font-bold text-[#231f1e] block">
                {isRecording ? 'हम आपकी आवाज़ सुन रहे हैं...' : 'माइक दबाकर बोलना शुरू करें'}
              </span>
              <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
                {isRecording
                  ? 'जब आपका बोलना पूरा हो जाए, तो लाल बटन दोबारा दबाएं।'
                  : selectedLanguage === 'en-IN'
                  ? 'E.g.: "This is a handcrafted wooden toy, takes 3 days, made of teak wood."'
                  : 'उदा: "यह हाथ से बना लकड़ी का खिलौना है, 3 दिन में बना है, शीशम की लकड़ी है।"'}
              </p>
            </div>

            {/* Soundwave Animation */}
            {isRecording && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <div className="w-1.5 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-10 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-14 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <div className="w-1.5 h-8 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                <div className="w-1.5 h-12 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '220ms' }} />
                <div className="w-1.5 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '180ms' }} />
              </div>
            )}
          </div>

          {/* Interactive Spoken Transcript & Direct Input Box */}
          <div className="p-4 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#1b4332]">
              <span className="flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${isRecording ? 'text-red-500 animate-pulse' : 'text-[#2d6a4f]'}`} />
                <span>
                  {isRecording
                    ? 'लाइव ट्रांसक्रिप्ट सुनी जा रही है...'
                    : rawTranscript
                    ? 'सुना गया विवरण (Spoken Transcript - Edit if needed):'
                    : 'या यहाँ सीधे लिखकर विवरण दें (Or Type Directly):'}
                </span>
              </span>
              {rawTranscript.trim() && !isRecording && (
                <button
                  type="button"
                  onClick={() => processVoiceDescription(rawTranscript.trim())}
                  className="px-3 py-1 bg-[#1b4332] text-white rounded-lg hover:bg-[#133023] font-bold text-xs transition-colors shadow-xs flex items-center gap-1"
                >
                  <span>AI विश्लेषण करें →</span>
                </button>
              )}
            </div>

            <textarea
              value={rawTranscript}
              onChange={(e) => {
                setRawTranscript(e.target.value);
                rawTranscriptRef.current = e.target.value;
              }}
              placeholder={
                selectedLanguage === 'en-IN'
                  ? 'Speak into the mic or type your product details here (e.g., "Handmade brass bell, 2 days of work, cost 400 rupees")...'
                  : 'माइक दबाकर बोलें या यहाँ अपने उत्पाद का विवरण लिखें (उदा: "हाथ से बनी पीतल की घंटी, 2 दिन का काम, 400 रुपये लागत")...'
              }
              rows={3}
              className="w-full text-sm font-medium text-[#231f1e] bg-white border border-[#e6ded3] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 resize-none leading-relaxed"
            />

            {rawTranscript.trim() && (
              <div className="flex items-center justify-between text-[11px] text-[#6f5f58]">
                <span>💡 यदि कोई शब्द गलत सुनाई दिया हो, तो आप ऊपर सीधे सुधार सकते हैं।</span>
                <button
                  type="button"
                  onClick={() => {
                    setRawTranscript('');
                    rawTranscriptRef.current = '';
                  }}
                  className="text-red-600 hover:underline font-semibold"
                >
                  साफ करें (Clear)
                </button>
              </div>
            )}
          </div>

          {/* Quick 1-Tap Craft Voice Presets for Instant Evaluation */}
          <div className="space-y-2 pt-1 border-t border-[#e6ded3]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6f5f58] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#e9a83a]" />
                <span>वैकल्पिक डेमो उदाहरण (Try an Example):</span>
              </span>
              <span className="text-[11px] text-[#2d6a4f] font-semibold">
                डेमो के लिए एक टैप करें
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {VOICE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setRawTranscript(preset.text);
                    rawTranscriptRef.current = preset.text;
                    processVoiceDescription(preset.text, preset.image);
                  }}
                  className="p-2.5 text-left bg-[#faf7f2] hover:bg-[#e8f5e9] border border-[#e6ded3] hover:border-[#2d6a4f] rounded-2xl transition-all flex items-center gap-2.5 group cursor-pointer"
                >
                  <span className="text-xl shrink-0 p-1.5 bg-white rounded-xl border border-[#e6ded3] group-hover:scale-105 transition-transform">
                    {preset.icon}
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#231f1e] block truncate">
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-[#6f5f58] block truncate">
                      एआई विश्लेषण डेमो
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Link to Take Photo */}
          {!photoUrl && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-[#1b4332] hover:text-[#2d6a4f] inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>क्या आप पहले फोटो खींचना चाहते हैं? (Take Photo First)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 1: TAKE PRODUCT PHOTO                                            */}
      {/* ===================================================================== */}
      {step === 1 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-5 bento-shadow">
          <div className="space-y-1">
            <h3 className="font-sans text-lg sm:text-xl font-bold text-[#231f1e] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#1b4332]" />
              <span>अपने शिल्प की फोटो लें</span>
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              अच्छी रोशनी में अपने बनाए उत्पाद की एक साफ फोटो खींचें।
            </p>
          </div>

          {/* Live Camera Viewfinder */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-96 mx-auto flex items-center justify-center border border-[#e6ded3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-6 pointer-events-none border border-white/30 rounded-2xl">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#e9a83a]" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#e9a83a]" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#e9a83a]" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#e9a83a]" />
              </div>

              {/* Camera Controls */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="bg-black/60 text-white p-2.5 rounded-full hover:bg-black/80"
                  title="कैमरा पलटें"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="bg-black/60 text-white p-2.5 rounded-full hover:bg-black/80"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Shutter Button */}
              <div className="absolute bottom-5">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-18 h-18 rounded-full bg-white border-4 border-[#1b4332] shadow-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#1b4332]" />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons if camera is inactive */}
          {!isCameraActive && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={startCamera}
                className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-base py-4 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
              >
                <Camera className="w-5 h-5 text-[#e9a83a]" />
                <span>कैमरा खोलें और फोटो लें (Open Camera)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white hover:bg-[#faf7f2] text-[#231f1e] border-2 border-[#e6ded3] font-semibold text-sm py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#6f5f58]" />
                <span>गैलरी से चुनें (Upload from Gallery)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full bg-[#faf7f2] hover:bg-[#e6ded3] text-[#c85a32] border border-[#c85a32]/30 font-bold text-sm py-3 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>फोटो छोड़ें, सीधे बोलकर बताएं (Skip Photo, Speak First)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: AI PROCESSING ANIMATION                                       */}
      {/* ===================================================================== */}
      {step === 3 && isAiProcessing && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 sm:p-12 text-center space-y-6 bento-shadow">
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#1b4332]/10 border-4 border-[#1b4332] border-t-[#e9a83a] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-xl">
              ✨
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-[#1b4332]/10 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#e9a83a]" />
              <span>एआई शिल्प विश्लेषक (AI Craft Studio)</span>
            </div>
            <h3 className="font-sans text-xl sm:text-2xl font-bold text-[#231f1e]">
              AI आपके उत्पाद को तैयार कर रहा है...
            </h3>
            <p className="text-sm text-[#c85a32] font-semibold animate-pulse">
              {aiProcessingStage}
            </p>
            <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
              आपकी क्षेत्रीय आवाज़ से सामग्री, शिल्प प्रकार, निर्माण दिन और वैधानिक न्यूनतम मजदूरी (₹650/दिन) की गणना की जा रही है।
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* STEP 5: SIMPLE CONFIRMATION SCREEN (ZERO FORCED TYPING + TTS PLAYER)  */}
      {/* ===================================================================== */}
      {step === 5 && !extractedData && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 text-center space-y-4 bento-shadow">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-[#c85a32] flex items-center justify-center mx-auto">
            <Mic className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-sans text-xl font-bold text-[#231f1e]">
              कोई उत्पाद डेटा नहीं मिला (No Voice Data Found)
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58] max-w-md mx-auto">
              शिल्पकार जी, कृपया पहले अपने शिल्प के बारे में बोलकर बताएं या फोटो खींचें ताकि एआई आपका कैटलॉग तैयार कर सके।
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-3 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-sm rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>आवाज़ रिकॉर्ड करें (Record Voice)</span>
            </button>
          </div>
        </div>
      )}

      {step === 5 && extractedData && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-6 bento-shadow">
          {/* Top Banner & Extraction Confidence Badge */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-[#1b4332]/10 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b4332]" />
                <span>कैटलॉग सारांश (AI Catalog Summary)</span>
              </div>

              {/* Dynamic Extraction Confidence Badge */}
              {(() => {
                const conf = extractedData.confidenceScore ?? 0.92;
                const pct = Math.round(conf * 100);
                if (conf >= 0.85) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>उच्च सटीकता (High Confidence {pct}%)</span>
                    </span>
                  );
                } else if (conf >= 0.60) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>मध्यम सटीकता (Medium Confidence {pct}%) • विवरण जाँचें</span>
                    </span>
                  );
                } else {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-300 text-xs font-bold text-rose-800 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>जाँच आवश्यक (Review Needed {pct}%)</span>
                    </span>
                  );
                }
              })()}
            </div>

            <h3 className="font-sans text-xl sm:text-2xl font-extrabold text-[#231f1e]">
              क्या यह जानकारी सही है?
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              शिल्पकार जी, नीचे दी गई आवाज़ सुनकर या पढ़कर पुष्टि करें। यदि सब ठीक है, तो सीधे प्रकाशित करें।
            </p>
          </div>

          {/* Voice Summary TTS Player Card */}
          <div className="p-4 bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e9a83a] animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#e9a83a]">
                  शिल्पकार ऑडियो • आवाज़ में सुनें
                </span>
              </div>
              <span className="text-[10px] text-white/70 font-mono bg-white/10 px-2 py-0.5 rounded-md">
                Voice Verification
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={togglePlayTts}
                className="w-12 h-12 rounded-full bg-[#e9a83a] hover:bg-[#f3b54b] text-[#1b4332] flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-transform cursor-pointer"
                title="आवाज़ में सुनें"
              >
                {isPlayingTts ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
              </button>

              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold block truncate text-white">
                  {isPlayingTts ? 'बोल रहे हैं... (Playing Summary)' : '📢 विवरण आवाज़ में सुनें'}
                </span>
                <p className="text-[11px] text-[#e8f5e9] line-clamp-1">
                  {extractedData.voiceScriptHi}
                </p>
              </div>

              {/* Animated Soundbars */}
              {isPlayingTts && (
                <div className="flex items-end gap-1 h-6 shrink-0 pr-2">
                  <div className="w-1 bg-[#e9a83a] rounded-full animate-bounce h-3" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 bg-[#e9a83a] rounded-full animate-bounce h-6" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 bg-[#e9a83a] rounded-full animate-bounce h-4" style={{ animationDelay: '300ms' }} />
                  <div className="w-1 bg-[#e9a83a] rounded-full animate-bounce h-5" style={{ animationDelay: '75ms' }} />
                </div>
              )}
            </div>
          </div>

          {/* Product Image & Key Attributes Card */}
          <div className="bg-[#faf7f2] rounded-2xl border border-[#e6ded3] overflow-hidden">
            {photoUrl && (
              <div className="h-44 sm:h-52 bg-white relative overflow-hidden border-b border-[#e6ded3]">
                <img
                  src={photoUrl}
                  alt={extractedData.productNameHi}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#e9a83a]" />
                  <span>GI Heritage Craft</span>
                </div>
                {visionDetectedCraft && (
                  <div className="absolute bottom-3 left-3 bg-[#1b4332]/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/20">
                    <Sparkles className="w-3 h-3 text-[#e9a83a]" />
                    <span>एआई विज़न: {visionDetectedCraft}</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 sm:p-5 space-y-3">
              {/* Product Name Row */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">उत्पाद (Product):</span>
                  {extractedData.productNameHi || extractedData.productName ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ सुना गया
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      ✎ नाम आवश्यक
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-[#231f1e] text-right">
                  {extractedData.productNameHi || extractedData.productName || (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="text-amber-700 underline text-xs font-semibold cursor-pointer"
                    >
                      ✎ नाम दर्ज करें
                    </button>
                  )}
                </span>
              </div>

              {/* Craft Type Row */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">शिल्प (Craft):</span>
                  {extractedData.craftType ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ पहचाना गया
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      ✎ शिल्प आवश्यक
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-[#1b4332] text-right">
                  {extractedData.craftType || (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="text-amber-700 underline text-xs font-semibold cursor-pointer"
                    >
                      ✎ शिल्प चुनें
                    </button>
                  )}
                </span>
              </div>

              {/* Materials Row */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">सामग्री (Materials):</span>
                  {extractedData.factsDetected?.materials || (extractedData.materials && extractedData.materials.length > 0 && !extractedData.materials.includes('प्राकृतिक हस्तशिल्प सामग्री')) ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ सुना गया
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                    >
                      ✎ जाँच करें
                    </button>
                  )}
                </div>
                <span className="text-sm font-medium text-[#231f1e] text-right">
                  {extractedData.materials && extractedData.materials.length > 0 ? extractedData.materials.join(', ') : 'उल्लेख नहीं (अज्ञात)'}
                </span>
              </div>

              {/* Color Row */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#6f5f58] uppercase">रंग (Color):</span>
                  {extractedData.factsDetected?.color || (extractedData.color && extractedData.color.trim()) ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ सुना गया
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                    >
                      ✎ रंग जोड़ें
                    </button>
                  )}
                </div>
                <span className="text-sm font-medium text-[#231f1e] text-right">
                  {extractedData.color || 'उल्लेख नहीं (अज्ञात)'}
                </span>
              </div>

              {/* Production Days Stepper Row */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#6f5f58] uppercase block">
                      निर्माण समय (Making Time):
                    </span>
                    {extractedData.productionDays !== null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ {extractedData.factsDetected?.days ? 'सुना गया' : 'दर्ज किया'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        ✎ पुष्टि आवश्यक
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#2d6a4f]">
                    @ ₹650/दिन कुशल मजदूरी
                  </span>
                </div>
                {extractedData.productionDays !== null ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updatePricing(Math.max(1, (extractedData.productionDays || 1) - 1), extractedData.materialCost || 0)}
                      className="w-7 h-7 rounded-lg bg-white border border-[#e6ded3] hover:bg-[#e6ded3] flex items-center justify-center font-bold text-xs cursor-pointer"
                      title="1 दिन कम करें"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold text-[#231f1e] min-w-[50px] text-center">
                      {extractedData.productionDays} दिन
                    </span>
                    <button
                      type="button"
                      onClick={() => updatePricing((extractedData.productionDays || 0) + 1, extractedData.materialCost || 0)}
                      className="w-7 h-7 rounded-lg bg-white border border-[#e6ded3] hover:bg-[#e6ded3] flex items-center justify-center font-bold text-xs cursor-pointer"
                      title="1 दिन बढ़ाएं"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>दिन भरें</span>
                  </button>
                )}
              </div>

              {/* Material Cost Row */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#6f5f58] uppercase block">
                      सामग्री लागत (Material Cost):
                    </span>
                    {extractedData.materialCost !== null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ {extractedData.factsDetected?.cost ? 'सुना गया' : 'दर्ज किया'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        ✎ पुष्टि आवश्यक
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#6f5f58]">
                    कच्ची सामग्री का खर्च
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm font-bold text-[#231f1e]">
                  {extractedData.materialCost !== null ? (
                    <>
                      <span>₹{extractedData.materialCost.toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditMode(true)}
                        className="ml-1 text-[11px] text-[#c85a32] hover:underline font-semibold cursor-pointer"
                      >
                        बदलें
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span>लागत भरें</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transparent Price Calculation Box vs Confirmation Prompt */}
              {extractedData.productionDays !== null && extractedData.materialCost !== null && extractedData.recommendedPrice !== null ? (
                <div className="p-3.5 bg-white rounded-xl border border-[#e6ded3] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#6f5f58]">
                    <span>कच्ची सामग्री लागत (Materials):</span>
                    <span className="font-semibold text-[#231f1e]">₹{(extractedData.materialCost || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6f5f58]">
                    <span>कारीगरी मजदूरी ({extractedData.productionDays} दिन × ₹650):</span>
                    <span className="font-semibold text-[#231f1e]">₹{((extractedData.productionDays || 0) * 650).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6f5f58]">
                    <span>जीआई शिल्प विरासत प्रीमियम (25%):</span>
                    <span className="font-semibold text-[#2d6a4f]">
                      +₹{Math.max(0, (extractedData.recommendedPrice || 0) - ((extractedData.materialCost || 0) + (extractedData.productionDays || 0) * 650)).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#e6ded3] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#1b4332] uppercase block">
                        सुझाई गई उचित कीमत (Fair Price):
                      </span>
                      <span className="text-[11px] text-[#2d6a4f] font-semibold">
                        बिचौलियों से मुक्त सीधी बिक्री
                      </span>
                    </div>
                    <div className="font-sans text-2xl font-extrabold text-[#c85a32]">
                      ₹{(extractedData.recommendedPrice || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">
                        लागत व निर्माण समय की पुष्टि करें (Confirm Labor & Material Cost)
                      </h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        आपकी आवाज़ में निर्माण के दिन या सामग्री खर्च का उल्लेख नहीं मिला। सरकारी वैधानिक न्यूनतम मजदूरी (₹650/दिन) के आधार पर पारदर्शी निष्पक्ष मूल्य तय करने के लिए विवरण दर्ज करें:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-[#6f5f58] mb-1">
                        कच्ची सामग्री खर्च (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="उदा: 300"
                        value={extractedData.materialCost ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                          setExtractedData(prev => prev ? ({ ...prev, materialCost: val }) : null);
                        }}
                        className="w-full px-3 py-2 text-sm border border-amber-300 rounded-xl bg-white font-semibold text-[#231f1e]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#6f5f58] mb-1">
                        बनाने में लगे दिन
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="उदा: 2"
                        value={extractedData.productionDays ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Math.max(1, Number(e.target.value));
                          setExtractedData(prev => prev ? ({ ...prev, productionDays: val }) : null);
                        }}
                        className="w-full px-3 py-2 text-sm border border-amber-300 rounded-xl bg-white font-semibold text-[#231f1e]"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const days = extractedData.productionDays ?? 1;
                      const cost = extractedData.materialCost ?? 0;
                      updatePricing(days, cost);
                    }}
                    className="w-full py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>उचित न्यूनतम मूल्य की गणना करें (Calculate Fair Price)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Expandable Manual Edit Option */}
          {isEditMode && (
            <div className="p-4 bg-white rounded-2xl border border-[#e6ded3] space-y-4 animate-in fade-in">
              <h4 className="font-bold text-sm text-[#231f1e] flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-[#c85a32]" />
                <span>विवरण में बदलाव करें (Manual Edit)</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-[#6f5f58] mb-1">
                  उत्पाद का नाम (हिंदी)
                </label>
                <input
                  type="text"
                  value={extractedData.productNameHi}
                  onChange={(e) =>
                    setExtractedData({ ...extractedData, productNameHi: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-[#e6ded3] rounded-xl bg-[#faf7f2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6f5f58] mb-1">
                    रंग (Color)
                  </label>
                  <input
                    type="text"
                    value={extractedData.color || ''}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, color: e.target.value })
                    }
                    placeholder="उदा: लाल, सुनहरा, प्राकृतिक"
                    className="w-full px-3 py-2 text-sm border border-[#e6ded3] rounded-xl bg-[#faf7f2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6f5f58] mb-1">
                    सामग्री (Materials)
                  </label>
                  <input
                    type="text"
                    value={extractedData.materials.join(', ')}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        materials: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })
                    }
                    placeholder="उदा: पीतल, सिल्क, मिट्टी"
                    className="w-full px-3 py-2 text-sm border border-[#e6ded3] rounded-xl bg-[#faf7f2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6f5f58] mb-1">
                    कच्ची सामग्री लागत (₹)
                  </label>
                  <input
                    type="number"
                    value={extractedData.materialCost ?? ''}
                    onChange={(e) => {
                      const cost = e.target.value === '' ? 0 : Number(e.target.value);
                      updatePricing(extractedData.productionDays || 1, cost);
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#e6ded3] rounded-xl bg-[#faf7f2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6f5f58] mb-1">
                    निर्माण दिन
                  </label>
                  <input
                    type="number"
                    value={extractedData.productionDays ?? ''}
                    onChange={(e) => {
                      const days = e.target.value === '' ? 1 : Number(e.target.value);
                      updatePricing(days, extractedData.materialCost || 0);
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#e6ded3] rounded-xl bg-[#faf7f2]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Buttons: Zero forced typing */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={isPublishing}
              onClick={handleConfirmAndPublish}
              className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-bold text-base py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              {isPublishing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 text-[#e9a83a]" />
                  <span>✓ सब सही है, प्रकाशित करें (Looks Good, Publish Now)</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 bg-white hover:bg-[#faf7f2] text-[#6f5f58] border border-[#e6ded3] font-semibold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>दोबारा बोलें (Re-record)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className="flex-1 bg-white hover:bg-[#faf7f2] text-[#6f5f58] border border-[#e6ded3] font-semibold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditMode ? 'बदलाव बंद करें' : '✏ कुछ बदलना है? (Edit)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 6: CELEBRATION SUCCESS SCREEN                                    */}
      {/* ===================================================================== */}
      {step === 6 && extractedData && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 sm:p-10 text-center space-y-6 bento-shadow">
          <div className="w-20 h-20 rounded-full bg-[#e8f5e9] text-[#1b4332] flex items-center justify-center mx-auto text-4xl shadow-xs animate-bounce">
            🎉
          </div>

          <div className="space-y-2">
            <h3 className="font-sans text-2xl font-extrabold text-[#1b4332]">
              बधाई हो! आपका उत्पाद लाइव हो गया!
            </h3>
            <p className="text-sm text-[#231f1e] font-semibold">
              {extractedData.productNameHi} अब बाज़ार में खरीदारों को दिखाई देगा।
            </p>
            <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
              आपकी {extractedData.productionDays ?? 1} दिनों की मेहनत के लिए ₹{(extractedData.recommendedPrice || 0).toLocaleString('en-IN')} का उचित मूल्य सुरक्षित किया गया है।
            </p>
          </div>

          <div className="p-4 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] flex items-center justify-between max-w-sm mx-auto">
            <div className="text-left">
              <span className="text-[11px] font-bold text-[#6f5f58] uppercase block">लाइव मूल्य</span>
              <span className="text-lg font-bold text-[#c85a32]">
                ₹{(extractedData.recommendedPrice || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <span className="bg-[#1b4332] text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#e9a83a]" />
              <span>Live Listing</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href={`/craft/${publishedId}`}
              className="flex-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-sm py-3.5 px-6 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-[#e9a83a]" />
              <span>मार्केटप्लेस पर देखें (View on Marketplace)</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setPhotoUrl(null);
                setAudioUrl(null);
                setTtsAudioBase64(null);
                setRawTranscript('');
                setLivePreviewTranscript('');
                setExtractedData(null);
                setStep(2); // Start with voice again
              }}
              className="flex-1 bg-white hover:bg-[#faf7f2] text-[#231f1e] border border-[#e6ded3] font-semibold text-sm py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#c85a32]" />
              <span>नया उत्पाद जोड़ें (Add Another)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
