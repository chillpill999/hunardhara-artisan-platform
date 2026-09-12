'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  transcribeAudio,
  extractCraftFromVoice,
  synthesizeSpeech,
  saveUploadedProduct
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
  Palette
} from 'lucide-react';

interface ExtractedAttributes {
  productName: string;
  productNameHi: string;
  craftType: string;
  materials: string[];
  color: string;
  dimensions: string;
  productionDays: number;
  materialCost: number;
  recommendedPrice: number;
  wageFloor: number;
  descriptionHi: string;
  descriptionEn: string;
  voiceScriptHi: string;
}

const INDIC_LANGUAGES = [
  { code: 'hi-IN', label: 'हिंदी (Hindi)' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)' },
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

export default function ArtisanStudio() {
  const { user } = useAuth();

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

  // AI Extracted Details (Defaults)
  const [extractedData, setExtractedData] = useState<ExtractedAttributes>({
    productName: 'Varanasi Pure Katan Silk Saree',
    productNameHi: 'पारंपरिक बनारसी कतान सिल्क साड़ी',
    craftType: 'Varanasi Silk',
    materials: ['Pure Katan Silk', 'Gold Zari Thread'],
    color: 'Deep Crimson & Gold',
    dimensions: '5.5 meters with blouse piece',
    productionDays: 10,
    materialCost: 2800,
    wageFloor: 9300,
    recommendedPrice: 11650,
    descriptionHi: 'शुद्ध कतान सिल्क पर सोने की ज़री का काम, हाथ से बुनी गई पारंपरिक बनारसी साड़ी। निर्माण में 10 दिन का समय लगा।',
    descriptionEn: 'Master handwoven Varanasi pure katan silk saree adorned with intricate gold zari brocade motifs.',
    voiceScriptHi: 'बधाई हो! आपका उत्पाद पारंपरिक बनारसी कतान सिल्क साड़ी तैयार है। 10 दिनों की मेहनत और शुद्ध सामग्री को जोड़कर इसका उचित बिक्री मूल्य ₹11,650 तय किया गया है।'
  });

  // Edit Mode on Step 5
  const [isEditMode, setIsEditMode] = useState(false);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState('prod-001');

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  // Recalculate price when days or material changes
  const updatePricing = (newDays: number, newCost: number) => {
    const days = Math.max(1, newDays);
    const cost = Math.max(0, newCost);
    const wageFloor = cost + (days * 650);
    const fairPrice = Math.round((wageFloor * 1.25) / 50) * 50;
    setExtractedData(prev => ({
      ...prev,
      productionDays: days,
      materialCost: cost,
      wageFloor,
      recommendedPrice: fairPrice,
      voiceScriptHi: `बधाई हो! आपका उत्पाद ${prev.productNameHi} तैयार है। ${days} दिनों के परिश्रम और सामग्री को जोड़कर इसका उचित बिक्री मूल्य ₹${fairPrice.toLocaleString('en-IN')} तय किया गया है।`
    }));
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
        setPhotoUrl(event.target?.result as string);
        stopCamera();
        setStep(2); // Advance to voice step
      };
      reader.readAsDataURL(file);
    }
  };

  // Voice Recording Handlers with Real-Time Web Speech and Sarvam Saarika
  const startRecording = async () => {
    try {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);

      // 1. Client-Side Live Speech Recognition for instant feedback
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
              if (live.trim()) {
                setRawTranscript(live.trim());
              }
            };
            recognition.onerror = () => {};
            recognition.start();
            recognitionRef.current = recognition;
          } catch (e) {
            console.log('Web speech init note:', e);
          }
        }
      }

      // 2. High-Quality MediaRecorder for Sarvam Saarika upload
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(audioBlob));

        // Call Sarvam Saarika ASR (via Cloudflare Edge or Render Backend)
        let finalTranscript = rawTranscript;
        try {
          const asrResult = await transcribeAudio(audioBlob, selectedLanguage);
          if (asrResult.success && asrResult.transcript) {
            finalTranscript = asrResult.transcript;
            setRawTranscript(finalTranscript);
          }
        } catch (err) {
          console.warn('Sarvam ASR note:', err);
        }

        if (!finalTranscript.trim()) {
          finalTranscript = 'शुद्ध कतान सिल्क की साड़ी, लाल और सुनहरा रंग, 10 दिन में बुनी गई, सोने की ज़री का काम।';
          setRawTranscript(finalTranscript);
        }

        await processVoiceDescription(finalTranscript);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      // Fallback if mic permission is restricted
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        const mockText = 'शुद्ध कतान सिल्क की साड़ी, लाल और सुनहरा रंग, 10 दिन में बुनी गई, सोने की ज़री का काम।';
        setRawTranscript(mockText);
        processVoiceDescription(mockText);
      }, 2500);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Process Spoken Description with Sarvam 105B LLM & Bulbul TTS
  const processVoiceDescription = async (spokenText: string, presetImage?: string) => {
    setRawTranscript(spokenText);
    setStep(3);
    setIsAiProcessing(true);
    setAiProcessingStage('सर्वम सारिका ASR: आवाज़ का सटीक विश्लेषण...');

    try {
      setTimeout(() => {
        setAiProcessingStage('सर्वम 105B LLM: सामग्री व उत्पादन दिवस निष्कर्षण...');
      }, 700);

      setTimeout(() => {
        setAiProcessingStage('सांविधिक मजदूरी (₹650/दिन) एवं न्यायसंगत मूल्य निर्धारण...');
      }, 1400);

      // Extract attributes using Sarvam 105B or Indic heuristic
      const craftData = await extractCraftFromVoice(spokenText, selectedLanguage);

      // Set photo if artisan started with voice first
      if (!photoUrl) {
        if (presetImage) {
          setPhotoUrl(presetImage);
        } else if (craftData.craft_type.includes('Silk') || craftData.craft_type.includes('सिल्क')) {
          setPhotoUrl('/static/studio/varanasi_silk.jpg');
        } else if (craftData.craft_type.includes('Dhokra') || craftData.craft_type.includes('ढोकरा')) {
          setPhotoUrl('/static/studio/bastar_dhokra.jpg');
        } else if (craftData.craft_type.includes('Pottery') || craftData.craft_type.includes('खुर्जा')) {
          setPhotoUrl('/static/studio/khurja_pottery.jpg');
        } else if (craftData.craft_type.includes('Madhubani') || craftData.craft_type.includes('मधुबनी')) {
          setPhotoUrl('/static/studio/madhubani_art.jpg');
        } else {
          setPhotoUrl('/static/studio/channapatna_toy.jpg');
        }
      }

      const days = craftData.production_days || 7;
      const cost = craftData.material_cost || 1500;
      const floor = craftData.wage_floor || (cost + days * 650);
      const price = craftData.recommended_price || (Math.round((floor * 1.25) / 50) * 50);
      const voiceScript = craftData.voice_script_hi || `बधाई हो! आपका उत्पाद ${craftData.product_name_hi} तैयार है। ${days} दिनों के परिश्रम और सामग्री को जोड़कर इसका उचित बिक्री मूल्य ₹${price.toLocaleString('en-IN')} तय किया गया है।`;

      setExtractedData({
        productName: craftData.product_name_en || 'Handcrafted Artisan Craft',
        productNameHi: craftData.product_name_hi || 'पारंपरिक हस्तशिल्प उत्पाद',
        craftType: craftData.craft_type || 'Varanasi Silk',
        materials: craftData.materials || ['शुद्ध कच्चा माल'],
        color: craftData.color || 'पारंपरिक रंग',
        dimensions: craftData.dimensions || 'मानक आकार',
        productionDays: days,
        materialCost: cost,
        wageFloor: floor,
        recommendedPrice: price,
        descriptionHi: craftData.description_hi || spokenText,
        descriptionEn: craftData.description_en || 'Authentic handcrafted heritage item.',
        voiceScriptHi: voiceScript
      });

      // Pre-synthesize Sarvam Bulbul TTS Audio for Step 5
      setTimeout(() => {
        setAiProcessingStage('सर्वम बुलबुल TTS: आवाज़ में पुष्टिकरण तैयार किया जा रहा है...');
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
      // Fallback: Browser Web Speech synthesis if Sarvam offline
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (isPlayingTts) {
          window.speechSynthesis.cancel();
          setIsPlayingTts(false);
        } else {
          const utterance = new SpeechSynthesisUtterance(extractedData.voiceScriptHi || extractedData.descriptionHi);
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
    setIsPublishing(true);
    try {
      const newId = `prod-live-${Date.now().toString().slice(-6)}`;

      // Resolve final studio image
      let finalStudioImage = photoUrl;
      if (!finalStudioImage) {
        const ct = (extractedData.craftType || '').toLowerCase();
        if (ct.includes('silk') || ct.includes('सिल्क')) {
          finalStudioImage = '/static/studio/varanasi_silk.jpg';
        } else if (ct.includes('dhokra') || ct.includes('ढोकरा')) {
          finalStudioImage = '/static/studio/bastar_dhokra.jpg';
        } else if (ct.includes('pottery') || ct.includes('खुर्जा') || ct.includes('मिट्टी')) {
          finalStudioImage = '/static/studio/khurja_pottery.jpg';
        } else if (ct.includes('madhubani') || ct.includes('मधुबनी')) {
          finalStudioImage = '/static/studio/madhubani_art.jpg';
        } else {
          finalStudioImage = '/static/studio/channapatna_toy.jpg';
        }
      }

      const newProduct: Product = {
        id: newId,
        artisan_id: user?.id || 'art-current-user',
        cluster_id: extractedData.craftType.toLowerCase().includes('silk')
          ? 'cluster-varanasi-silk'
          : extractedData.craftType.toLowerCase().includes('dhokra')
          ? 'cluster-bastar-dhokra'
          : extractedData.craftType.toLowerCase().includes('pottery')
          ? 'cluster-khurja-pottery'
          : extractedData.craftType.toLowerCase().includes('madhubani')
          ? 'cluster-madhubani-painting'
          : 'cluster-channapatna-toys',
        title_en: extractedData.productName,
        title_hi: extractedData.productNameHi,
        craft_type: extractedData.craftType,
        materials: extractedData.materials,
        dimensions: extractedData.dimensions || '5.5m x 1.2m',
        production_time_days: extractedData.productionDays,
        technique: 'हस्तशिल्प कारीगरी (Artisanal Craftwork)',
        color: extractedData.color,
        description_en: extractedData.descriptionEn,
        description_hi: extractedData.descriptionHi,
        seo_tags: [extractedData.craftType, 'Handmade', 'GI Craft', 'Hunardhara Live'],
        studio_image_url: finalStudioImage,
        floor_price: extractedData.wageFloor,
        recommended_retail_d2c: extractedData.recommendedPrice,
        wholesale_b2b: Math.round(extractedData.recommendedPrice * 0.75),
        available_stock: 5,
        is_published: true,
        created_at: new Date().toISOString(),
        artisan_name: user?.user_metadata?.full_name || 'राधेश्याम अंसारी (Master Artisan)',
        artisan_state: user?.user_metadata?.state || 'उत्तर प्रदेश',
        gi_certified: true,
      };

      // 1. Immediately persist locally (Guaranteed zero-latency live presentation upload)
      saveUploadedProduct(newProduct);
      setPublishedId(newId);

      // 2. Sync to Supabase if session exists
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
              price: extractedData.recommendedPrice,
              cost_materials: extractedData.materialCost,
              production_time_days: extractedData.productionDays,
              description_en: extractedData.descriptionEn,
              description_hi: extractedData.descriptionHi,
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
              सामग्री, रंग और बनाने में लगे दिन अपनी क्षेत्रीय भाषा में बोलें। सर्वम एआई सब कुछ समझ लेगा।
            </p>
          </div>

          {/* Indic Language Selector Chips */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6f5f58]">
              <Languages className="w-3.5 h-3.5 text-[#1b4332]" />
              <span>अपनी भाषा चुनें (Select Indic Language):</span>
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
                  : 'उदा: "यह शुद्ध कतान सिल्क की बनारसी साड़ी है, लाल और सुनहरा रंग, 10 दिन में बुनी गई है।"'}
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

          {/* Real-time Spoken Transcript Box */}
          {rawTranscript && (
            <div className="p-4 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#1b4332]">
                <span className="flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  <span>लाइव ट्रांसक्रिप्ट (Sarvam Saarika Live):</span>
                </span>
                <button
                  type="button"
                  onClick={() => processVoiceDescription(rawTranscript)}
                  className="text-[#c85a32] hover:underline font-bold"
                >
                  आगे बढ़ें →
                </button>
              </div>
              <p className="text-sm font-medium text-[#231f1e] leading-relaxed">
                &ldquo;{rawTranscript}&rdquo;
              </p>
            </div>
          )}

          {/* Quick 1-Tap Craft Voice Presets for Instant Evaluation */}
          <div className="space-y-2 pt-1 border-t border-[#e6ded3]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6f5f58] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#e9a83a]" />
                <span>त्वरित परीक्षण विकल्प (1-Tap Voice Presets):</span>
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
                      सर्वम AI ऑटो प्रोसेस
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
              <span>सर्वम एआई इंडिक सूट (Sarvam AI Suite)</span>
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
      {/* STEP 5: SIMPLE CONFIRMATION SCREEN (ZERO FORCED TYPING + TTS PLAYER)  */}
      {/* ===================================================================== */}
      {step === 5 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-6 bento-shadow">
          {/* Top Banner */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-[#1b4332]/10 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1b4332]" />
              <span>कैटलॉग सारांश • Sarvam AI Extracted</span>
            </div>
            <h3 className="font-sans text-xl sm:text-2xl font-extrabold text-[#231f1e]">
              क्या यह जानकारी सही है?
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              शिल्पकार जी, नीचे दी गई आवाज़ सुनकर या पढ़कर पुष्टि करें। यदि सब ठीक है, तो सीधे प्रकाशित करें।
            </p>
          </div>

          {/* Sarvam AI Bulbul TTS Audio Player Card (Listen in Voice) */}
          <div className="p-4 bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e9a83a] animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#e9a83a]">
                  सर्वम बुलबुल TTS • आवाज़ में सुनें
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
              </div>
            )}

            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <span className="text-xs font-bold text-[#6f5f58] uppercase">उत्पाद (Product):</span>
                <span className="text-sm font-bold text-[#231f1e] text-right">
                  {extractedData.productNameHi}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <span className="text-xs font-bold text-[#6f5f58] uppercase">शिल्प (Craft):</span>
                <span className="text-sm font-semibold text-[#1b4332] text-right">
                  {extractedData.craftType}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <span className="text-xs font-bold text-[#6f5f58] uppercase">सामग्री (Materials):</span>
                <span className="text-sm font-medium text-[#231f1e] text-right">
                  {extractedData.materials.join(', ')}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <span className="text-xs font-bold text-[#6f5f58] uppercase">रंग (Color):</span>
                <span className="text-sm font-medium text-[#231f1e] text-right">
                  {extractedData.color}
                </span>
              </div>

              {/* Production Days Stepper (Zero typing adjustment) */}
              <div className="flex items-center justify-between border-b border-[#e6ded3] pb-2.5">
                <div>
                  <span className="text-xs font-bold text-[#6f5f58] uppercase block">
                    निर्माण समय (Making Time):
                  </span>
                  <span className="text-[10px] text-[#2d6a4f]">
                    @ ₹650/दिन कुशल मजदूरी
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updatePricing(extractedData.productionDays - 1, extractedData.materialCost)}
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
                    onClick={() => updatePricing(extractedData.productionDays + 1, extractedData.materialCost)}
                    className="w-7 h-7 rounded-lg bg-white border border-[#e6ded3] hover:bg-[#e6ded3] flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="1 दिन बढ़ाएं"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Transparent Price Calculation Box */}
              <div className="p-3.5 bg-white rounded-xl border border-[#e6ded3] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#6f5f58]">
                  <span>कच्ची सामग्री लागत (Materials):</span>
                  <span className="font-semibold text-[#231f1e]">₹{extractedData.materialCost.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#6f5f58]">
                  <span>कारीगरी मजदूरी ({extractedData.productionDays} दिन × ₹650):</span>
                  <span className="font-semibold text-[#231f1e]">₹{(extractedData.productionDays * 650).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#6f5f58]">
                  <span>जीआई शिल्प विरासत प्रीमियम (25%):</span>
                  <span className="font-semibold text-[#2d6a4f]">
                    +₹{(extractedData.recommendedPrice - (extractedData.materialCost + extractedData.productionDays * 650)).toLocaleString('en-IN')}
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
                    ₹{extractedData.recommendedPrice.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Expandable Manual Edit Option */}
          {isEditMode && (
            <div className="p-4 bg-white rounded-2xl border border-[#e6ded3] space-y-4">
              <h4 className="font-bold text-sm text-[#231f1e] flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-[#c85a32]" />
                <span>विवरण में बदलाव करें (Optional Manual Edit)</span>
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
                    कच्ची सामग्री लागत (₹)
                  </label>
                  <input
                    type="number"
                    value={extractedData.materialCost}
                    onChange={(e) => {
                      updatePricing(extractedData.productionDays, Number(e.target.value));
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
                    value={extractedData.productionDays}
                    onChange={(e) => {
                      updatePricing(Number(e.target.value), extractedData.materialCost);
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
      {step === 6 && (
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
              आपकी {extractedData.productionDays} दिनों की मेहनत के लिए ₹{extractedData.recommendedPrice.toLocaleString('en-IN')} का उचित मूल्य सुरक्षित किया गया है।
            </p>
          </div>

          <div className="p-4 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] flex items-center justify-between max-w-sm mx-auto">
            <div className="text-left">
              <span className="text-[11px] font-bold text-[#6f5f58] uppercase block">लाइव मूल्य</span>
              <span className="text-lg font-bold text-[#c85a32]">
                ₹{extractedData.recommendedPrice.toLocaleString('en-IN')}
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
