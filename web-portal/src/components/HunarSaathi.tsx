'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  X,
  Bot,
  User,
  ChevronRight,
  HelpCircle,
  ShoppingBag,
  TrendingUp,
  PlusCircle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { synthesizeSpeech, chatWithHunarSaathi } from '../lib/api';

interface HunarSaathiProps {
  onNavigateTab?: (tab: 'studio' | 'products' | 'orders' | 'revenue') => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  action?: {
    label: string;
    tab: 'studio' | 'products' | 'orders' | 'revenue';
  };
  audioBase64?: string;
}

export default function HunarSaathi({ onNavigateTab, isOpen, onClose }: HunarSaathiProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'नमस्ते! मैं आपका हुनर साथी हूँ। मैं आपके उत्पाद जोड़ने, आर्डर देखने या सही मूल्य तय करने में मदद कर सकता हूँ। आप बोलकर या लिखकर पूछ सकते हैं।',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const quickQuestions = [
    { label: '🎤 नया उत्पाद जोड़ना है', query: 'मुझे नया उत्पाद जोड़ना है' },
    { label: '📦 मेरे कितने ऑर्डर हैं?', query: 'मेरे कितने ऑर्डर हैं?' },
    { label: '💰 सही कीमत क्या रखूं?', query: 'इस उत्पाद की कीमत क्या रखूं?' },
    { label: '📈 मेरी बिक्री कैसी चल रही है?', query: 'मेरी बिक्री कैसी चल रही है?' },
  ];

  const speakBrowserFallback = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  const playVoiceResponse = async (text: string) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);

    try {
      const res = await synthesizeSpeech(text, 'hi-IN', 'shubh');
      if (res.success && res.audio_base64) {
        const audio = new Audio(`data:audio/wav;base64,${res.audio_base64}`);
        currentAudioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setIsSpeaking(false);
          speakBrowserFallback(text);
        };
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('Sarvam audio playback error:', err);
    }

    speakBrowserFallback(text);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    let replyText = '';
    let replyAction: Message['action'] = undefined;
    let isError = false;

    try {
      // Query Sarvam 105B Indic LLM with bounded 18s client timeout
      const res = await chatWithHunarSaathi(text, 'Artisan Workspace - Dashboard');
      if (res.success && res.reply) {
        replyText = res.reply;
      } else {
        isError = true;
        if (res.code === 'AI_CLIENT_TIMEOUT' || res.code === 'AI_PROVIDER_TIMEOUT') {
          replyText = 'AI उत्तर देने में बहुत समय ले रहा है। कृपया दोबारा प्रयास करें।';
        } else {
          replyText = res.error || 'AI सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद प्रयास करें।';
        }
        if (res.request_id) {
          console.warn(`[HunarSaathi] Request ID: ${res.request_id}, Code: ${res.code}`);
        }
      }
    } catch (err: any) {
      console.warn('Sarvam chat query error:', err);
      isError = true;
      replyText = 'AI सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद प्रयास करें।';
    } finally {
      setIsThinking(false);
    }

    if (replyText) {
      if (!isError) {
        const combined = (text + ' ' + replyText).toLowerCase();
        if (combined.includes('उत्पाद') || combined.includes('studio') || combined.includes('जोड़') || combined.includes('product')) {
          replyAction = { label: '➕ अभी उत्पाद जोड़ें (Add Product)', tab: 'studio' };
        } else if (combined.includes('ऑर्डर') || combined.includes('order')) {
          replyAction = { label: '📋 ऑर्डर की सूची देखें (View Orders)', tab: 'orders' };
        } else if (combined.includes('कमाई') || combined.includes('बिक्री') || combined.includes('revenue') || combined.includes('sales')) {
          replyAction = { label: '💰 कमाई का पूरा हिसाब देखें', tab: 'revenue' };
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          action: replyAction,
        },
      ]);

      if (autoVoice && !isError) {
        playVoiceResponse(replyText);
      }
    }
  };


  const startVoiceInput = () => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        if (transcriptText) {
          handleSend(transcriptText);
        }
      };

      recognition.start();
    } else {
      // Truthful notification when Speech Recognition is unavailable in browser
      alert('आपके ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया नीचे दिए गए इनपुट बॉक्स में लिखकर संदेश भेजें।');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e6ded3] overflow-hidden bento-shadow flex flex-col h-[520px] max-w-full">
      {/* Header */}
      <div className="bg-[#1b4332] text-white p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#c85a32] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🌾
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-sans font-bold text-base sm:text-lg text-white">
                हुनर साथी
              </h3>
              <span className="bg-[#e9a83a] text-[#1b4332] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                AI सहायक
              </span>
            </div>
            <p className="text-xs text-[#e8f5e9] font-light">
              कारीगरों के लिए सरल मार्गदर्शक • Voice & Chat Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoVoice(!autoVoice)}
            className={`px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              autoVoice ? 'bg-[#e9a83a] text-[#1b4332]' : 'bg-white/15 text-white'
            }`}
            title={autoVoice ? "आवाज़ चालू है (Voice Active)" : "आवाज़ बंद है (Voice Muted)"}
          >
            {autoVoice ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[11px]">{autoVoice ? "आवाज़ ऑन" : "आवाज़ म्यूट"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#faf7f2]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-xs shrink-0 mt-1">
                🌾
              </div>
            )}
            <div className="max-w-[85%] space-y-2">
              <div className="flex items-start gap-1.5">
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#c85a32] text-white rounded-br-none font-medium'
                      : 'bg-white text-[#231f1e] border border-[#e6ded3] rounded-bl-none shadow-xs'
                  }`}
                >
                  {m.text}
                </div>
                {m.sender === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => playVoiceResponse(m.text)}
                    className="p-1.5 rounded-full text-[#1b4332] hover:bg-[#e8f5e9] bg-white border border-[#e6ded3] shadow-xs transition-colors shrink-0 mt-1"
                    title="बोलकर सुनें (Listen with Sarvam Voice)"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {m.action && onNavigateTab && (
                <button
                  onClick={() => onNavigateTab(m.action!.tab)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1b4332] text-white px-4 py-2 rounded-full hover:bg-[#2d6a4f] transition-all shadow-xs"
                >
                  <span>{m.action.label}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2.5 justify-start animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-xs shrink-0 mt-1">
              🌾
            </div>
            <div className="bg-white border border-[#e6ded3] rounded-2xl rounded-bl-none px-4 py-3 shadow-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c85a32] animate-ping" />
              <span className="text-xs text-[#5c554e] font-medium">हुनर साथी सोच रहे हैं...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="bg-[#e8f5e9] border-t border-[#c8e6c9] px-4 py-1.5 flex items-center justify-between text-xs text-[#1b4332] font-semibold animate-fade-in">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 animate-pulse text-[#2d6a4f]" />
            <span>हुनर साथी बोल रहे हैं... (Sarvam AI Bulbul Voice)</span>
          </div>
          <button
            onClick={() => {
              if (currentAudioRef.current) currentAudioRef.current.pause();
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              setIsSpeaking(false);
            }}
            className="text-[11px] underline hover:text-[#c85a32]"
          >
            रोकें (Stop)
          </button>
        </div>
      )}

      {/* Quick Suggestions Chips */}
      <div className="p-2.5 bg-white border-t border-[#e6ded3] overflow-x-auto no-scrollbar flex items-center gap-2">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q.query)}
            className="whitespace-nowrap bg-[#faf7f2] hover:bg-[#f4ede4] border border-[#e6ded3] text-[#382923] text-xs font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Input Form with Big Voice Button */}
      <div className="p-3 bg-white border-t border-[#e6ded3] flex items-center gap-2">
        <button
          type="button"
          onClick={startVoiceInput}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
            isListening
              ? 'bg-red-500 text-white animate-pulse shadow-md'
              : 'bg-[#1b4332] text-white hover:bg-[#2d6a4f] shadow-xs'
          }`}
          title="बोलकर पूछें (Tap to speak in Hindi)"
        >
          {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isListening ? 'सुन रहे हैं... (Listening...)' : 'यहाँ लिखें या माइक दबाएं...'}
          className="flex-1 bg-[#faf7f2] border border-[#e6ded3] rounded-2xl px-4 py-3 text-sm text-[#231f1e] focus:outline-hidden focus:border-[#1b4332] focus:bg-white"
        />

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputText.trim()}
          className="w-12 h-12 rounded-2xl bg-[#c85a32] hover:bg-[#b84e28] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
