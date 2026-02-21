import React, { useState, useRef, useEffect, useCallback } from 'react';
import { chatWithHealthAI, HealthChatMsg } from '../services/geminiService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
    /** Accent color theme: 'cyan' for imaging, 'violet' for skin */
    accent?: 'cyan' | 'violet';
    /** A plain-text blurb of the current scan/analysis result to give context */
    contextSummary?: string;
    /** Suggested starter questions shown before the user types */
    suggestedQuestions?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACCENT = {
    cyan: {
        gradient: 'from-cyan-600 to-sky-700',
        glow: 'shadow-cyan-900/50',
        ring: 'ring-cyan-500/30',
        userBubble: 'bg-gradient-to-br from-cyan-600 to-sky-700',
        dot: 'bg-cyan-400',
        pillBorder: 'border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10',
        sendBtn: 'bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600',
        title: 'text-cyan-300',
        badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    },
    violet: {
        gradient: 'from-violet-600 to-purple-700',
        glow: 'shadow-violet-900/50',
        ring: 'ring-violet-500/30',
        userBubble: 'bg-gradient-to-br from-violet-600 to-purple-700',
        dot: 'bg-violet-400',
        pillBorder: 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10',
        sendBtn: 'bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600',
        title: 'text-violet-300',
        badge: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
    },
};

// ─── Message bubble ───────────────────────────────────────────────────────────
const Bubble: React.FC<{ msg: HealthChatMsg; accent: keyof typeof ACCENT }> = ({ msg, accent }) => {
    const a = ACCENT[accent];
    const isUser = msg.role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
            {!isUser && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-base mr-2 mt-1 flex-shrink-0 border border-white/10">🤖</div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-lg
                ${isUser
                    ? `${a.userBubble} text-white rounded-br-sm`
                    : 'bg-white/[0.07] border border-white/10 text-slate-200 rounded-bl-sm'}`}>
                {msg.content}
            </div>
            {isUser && (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-base ml-2 mt-1 flex-shrink-0 border border-white/10">👤</div>
            )}
        </div>
    );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────
const TypingDots: React.FC = () => (
    <div className="flex items-center gap-1.5 px-4 py-3 bg-white/[0.07] border border-white/10 rounded-2xl rounded-bl-sm w-fit mb-3 ml-9">
        {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
    </div>
);

// ─── Main chatbot component ───────────────────────────────────────────────────
const HealthChatbot: React.FC<Props> = ({
    accent = 'cyan',
    contextSummary,
    suggestedQuestions = [],
}) => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<HealthChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const a = ACCENT[accent];

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Focus input when opened
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 120);
    }, [open]);

    const send = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;
        setInput('');
        setError('');

        const userMsg: HealthChatMsg = { role: 'user', content: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        try {
            const allMsgs = [...messages, userMsg];
            const reply = await chatWithHealthAI(allMsgs, contextSummary);
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (e) {
            setError('Could not get a response. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [messages, loading, contextSummary]);

    const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    };

    const isEmpty = messages.length === 0;

    return (
        <>
            {/* ── Floating toggle button ── */}
            <button
                onClick={() => setOpen(o => !o)}
                aria-label={open ? 'Close chatbot' : 'Open health chatbot'}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br ${a.gradient} text-white text-2xl flex items-center justify-center shadow-2xl ${a.glow} hover:scale-110 active:scale-95 transition-all duration-200 ring-2 ${a.ring}`}
            >
                {open ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : '💬'}
                {!open && messages.length > 0 && (
                    <span className={`absolute -top-1 -right-1 w-4 h-4 ${a.dot} rounded-full text-[8px] font-black text-white flex items-center justify-center`}>
                        {messages.length}
                    </span>
                )}
            </button>

            {/* ── Chat panel ── */}
            {open && (
                <div className={`fixed bottom-24 right-6 z-50 w-[350px] sm:w-[400px] max-h-[580px] flex flex-col rounded-3xl overflow-hidden shadow-2xl ${a.glow} ring-1 ${a.ring} bg-[#070f1c]/95 backdrop-blur-2xl border border-white/10`}>

                    {/* Header */}
                    <div className={`bg-gradient-to-r ${a.gradient} px-5 py-4 flex items-center justify-between flex-shrink-0`}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">🤖</div>
                            <div>
                                <p className="font-black text-white text-sm">Health AI Assistant</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`w-1.5 h-1.5 ${a.dot} rounded-full animate-pulse`} />
                                    <p className="text-[10px] text-white/70">Multilingual · Context-aware</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Language badge */}
                            <div className={`text-[9px] font-black px-2 py-1 rounded-full border ${a.badge} uppercase tracking-wider`}>
                                Any Language
                            </div>
                            <button
                                onClick={() => { setMessages([]); setError(''); }}
                                title="Clear chat"
                                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Context pill */}
                    {contextSummary && (
                        <div className="px-4 pt-3 flex-shrink-0">
                            <div className={`text-[10px] font-black px-3 py-1.5 rounded-full border ${a.badge} flex items-center gap-2`}>
                                <span>📋</span>
                                <span>Scan result loaded — ask me anything about it!</span>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                        {isEmpty && (
                            <div className="flex flex-col items-center justify-center h-full gap-5 py-6">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${a.gradient} flex items-center justify-center text-3xl shadow-lg ${a.glow}`}>🤖</div>
                                <div className="text-center">
                                    <p className={`font-black ${a.title} mb-1`}>Ask me anything!</p>
                                    <p className="text-xs text-slate-500 max-w-52">I reply in your language — English, Hindi, Spanish, Arabic, or any other.</p>
                                </div>
                                {suggestedQuestions.length > 0 && (
                                    <div className="flex flex-col gap-2 w-full">
                                        {suggestedQuestions.map((q, i) => (
                                            <button key={i} onClick={() => send(q)}
                                                className={`text-xs text-left px-3 py-2.5 rounded-xl bg-white/[0.04] border ${a.pillBorder} transition-colors leading-snug`}>
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <Bubble key={i} msg={m} accent={accent} />
                        ))}

                        {loading && <TypingDots />}

                        {error && (
                            <p className="text-xs text-red-400 text-center mt-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input area */}
                    <div className="px-4 pb-4 pt-2 border-t border-white/[0.07] flex-shrink-0">
                        <div className="flex gap-2 items-end bg-white/[0.05] border border-white/10 rounded-2xl p-2 focus-within:border-white/20 transition-colors">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Type your question… (any language)"
                                rows={1}
                                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none outline-none py-1 px-2 leading-relaxed max-h-24 overflow-y-auto"
                                style={{ minHeight: '28px' }}
                                disabled={loading}
                            />
                            <button
                                onClick={() => send(input)}
                                disabled={!input.trim() || loading}
                                className={`flex-shrink-0 w-9 h-9 rounded-xl ${a.sendBtn} text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95`}
                            >
                                {loading ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
                    </div>
                </div>
            )}
        </>
    );
};

export default HealthChatbot;
