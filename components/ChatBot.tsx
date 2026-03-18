'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2 } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  'What is HarvinAI?',
  'How does tech scanning work?',
  'What categories do you support?',
  'How are signals detected?',
  'What filters can I use?',
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m the HarvinAI Assistant. Ask me anything about our D2C brand intelligence platform — features, categories, tech scanning, signals, and more.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.error || 'Sorry, something went wrong. Please try again.',
        }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.reply,
        }]);
      }
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Network error — please check your connection and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Format message content with basic markdown
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Bold
        const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Bullet points
        if (formatted.startsWith('- ') || formatted.startsWith('• ')) {
          return `<div key="${i}" class="flex gap-1.5 ml-2"><span class="text-[#C94C1E] flex-shrink-0">•</span><span>${formatted.slice(2)}</span></div>`;
        }
        return formatted;
      })
      .join('<br/>');
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#C94C1E] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          title="Chat with HarvinAI Assistant"
        >
          <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-[#0a0a0a] animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06] bg-gradient-to-r from-[#C94C1E]/5 to-transparent dark:from-[#C94C1E]/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C94C1E]/10 flex items-center justify-center">
                <Bot size={18} className="text-[#C94C1E]" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-800 dark:text-white">HarvinAI Assistant</h3>
                <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                title="Minimize"
              >
                <Minimize2 size={16} />
              </button>
              <button
                onClick={() => { setOpen(false); setMessages([messages[0]]); }}
                className="p-2 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                title="Close & reset"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === 'user'
                    ? 'bg-[#C94C1E]/10 text-[#C94C1E]'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-neutral-400'
                }`}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#C94C1E] text-white rounded-tr-sm'
                    : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-neutral-300 border border-slate-100 dark:border-white/[0.06] rounded-tl-sm'
                }`}>
                  <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-slate-500 dark:text-neutral-400" />
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] rounded-xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-neutral-600 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-neutral-600 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-neutral-600 animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions (only show if just the welcome message) */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-neutral-400 hover:border-[#C94C1E]/30 hover:text-[#C94C1E] hover:bg-[#C94C1E]/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-1 focus-within:border-[#C94C1E]/40 focus-within:ring-2 focus-within:ring-[#C94C1E]/10 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about HarvinAI..."
                className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 outline-none py-2"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className={`p-2 rounded-lg transition-all ${
                  input.trim() && !loading
                    ? 'bg-[#C94C1E] text-white hover:bg-[#b5431a]'
                    : 'text-slate-300 dark:text-neutral-600 cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-neutral-600 text-center mt-2">Powered by HarvinAI</p>
          </div>
        </div>
      )}
    </>
  );
}
