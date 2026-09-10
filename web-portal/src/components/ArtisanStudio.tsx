'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  Upload,
  Mic,
  MicOff,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  X,
  Plus,
  Minus,
  SwitchCamera,
  ChevronRight,
  Edit3,
  Eye,
  Check
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
  descriptionHi: string;
  descriptionEn: string;
}

export default function ArtisanStudio() {
  const { user, profile } = useAuth();

  // Current Step (1 to 5, 5 is confirmation, 6 is published success)
  const [step, setStep] = useState<number>(1);

  // Photo State
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rawTranscript, setRawTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // AI Processing State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState('');

  // AI Extracted Details
  const [extractedData, setExtractedData] = useState<ExtractedAttributes>({
    productName: 'Varanasi Pure Katan Silk Saree',
    productNameHi: 'पारंपरिक बनारसी कतान सिल्क साड़ी',
    craftType: 'Varanasi Silk',
    materials: ['Pure Katan Silk', 'Gold Zari Thread'],
    color: 'Deep Crimson & Gold',
    dimensions: '5.5 meters with blouse piece',
    productionDays: 10,
    materialCost: 2800,
    recommendedPrice: 6160,
    descriptionHi: 'शुद्ध कतान सिल्क पर सोने की ज़री का काम, हाथ से बुनी गई पारंपरिक बनारसी साड़ी। निर्माण में 10 दिन का समय लगा।',
    descriptionEn: 'Master handwoven Varanasi pure katan silk saree adorned with intricate gold zari brocade motifs.',
  });

  // Edit Mode on Step 5
  const [isEditMode, setIsEditMode] = useState(false);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState('prod-001');

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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

  // Voice Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(audioBlob));
        processVoiceDescription('शुद्ध कतान सिल्क की साड़ी, लाल और सुनहरा रंग, 10 दिन में बुनी गई, सोने की ज़री का काम।');
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      // Mock voice recording for devices where mic permission is restricted
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        processVoiceDescription('शुद्ध कतान सिल्क की साड़ी, लाल और सुनहरा रंग, 10 दिन में बुनी गई, सोने की ज़री का काम।');
      }, 2500);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // 5-Step AI Extraction Simulation
  const processVoiceDescription = (spokenText: string) => {
    setRawTranscript(spokenText);
    setStep(3);
    setIsAiProcessing(true);

    setAiProcessingStage('फोटो और आवाज़ को समझा जा रहा है...');

    setTimeout(() => {
      setAiProcessingStage('विशेषताएं व सामग्री की पहचान की जा रही है...');
    }, 900);

    setTimeout(() => {
      setAiProcessingStage('न्यायसंगत मजदूरी के आधार पर मूल्य तय हो रहा है...');
    }, 1800);

    setTimeout(() => {
      setIsAiProcessing(false);
      setStep(5); // Advance directly to Confirmation Screen
    }, 2600);
  };

  // Publish to Database
  const handleConfirmAndPublish = async () => {
    setIsPublishing(true);
    try {
      if (user) {
        const { data, error } = await supabase
          .from('craft_products')
          .insert({
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

        if (!error && data) {
          setPublishedId(data.id);
        }
      }
    } catch (err) {
      console.warn('Database sync note:', err);
    } finally {
      setIsPublishing(false);
      setStep(6); // Success Celebration Screen
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Studio Header Card */}
      <div className="bg-[#1b4332] text-white rounded-3xl p-6 sm:p-7 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e9a83a] uppercase tracking-wider">
              <Camera className="w-3.5 h-3.5" />
              <span>कारीगर स्टूडियो • Quick Studio</span>
            </span>
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
              बोलें. फोटो लें. बेचें.
            </h2>
            <p className="text-xs sm:text-sm text-[#e8f5e9] font-light">
              बिना किसी झंझट के अपने हुनर को सीधे बाज़ार से जोड़ें।
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#c85a32] text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-xs">
            🎨
          </div>
        </div>

        {/* Step Progress Tracker */}
        {step < 6 && (
          <div className="mt-5 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#c85a32] text-white font-bold flex items-center justify-center text-xs">
                {step > 4 ? 3 : step}
              </span>
              <span className="font-semibold text-white">
                {step === 1 && 'कदम 1: फोटो लें (Take Photo)'}
                {step === 2 && 'कदम 2: बोलकर बताएं (Voice Description)'}
                {step === 3 && 'कदम 3: AI समझ रहा है (AI Processing)'}
                {step === 5 && 'अंतिम कदम: पुष्टि करें (Confirmation)'}
              </span>
            </div>
            <span className="text-white/70 text-[11px]">
              {step === 1 && '1/3'}
              {step === 2 && '2/3'}
              {step >= 3 && '3/3'}
            </span>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* STEP 1: TAKE PRODUCT PHOTO                                            */}
      {/* ===================================================================== */}
      {step === 1 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-5 bento-shadow">
          <div className="space-y-1">
            <h3 className="font-sans text-lg sm:text-xl font-bold text-[#231f1e]">
              1. अपने शिल्प की फोटो लें
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
                  className="w-18 h-18 rounded-full bg-white border-4 border-[#1b4332] shadow-xl flex items-center justify-center active:scale-95 transition-transform"
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
                className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-base py-4 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2.5 active:scale-98"
              >
                <Camera className="w-5 h-5 text-[#e9a83a]" />
                <span>कैमरा खोलें और फोटो लें (Open Camera)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white hover:bg-[#faf7f2] text-[#231f1e] border-2 border-[#e6ded3] font-semibold text-sm py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-[#6f5f58]" />
                <span>फोन की गैलरी से चुनें (Upload from Gallery)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: RECORD VOICE DESCRIPTION                                      */}
      {/* ===================================================================== */}
      {step === 2 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-6 bento-shadow">
          <div className="space-y-1">
            <h3 className="font-sans text-lg sm:text-xl font-bold text-[#231f1e]">
              2. बोलकर अपने उत्पाद के बारे में बताएं
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              सामग्री, रंग और बनाने में लगे दिन अपनी भाषा (हिंदी) में बोलें।
            </p>
          </div>

          {/* Photo Preview Thumbnail */}
          {photoUrl && (
            <div className="flex items-center gap-3 p-3 bg-[#faf7f2] rounded-2xl border border-[#e6ded3]">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-[#e6ded3] shrink-0">
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-[#1b4332] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  <span>फोटो सफलतापूर्वक ली गई</span>
                </span>
                <button
                  onClick={() => setStep(1)}
                  className="text-[11px] text-[#c85a32] hover:underline font-semibold block mt-0.5"
                >
                  दूसरी फोटो लें (Retake)
                </button>
              </div>
            </div>
          )}

          {/* Big Thumb Microphone Button */}
          <div className="p-6 bg-[#faf7f2] rounded-3xl border border-[#e6ded3] text-center space-y-4">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[#c85a32] hover:bg-[#b84e28] text-white'
              }`}
            >
              {isRecording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>

            <div className="space-y-1">
              <span className="font-sans text-base font-bold text-[#231f1e] block">
                {isRecording ? 'सुन रहे हैं... (Listening...)' : 'माइक दबाकर बोलना शुरू करें'}
              </span>
              <p className="text-xs text-[#6f5f58] max-w-xs mx-auto">
                {isRecording
                  ? 'जब बोलना पूरा हो जाए, तो बटन दोबारा दबाएं।'
                  : 'उदा: "यह शुद्ध कतान सिल्क साड़ी है, 10 दिन में बुनी गई है।"'}
              </p>
            </div>

            {/* Soundwave Animation */}
            {isRecording && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <div className="w-1.5 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-10 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-7 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <div className="w-1.5 h-11 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                <div className="w-1.5 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: AI PROCESSING ANIMATION                                       */}
      {/* ===================================================================== */}
      {step === 3 && isAiProcessing && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-8 sm:p-12 text-center space-y-5 bento-shadow">
          <div className="w-16 h-16 rounded-full bg-[#1b4332]/10 border-4 border-[#1b4332] border-t-transparent animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="font-sans text-xl font-bold text-[#231f1e]">
              AI आपके उत्पाद को समझ रहा है...
            </h3>
            <p className="text-sm text-[#c85a32] font-semibold animate-pulse">
              {aiProcessingStage}
            </p>
            <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
              हम आपकी आवाज़ से सामग्री, शिल्प और उचित मजदूरी का हिसाब लगा रहे हैं।
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: SIMPLE CONFIRMATION SCREEN (ZERO FORCED TYPING)               */}
      {/* ===================================================================== */}
      {step === 5 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-5 sm:p-7 space-y-6 bento-shadow">
          {/* Top Banner */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1b4332] bg-[#1b4332]/10 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1b4332]" />
              <span>कैटलॉग विवरण • Extracted Summary</span>
            </div>
            <h3 className="font-sans text-xl sm:text-2xl font-extrabold text-[#231f1e]">
              क्या यह जानकारी सही है?
            </h3>
            <p className="text-xs sm:text-sm text-[#6f5f58]">
              कृपया नीचे दी गई जानकारी जांचें। यदि सब सही है, तो &quot;सब सही है&quot; बटन दबाएं।
            </p>
          </div>

          {/* Confirmation Attributes Card */}
          <div className="bg-[#faf7f2] rounded-2xl border border-[#e6ded3] p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#e6ded3] pb-3">
              <span className="text-xs font-bold text-[#6f5f58] uppercase">उत्पाद (Product):</span>
              <span className="text-sm font-bold text-[#231f1e] text-right">
                {extractedData.productNameHi}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#e6ded3] pb-3">
              <span className="text-xs font-bold text-[#6f5f58] uppercase">शिल्प (Craft):</span>
              <span className="text-sm font-semibold text-[#1b4332] text-right">
                {extractedData.craftType}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#e6ded3] pb-3">
              <span className="text-xs font-bold text-[#6f5f58] uppercase">सामग्री (Material):</span>
              <span className="text-sm font-medium text-[#231f1e] text-right">
                {extractedData.materials.join(', ')}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#e6ded3] pb-3">
              <span className="text-xs font-bold text-[#6f5f58] uppercase">रंग (Color):</span>
              <span className="text-sm font-medium text-[#231f1e] text-right">
                {extractedData.color}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#e6ded3] pb-3">
              <span className="text-xs font-bold text-[#6f5f58] uppercase">निर्माण समय (Making Time):</span>
              <span className="text-sm font-medium text-[#231f1e] text-right">
                {extractedData.productionDays} दिन
              </span>
            </div>

            {/* AI Recommended Price Box */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#1b4332] uppercase block">
                  सुझाई गई उचित कीमत (Fair Price):
                </span>
                <span className="text-[11px] text-[#2d6a4f] font-medium">
                  ₹650/दिन न्यूनतम मजदूरी सुरक्षित
                </span>
              </div>
              <div className="font-sans text-2xl font-extrabold text-[#c85a32]">
                ₹{extractedData.recommendedPrice.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Expandable Manual Edit Option (Progressive Disclosure) */}
          {isEditMode && (
            <div className="p-4 bg-white rounded-2xl border border-[#e6ded3] space-y-4">
              <h4 className="font-bold text-sm text-[#231f1e] flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-[#c85a32]" />
                <span>विवरण में बदलाव करें (Optional Edit)</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-[#6f5f58] mb-1">
                  उत्पाद का नाम
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
                      const cost = Number(e.target.value);
                      const wage = extractedData.productionDays * 650;
                      const fair = Math.round(cost + wage * 1.2);
                      setExtractedData({
                        ...extractedData,
                        materialCost: cost,
                        recommendedPrice: fair,
                      });
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
                      const days = Number(e.target.value);
                      const wage = days * 650;
                      const fair = Math.round(extractedData.materialCost + wage * 1.2);
                      setExtractedData({
                        ...extractedData,
                        productionDays: days,
                        recommendedPrice: fair,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-[#e6ded3] rounded-xl bg-[#faf7f2]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              disabled={isPublishing}
              onClick={handleConfirmAndPublish}
              className="w-full bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-bold text-base py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
            >
              {isPublishing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 text-[#e9a83a]" />
                  <span>✓ सब सही है, प्रकाशित करें (Looks Correct, Publish)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className="w-full bg-white hover:bg-[#faf7f2] text-[#6f5f58] border border-[#e6ded3] font-semibold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'बदलाव बंद करें' : '✏ कुछ बदलना है? (Edit)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 6: CELEBRATION SUCCESS SCREEN                                    */}
      {/* ===================================================================== */}
      {step === 6 && (
        <div className="bg-white rounded-3xl border border-[#e6ded3] p-6 sm:p-10 text-center space-y-6 bento-shadow">
          <div className="w-18 h-18 rounded-full bg-[#e8f5e9] text-[#1b4332] flex items-center justify-center mx-auto text-3xl shadow-xs">
            🎉
          </div>

          <div className="space-y-2">
            <h3 className="font-sans text-2xl font-extrabold text-[#1b4332]">
              बधाई हो! आपका उत्पाद तैयार है!
            </h3>
            <p className="text-sm text-[#231f1e] font-semibold">
              आपका उत्पाद अब खरीदारों को दिखाई देगा।
            </p>
            <p className="text-xs text-[#6f5f58] max-w-sm mx-auto">
              शिल्पकार राधेश्याम जी, आपका नया उत्पाद बाज़ार में सफलतापूर्वक लाइव हो चुका है।
            </p>
          </div>

          <div className="p-4 bg-[#faf7f2] rounded-2xl border border-[#e6ded3] flex items-center justify-between max-w-sm mx-auto">
            <div className="text-left">
              <span className="text-[11px] font-bold text-[#6f5f58] uppercase block">लाइव मूल्य</span>
              <span className="text-lg font-bold text-[#c85a32]">
                ₹{extractedData.recommendedPrice.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="bg-[#1b4332] text-white text-xs font-bold px-3 py-1 rounded-full">
              Live Listing
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href={`/craft/${publishedId}`}
              className="flex-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-sm py-3.5 px-6 rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-[#e9a83a]" />
              <span>उत्पाद देखें (View on Marketplace)</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setPhotoUrl(null);
                setAudioUrl(null);
                setStep(1);
              }}
              className="flex-1 bg-white hover:bg-[#faf7f2] text-[#231f1e] border border-[#e6ded3] font-semibold text-sm py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#c85a32]" />
              <span>एक और उत्पाद जोड़ें (Add Another)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
