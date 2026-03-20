'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, ChevronDown } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  'Where can I find funded brands?',
  'How do I scan a website?',
  'Where are the filters?',
  'How do I create a watchlist?',
  'Where do I see market signals?',
];

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);

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
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply || data.error || 'Something went wrong.' }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Network error — please check your connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const formatContent = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-[#C94C1E] underline">$1</a>')
      .replace(/^- (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-[#C94C1E] flex-shrink-0 text-[10px] mt-[3px]">●</span><span>$1</span></div>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Trigger — slim pill button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C94C1E] text-white shadow-lg hover:shadow-xl hover:bg-[#b5431a] transition-all text-[13px] font-semibold group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5.002L2 22l4.998-1.338A9.965 9.965 0 0012 22z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Ask AI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] h-[520px] bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#C94C1E] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5.002L2 22l4.998-1.338A9.965 9.965 0 0012 22z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <span className="text-[13px] font-bold text-slate-800 dark:text-white">HarvinAI</span>
                <span className="text-[10px] text-emerald-500 font-semibold ml-2 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Online
                </span>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors" title="Minimize">
                <ChevronDown size={16} />
              </button>
              <button onClick={() => { setOpen(false); setMessages([]); }} className="p-1.5 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors" title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">

            {/* Welcome state */}
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-[#C94C1E]/10 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5.002L2 22l4.998-1.338A9.965 9.965 0 0012 22z" stroke="#C94C1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-[14px] font-bold text-slate-800 dark:text-white mb-1">How can I help?</p>
                <p className="text-[12px] text-slate-400 dark:text-neutral-500 mb-5">Ask me anything about HarvinAI</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-150 dark:border-white/[0.08] text-slate-600 dark:text-neutral-400 hover:border-[#C94C1E]/40 hover:text-[#C94C1E] hover:bg-[#C94C1E]/5 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-md bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5.002L2 22l4.998-1.338A9.965 9.965 0 0012 22z" stroke="#C94C1E" strokeWidth="2"/>
                    </svg>
                  </div>
                )}
                <div className={`max-w-[82%] rounded-xl px-3 py-2 text-[12.5px] leading-[1.6] ${
                  msg.role === 'user'
                    ? 'bg-[#C94C1E] text-white rounded-br-sm'
                    : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-neutral-300 border border-slate-100 dark:border-white/[0.06] rounded-bl-sm'
                }`}>
                  <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-md bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.82.487 3.53 1.338 5.002L2 22l4.998-1.338A9.965 9.965 0 0012 22z" stroke="#C94C1E" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] rounded-xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-600 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-600 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-600 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 focus-within:border-[#C94C1E]/40 focus-within:ring-1 focus-within:ring-[#C94C1E]/10 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 outline-none py-2.5"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className={`p-1.5 rounded-lg transition-all ${
                  input.trim() && !loading
                    ? 'bg-[#C94C1E] text-white hover:bg-[#b5431a]'
                    : 'text-slate-300 dark:text-neutral-600'
                }`}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
