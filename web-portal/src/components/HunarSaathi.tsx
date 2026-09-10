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
  Volume2
} from 'lucide-react';

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
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickQuestions = [
    { label: '🎤 नया उत्पाद जोड़ना है', query: 'मुझे नया उत्पाद जोड़ना है' },
    { label: '📦 मेरे कितने ऑर्डर हैं?', query: 'मेरे कितने ऑर्डर हैं?' },
    { label: '💰 सही कीमत क्या रखूं?', query: 'इस उत्पाद की कीमत क्या रखूं?' },
    { label: '📈 मेरी बिक्री कैसी चल रही है?', query: 'मेरी बिक्री कैसी चल रही है?' },
  ];

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Simulate intelligent, compassionate artisan responses
    setTimeout(() => {
      let replyText = '';
      let replyAction: Message['action'] = undefined;

      const lower = text.toLowerCase();

      if (lower.includes('उत्पाद') || lower.includes('जोड़ना') || lower.includes('add') || lower.includes('product')) {
        replyText = 'नया उत्पाद जोड़ना बहुत आसान है! बस अपने शिल्प की एक साफ फोटो लें और 10 सेकंड बोलकर बताएं। हमारी AI अपने आप विवरण और उचित मूल्य तैयार कर देगी।';
        replyAction = { label: '➕ अभी उत्पाद जोड़ें (Add Product)', tab: 'studio' };
      } else if (lower.includes('ऑर्डर') || lower.includes('order')) {
        replyText = 'आपके पास वर्तमान में 3 सक्रिय ऑर्डर हैं। 2 ऑर्डर तैयार होकर डिलीवरी के लिए प्रस्थान कर चुके हैं, और 1 नया ऑर्डर (कतान सिल्क दुपट्टा) आज प्राप्त हुआ है।';
        replyAction = { label: '📋 ऑर्डर की सूची देखें (View Orders)', tab: 'orders' };
      } else if (lower.includes('कीमत') || lower.includes('मूल्य') || lower.includes('price')) {
        replyText = 'हुनरधारा का नियम है कि आपकी मजदूरी कम से कम ₹650 प्रति दिन मिले। कच्ची सामग्री की लागत + निर्माण दिनों की मजदूरी को जोड़कर हम उचित मूल्य तय करते हैं। आप स्टूडियो में दिन और सामग्री भरें, AI सही कीमत बताएगा।';
        replyAction = { label: '🧮 मूल्य कैलकुलेटर खोलें', tab: 'studio' };
      } else if (lower.includes('बिक्री') || lower.includes('कमाई') || lower.includes('sales') || lower.includes('revenue')) {
        replyText = 'बधाई हो! इस महीने आपके हुनर ने ₹42,500 की सीधी बिक्री की है। बिचौलियों के न होने से आपने ₹14,875 की अतिरिक्त बचत अपने परिवार के लिए की है।';
        replyAction = { label: '💰 कमाई का पूरा हिसाब देखें', tab: 'revenue' };
      } else {
        replyText = 'मैं समझ गया। आप निश्चिंत रहें, आपका हुनर अनमोल है। आप चाहें तो ऊपर दिए गए बटन दबाकर उत्पाद जोड़ सकते हैं या अपनी बिक्री की जानकारी ले सकते हैं।';
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
    }, 600);
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
      // Mock voice input fallback
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        handleSend('मुझे नया उत्पाद जोड़ना है');
      }, 2000);
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

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
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
              <div
                className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-[#c85a32] text-white rounded-br-none font-medium'
                    : 'bg-white text-[#231f1e] border border-[#e6ded3] rounded-bl-none shadow-xs'
                }`}
              >
                {m.text}
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
        <div ref={chatBottomRef} />
      </div>

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
