import React, { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeSkinDisease, findNearbyDermatologists } from '../services/geminiService';
import { SkinDiseaseAnalysis, DermatologistLocation } from '../types';
import HealthChatbot from '../components/HealthChatbot';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ScanRecord {
    id: string;
    date: string;
    imageDataUrl: string;
    analysis: SkinDiseaseAnalysis;
}

// ─── LocalStorage helpers ────────────────────────────────────────────────────
const HISTORY_KEY = 'skin_scan_history';
const loadHistory = (): ScanRecord[] => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
};
const saveHistory = (records: ScanRecord[]) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 10))); // keep last 10
};

// ─── Helper: convert File to base64 ─────────────────────────────────────────
const fileToBase64 = (file: File): Promise<{ b64: string; dataUrl: string }> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve({ b64: dataUrl.split(',')[1], dataUrl });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

// ─── Severity config ─────────────────────────────────────────────────────────
const severityConfig: Record<string, { bg: string; text: string; border: string; dot: string; glow: string; bar: string; pct: number }> = {
    Mild: { bg: 'bg-green-500/15', text: 'text-green-300', border: 'border-green-500/40', dot: 'bg-green-400', glow: 'shadow-green-500/30', bar: 'from-green-400 to-emerald-500', pct: 28 },
    Moderate: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/40', dot: 'bg-yellow-400', glow: 'shadow-yellow-500/30', bar: 'from-yellow-400 to-orange-500', pct: 60 },
    Serious: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/40', dot: 'bg-red-400', glow: 'shadow-red-500/30', bar: 'from-red-400 to-rose-600', pct: 90 },
};

// ─── Gradient accent colours per card ───────────────────────────────────────
const cardAccents: Record<string, { border: string; glow: string; num: string }> = {
    sky: { border: 'border-l-sky-500/60', glow: 'hover:shadow-sky-500/10', num: 'bg-sky-500/20 text-sky-300' },
    green: { border: 'border-l-green-500/60', glow: 'hover:shadow-green-500/10', num: 'bg-green-500/20 text-green-300' },
    purple: { border: 'border-l-purple-500/60', glow: 'hover:shadow-purple-500/10', num: 'bg-purple-500/20 text-purple-300' },
    cyan: { border: 'border-l-cyan-500/60', glow: 'hover:shadow-cyan-500/10', num: 'bg-cyan-500/20 text-cyan-300' },
    orange: { border: 'border-l-orange-500/60', glow: 'hover:shadow-orange-500/10', num: 'bg-orange-500/20 text-orange-300' },
    amber: { border: 'border-l-amber-500/60', glow: 'hover:shadow-amber-500/10', num: 'bg-amber-500/20 text-amber-300' },
};

// ─── Premium InfoList ────────────────────────────────────────────────────────
const InfoList: React.FC<{ title: string; items: string[]; accent: string; colorKey: string; icon: React.ReactNode }> = ({ title, items, accent, colorKey, icon }) => {
    const ca = cardAccents[colorKey] ?? cardAccents.sky;
    return (
        <div className={`rounded-2xl bg-white/[0.04] border border-l-4 border-white/10 ${ca.border} p-5 transition-all duration-300 hover:bg-white/[0.07] hover:shadow-lg ${ca.glow} hover:-translate-y-0.5`}>
            <h4 className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest mb-4 ${accent}`}>
                <span className={`p-1.5 rounded-lg ${ca.num.split(' ')[0]} flex items-center justify-center`}>{icon}</span>
                {title}
            </h4>
            <ol className="space-y-2.5">
                {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed">
                        <span className={`mt-0.5 w-5 h-5 rounded-full ${ca.num} text-xs font-black flex items-center justify-center flex-shrink-0`}>{i + 1}</span>
                        {item}
                    </li>
                ))}
            </ol>
        </div>
    );
};

// ─── Premium Spinner ─────────────────────────────────────────────────────────
const Spinner: React.FC<{ label?: string }> = ({ label }) => (
    <div className="flex flex-col items-center gap-4">
        <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-pink-500/10" />
            <div className="absolute inset-1 rounded-full border-4 border-pink-500/15" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-pink-400 animate-spin" style={{ animationDuration: '1s' }} />
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-rose-300/60 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
            <div className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-pink-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 2a9 9 0 0 1 9 9" /><path d="M12 2a9 9 0 0 0-9 9" /><circle cx="12" cy="11" r="3" />
                </svg>
            </div>
        </div>
        {label && <p className="text-sm text-pink-300 font-semibold tracking-wide animate-pulse">{label}</p>}
        <p className="text-xs text-gray-600">AI is scanning your image…</p>
    </div>
);

// ─── Severity Gauge ──────────────────────────────────────────────────────────
const SeverityGauge: React.FC<{ severity: string }> = ({ severity }) => {
    const cfg = severityConfig[severity] ?? severityConfig.Mild;
    return (
        <div className="mt-4">
            <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-green-400">Mild</span><span className="text-yellow-400">Moderate</span><span className="text-red-400">Serious</span>
            </div>
            <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
                <div className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${cfg.bar} transition-all duration-1000 ease-out shadow-sm shadow-pink-500/20`}
                    style={{ width: `${cfg.pct}%` }} />
                <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.08) 50%,transparent 100%)' }} />
            </div>
        </div>
    );
};

// ─── Stats Summary Bar ───────────────────────────────────────────────────────
const StatsBar: React.FC<{ analysis: SkinDiseaseAnalysis }> = ({ analysis }) => {
    const sev = severityConfig[analysis.severity] ?? severityConfig.Mild;
    return (
        <div className="grid grid-cols-3 gap-3">
            {[{
                label: 'Severity', value: analysis.severity,
                cls: `${sev.text} ${sev.bg} ${sev.border}`,
            }, {
                label: 'Contagious', value: analysis.isContagious ? '⚠️ Yes' : '✅ No',
                cls: analysis.isContagious ? 'text-orange-300 bg-orange-500/10 border-orange-500/30' : 'text-green-300 bg-green-500/10 border-green-500/30',
            }, {
                label: 'Tips Found', value: `${(analysis.preventionTips?.length ?? 0) + (analysis.homeRemedies?.length ?? 0)} tips`,
                cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
            }].map(s => (
                <div key={s.label} className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-center ${s.cls}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{s.label}</p>
                    <p className="text-sm font-black">{s.value}</p>
                </div>
            ))}
        </div>
    );
};

// ─── Step Badge ──────────────────────────────────────────────────────────────
const StepBadge: React.FC<{ n: number; label: string; active?: boolean }> = ({ n, label, active }) => (
    <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2.5">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${active ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/40' : 'bg-pink-500 text-white'
            }`}>{n}</span>
        {label}
    </h3>
);

// ─── Reusable icon SVGs ──────────────────────────────────────────────────────
const IconInfo = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" /></svg>;
const IconLeaf = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
const IconPill = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const IconShield = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const IconAlert = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>;
const IconSun = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.636 6.364l.707-.707M12 21v-1m-6.364-1.636l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" /></svg>;

// ─── Print styles (injected into <head> once) ────────────────────────────────
const injectPrintStyles = () => {
    if (document.getElementById('skin-print-styles')) return;
    const style = document.createElement('style');
    style.id = 'skin-print-styles';
    style.textContent = `
        @media print {
            body > * { display: none !important; }
            #skin-print-area { display: block !important; color: #000 !important; background: #fff !important; }
            #skin-print-area * { color: #000 !important; background: transparent !important; border-color: #ccc !important; }
        }
        #skin-print-area { display: none; }
    `;
    document.head.appendChild(style);
};

// ─── Main Component ──────────────────────────────────────────────────────────
const SkinDiseaseDetector: React.FC = () => {
    // Image
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<SkinDiseaseAnalysis | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Dermatologist finder
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [dermatologists, setDermatologists] = useState<DermatologistLocation[]>([]);
    const [hasFetchedDerm, setHasFetchedDerm] = useState(false);

    // History
    const [history, setHistory] = useState<ScanRecord[]>(loadHistory);
    const [showHistory, setShowHistory] = useState(false);

    // Copy feedback
    const [copied, setCopied] = useState(false);

    const resultsRef = useRef<HTMLDivElement>(null);

    useEffect(() => { injectPrintStyles(); }, []);

    useEffect(() => {
        if (analysis) {
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
        }
    }, [analysis]);

    // ── Image handling ────────────────────────────────────────────────────
    const handleFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setAnalysisError('❌ Invalid file type. Please upload a JPG, PNG, or WEBP image.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setAnalysisError('❌ File too large (max 10 MB). Please compress the image and try again.');
            return;
        }
        setAnalysisError(null);
        setAnalysis(null);
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setAnalysis(null);
        setAnalysisError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    // ── Analysis ──────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!imageFile) { setAnalysisError('Please upload an image first.'); return; }
        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalysis(null);
        try {
            const { b64, dataUrl } = await fileToBase64(imageFile);
            const result = await analyzeSkinDisease(b64, imageFile.type);
            setAnalysis(result);

            // Save to history
            const record: ScanRecord = {
                id: Date.now().toString(),
                date: new Date().toLocaleString(),
                imageDataUrl: dataUrl,
                analysis: result,
            };
            const updated = [record, ...loadHistory()];
            saveHistory(updated);
            setHistory(updated);
        } catch (err: any) {
            console.error('Skin analysis error:', err);
            setAnalysisError(
                err?.message?.includes('503') || err?.message?.includes('429')
                    ? '⚠️ The AI is overloaded. Please wait a moment and try again.'
                    : `❌ Analysis failed: ${err?.message || 'Unknown error.'}`
            );
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ── Dermatologist finder ──────────────────────────────────────────────
    const handleFindDermatologists = () => {
        setIsLocating(true);
        setLocationError(null);
        setHasFetchedDerm(false);
        setDermatologists([]);
        if (!navigator.geolocation) {
            setLocationError("Your browser doesn't support geolocation.");
            setIsLocating(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const results = await findNearbyDermatologists({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setDermatologists(results);
                    if (results.length === 0) setLocationError('No results found nearby. Try searching on Google Maps manually.');
                } catch (e: any) {
                    setLocationError(`Failed: ${e?.message || 'Unknown error'}`);
                } finally {
                    setIsLocating(false);
                    setHasFetchedDerm(true);
                }
            },
            (err) => {
                setIsLocating(false);
                setHasFetchedDerm(true);
                if (err.code === err.PERMISSION_DENIED)
                    setLocationError('📍 Location denied. Please allow location access in your browser settings.');
                else if (err.code === err.POSITION_UNAVAILABLE)
                    setLocationError('📍 Location unavailable. Please try again.');
                else
                    setLocationError('📍 Could not get your location. Please try again.');
            },
            { timeout: 15000 }
        );
    };

    // ── Print Report ──────────────────────────────────────────────────────
    const handlePrint = () => {
        if (!analysis || !imagePreview) return;

        const printArea = document.getElementById('skin-print-area');
        if (!printArea) return;

        printArea.innerHTML = `
            <div style="font-family:sans-serif; max-width:700px; margin:auto; padding:24px;">
                <h1 style="color:#be185d; font-size:22px; margin-bottom:4px;">Skin Disease Analysis Report</h1>
                <p style="color:#888; font-size:12px; margin-bottom:16px;">Generated on ${new Date().toLocaleString()} · AI-Generated · NOT a medical diagnosis</p>
                <hr style="margin-bottom:16px;"/>
                <img src="${imagePreview}" style="max-width:260px; border-radius:8px; margin-bottom:16px; display:block;"/>
                <h2 style="font-size:20px; margin-bottom:4px;">${analysis.diseaseName}</h2>
                <p style="font-size:13px;"><b>Severity:</b> ${analysis.severity} &nbsp;|&nbsp; <b>Contagious:</b> ${analysis.isContagious ? 'Yes' : 'No'}</p>
                <hr style="margin:14px 0;"/>
                <h3>Causes</h3><ul>${analysis.causes.map(c => `<li>${c}</li>`).join('')}</ul>
                <h3>Home Remedies</h3><ul>${analysis.homeRemedies.map(r => `<li>${r}</li>`).join('')}</ul>
                <h3>Medical Treatments</h3><ul>${analysis.medicalTreatments.map(t => `<li>${t}</li>`).join('')}</ul>
                <h3>Prevention Tips</h3><ul>${analysis.preventionTips.map(p => `<li>${p}</li>`).join('')}</ul>
                <h3>Risk Factors</h3><ul>${analysis.riskFactors.map(r => `<li>${r}</li>`).join('')}</ul>
                <h3>Additional Notes</h3><p>${analysis.additionalNotes}</p>
                <hr style="margin-top:24px;"/>
                <p style="font-size:11px; color:#888;">⚠️ This report is AI-generated and is NOT a substitute for professional medical advice. Always consult a licensed dermatologist.</p>
            </div>
        `;
        printArea.style.display = 'block';
        window.print();
        printArea.style.display = 'none';
    };

    // ── Copy Summary ──────────────────────────────────────────────────────
    const handleCopy = () => {
        if (!analysis) return;
        const text = [
            `🔬 Skin Disease Analysis`,
            `Condition: ${analysis.diseaseName}`,
            `Severity: ${analysis.severity}`,
            `Contagious: ${analysis.isContagious ? 'Yes' : 'No'}`,
            ``,
            `📌 Causes:\n${analysis.causes.map(c => `• ${c}`).join('\n')}`,
            ``,
            `🌿 Home Remedies:\n${analysis.homeRemedies.map(r => `• ${r}`).join('\n')}`,
            ``,
            `💊 Medical Treatments:\n${analysis.medicalTreatments.map(t => `• ${t}`).join('\n')}`,
            ``,
            `🛡️ Prevention Tips:\n${analysis.preventionTips.map(p => `• ${p}`).join('\n')}`,
            ``,
            `⚠️ Risk Factors:\n${analysis.riskFactors.map(r => `• ${r}`).join('\n')}`,
            ``,
            `📋 Notes: ${analysis.additionalNotes}`,
            ``,
            `⚠️ This is AI-generated and NOT a medical diagnosis. Consult a dermatologist.`,
        ].join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    const sevInfo = analysis ? (severityConfig[analysis.severity] ?? severityConfig.Mild) : null;

    return (
        <>
            {/* Hidden print area */}
            <div id="skin-print-area" />

            <div className="relative min-h-screen text-white pb-24 overflow-x-hidden bg-slate-900">
                {/* Background */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/30 via-gray-950 to-black" />
                    <div className="absolute top-[-10%] right-[-10%] w-[35%] h-[35%] bg-rose-600/15 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[35%] h-[35%] bg-purple-600/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pt-4 space-y-7">

                    {/* ── Premium Header ── */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-950/60 via-rose-950/40 to-slate-900/80 border border-pink-500/20 p-6 md:p-8 mb-2">
                        {/* Decorative orbs */}
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-5">
                                <div className="relative flex-shrink-0">
                                    <div className="absolute inset-0 bg-pink-500/40 rounded-2xl blur-lg" />
                                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-xl shadow-pink-500/40">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path d="M12 2a9 9 0 0 1 9 9" /><path d="M12 2a9 9 0 0 0-9 9" />
                                            <path d="M3 11a9 9 0 0 0 9 9" /><path d="M21 11a9 9 0 0 1-9 9" />
                                            <circle cx="12" cy="11" r="3" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold tracking-widest text-pink-400/70 uppercase mb-1">Powered by Gemini Vision AI</p>
                                    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-rose-300 to-pink-200">
                                        Skin Disease Detector
                                    </h2>
                                    <p className="text-sm text-pink-200/40 mt-1">Upload → Analyze → Find Dermatologists</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHistory(h => !h)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all duration-200 text-sm font-bold text-gray-300 hover:text-pink-200"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                History ({history.length})
                            </button>
                        </div>

                        {/* Step progress wizard */}
                        <div className="relative mt-6 flex items-center gap-0">
                            {['Upload Photo', 'Analyze', 'View Results', 'Find Doctors'].map((label, i) => {
                                const done = (i === 0 && !!imagePreview) || (i === 1 && !!analysis) || (i === 2 && !!analysis);
                                const active = (i === 0 && !imagePreview) || (i === 1 && !!imagePreview && !analysis) || (i === 2 && !!analysis);
                                return (
                                    <React.Fragment key={label}>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500
                                                ${done ? 'bg-pink-500 border-pink-500 text-white shadow-md shadow-pink-500/40'
                                                    : active ? 'bg-transparent border-pink-400 text-pink-300 animate-pulse'
                                                        : 'bg-transparent border-white/20 text-gray-600'}`}>
                                                {done ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : i + 1}
                                            </div>
                                            <span className={`text-[10px] font-bold hidden sm:block ${done ? 'text-pink-400' : active ? 'text-pink-300' : 'text-gray-600'}`}>{label}</span>
                                        </div>
                                        {i < 3 && <div className={`flex-1 h-0.5 mx-1 mb-4 sm:mb-5 rounded-full transition-all duration-700 ${done ? 'bg-pink-500' : 'bg-white/10'}`} />}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── History Panel (grid) ── */}
                    {showHistory && (
                        <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Past Scans
                                </h3>
                                {history.length > 0 && (
                                    <button onClick={() => { saveHistory([]); setHistory([]); }} className="text-xs text-red-400/60 hover:text-red-400 transition-colors font-semibold">Clear all</button>
                                )}
                            </div>
                            {history.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <p className="text-sm text-gray-500">No past scans yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {history.map(rec => {
                                        const sev = severityConfig[rec.analysis.severity] ?? severityConfig.Mild;
                                        return (
                                            <button key={rec.id} onClick={() => { setAnalysis(rec.analysis); setImagePreview(rec.imageDataUrl); setShowHistory(false); setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 200); }}
                                                className="relative group rounded-2xl overflow-hidden border border-white/10 hover:border-pink-500/40 transition-all duration-200 aspect-square text-left">
                                                <img src={rec.imageDataUrl} className="w-full h-full object-cover" alt="past" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                                    <p className="text-xs font-bold text-white truncate leading-tight">{rec.analysis.diseaseName}</p>
                                                    <span className={`inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>{rec.analysis.severity}</span>
                                                </div>
                                                <div className="absolute inset-0 ring-2 ring-inset ring-pink-500/0 group-hover:ring-pink-500/40 transition-all duration-200 rounded-2xl" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}


                    {/* ── Step 1: Upload ── */}
                    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 hover:border-pink-500/20 transition-all duration-300 p-6 md:p-8">
                        <StepBadge n={1} label="Upload Skin Photo" active={!imagePreview} />

                        {!imagePreview ? (
                            <>
                                {/* Drop zone */}
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300
                                        ${isDragging ? 'border-pink-400 bg-pink-400/10 scale-[1.01] shadow-lg shadow-pink-500/20' : 'border-white/15 bg-white/[0.02] hover:border-pink-500/50 hover:bg-pink-500/[0.04] hover:shadow-md hover:shadow-pink-500/10'}`}
                                >
                                    {/* Animated corner highlights when dragging */}
                                    {isDragging && <>
                                        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-pink-400 rounded-tl-2xl" />
                                        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-pink-400 rounded-tr-2xl" />
                                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-pink-400 rounded-bl-2xl" />
                                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-pink-400 rounded-br-2xl" />
                                    </>}
                                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-pink-400/20 scale-110' : 'bg-white/[0.06]'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-9 h-9 transition-colors duration-300 ${isDragging ? 'text-pink-300' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-white mb-1 text-lg">{isDragging ? '✨ Drop it!' : 'Drag & drop or click to upload'}</p>
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            {['JPG', 'PNG', 'WEBP'].map(t => <span key={t} className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-bold text-gray-400">{t}</span>)}
                                            <span className="text-xs text-gray-600">· max 10 MB</span>
                                        </div>
                                    </div>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                                </div>

                                {/* Camera */}
                                <button onClick={() => cameraInputRef.current?.click()}
                                    className="mt-3 w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-pink-500/40 hover:bg-pink-500/5 transition-all duration-200 text-sm font-bold text-gray-400 hover:text-pink-300 group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    📸 Take Photo with Camera (Mobile)
                                </button>
                                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                            </>
                        ) : (
                            <div className="relative">
                                <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-pink-500/20 max-h-96 flex items-center justify-center shadow-lg shadow-pink-500/10">
                                    <img src={imagePreview} alt="Skin preview" className="max-h-96 w-full object-contain" />
                                    <div className="absolute inset-0 ring-1 ring-inset ring-pink-500/20 rounded-2xl pointer-events-none" />
                                    {/* Corner tick */}
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/40 backdrop-blur-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        <span className="text-xs font-bold text-green-300">Ready to analyze</span>
                                    </div>
                                </div>
                                <button onClick={clearImage} className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-red-500/80 border border-white/20 rounded-full transition-all duration-200 group" title="Remove">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <p className="mt-2.5 text-xs text-gray-600 text-center truncate px-4">{imageFile?.name ?? 'Loaded from history'}</p>
                            </div>
                        )}
                    </div>

                    {/* ── Step 2: Analyze ── */}
                    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 hover:border-pink-500/20 transition-all duration-300 p-6 md:p-8">
                        <StepBadge n={2} label="Analyze with Gemini Vision AI" active={!!imagePreview && !analysis} />

                        {analysisError && (
                            <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                <p className="text-sm text-red-300">{analysisError}</p>
                            </div>
                        )}

                        {isAnalyzing ? (
                            <div className="flex flex-col items-center py-12 relative">
                                {/* Scanning overlay on image */}
                                {imagePreview && (
                                    <div className="relative w-48 h-36 rounded-xl overflow-hidden border border-pink-500/30 mb-6 shadow-lg shadow-pink-500/20">
                                        <img src={imagePreview} className="w-full h-full object-cover opacity-60" alt="scanning" />
                                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(236,72,153,0.15) 50%, transparent 100%)', animation: 'scanMove 1.8s ease-in-out infinite' }} />
                                        <div className="absolute inset-0 ring-2 ring-inset ring-pink-500/30 rounded-xl" />
                                    </div>
                                )}
                                <style>{`@keyframes scanMove { 0%{background-position-y:-100%} 100%{background-position-y:200%} }`}</style>
                                <Spinner label="Analyzing skin condition…" />
                                <p className="mt-4 text-xs text-gray-600 text-center max-w-xs">This may take 10–30 seconds. Please keep the page open.</p>
                            </div>
                        ) : (
                            <button
                                onClick={handleAnalyze}
                                disabled={!imageFile}
                                className={`w-full py-5 rounded-2xl font-black text-base uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3
                                    ${!imageFile
                                        ? 'bg-white/[0.03] text-gray-700 border border-white/10 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-pink-600 via-rose-600 to-pink-700 text-white shadow-xl shadow-pink-600/30 hover:shadow-pink-500/50 hover:-translate-y-1 active:scale-[0.98] hover:from-pink-500 hover:to-rose-500'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.122m-6 0l.659.587A2.25 2.25 0 009 16.5h1.25m3.5-13.396c.251.023.501.05.75.082M14.25 3.104v5.714a2.25 2.25 0 00.659 1.591L19 14.5" />
                                </svg>
                                {imageFile ? '🔬 Analyze Skin Condition' : 'Upload an image first'}
                            </button>
                        )}
                    </div>

                    {/* ── Step 3: Results ─── */}
                    {analysis && (
                        <div ref={resultsRef} className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 p-6 md:p-8 space-y-6 ring-1 ring-inset ring-pink-500/10">

                            {/* Action bar */}
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <StepBadge n={3} label="AI Analysis Results" active />
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-xs font-bold text-gray-400 hover:text-sky-300">
                                        {copied ? <><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</> : <><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>}
                                    </button>
                                    <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-xs font-bold text-gray-400 hover:text-purple-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        Print
                                    </button>
                                    <button onClick={clearImage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-pink-500/40 hover:bg-pink-500/5 transition-all text-xs font-bold text-gray-400 hover:text-pink-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        New Scan
                                    </button>
                                </div>
                            </div>

                            {/* Disease banner with StatsBar + SeverityGauge */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-950/50 to-slate-900/60 border border-pink-500/20 p-5">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
                                <p className="text-xs font-black text-pink-400/70 uppercase tracking-widest mb-1">Detected Condition</p>
                                <h4 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-100 leading-tight mb-4">{analysis.diseaseName}</h4>
                                <StatsBar analysis={analysis} />
                                <SeverityGauge severity={analysis.severity} />
                            </div>

                            {/* Info cards grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoList title="Causes" items={analysis.causes} accent="text-sky-400" colorKey="sky" icon={<IconInfo />} />
                                <InfoList title="Home Remedies" items={analysis.homeRemedies} accent="text-green-400" colorKey="green" icon={<IconLeaf />} />
                                <InfoList title="Medical Treatments" items={analysis.medicalTreatments} accent="text-purple-400" colorKey="purple" icon={<IconPill />} />
                                <InfoList title="Prevention Tips" items={analysis.preventionTips} accent="text-cyan-400" colorKey="cyan" icon={<IconShield />} />
                                <InfoList title="Risk Factors" items={analysis.riskFactors} accent="text-orange-400" colorKey="orange" icon={<IconAlert />} />
                                <div className="rounded-2xl bg-white/[0.04] border-l-4 border border-white/10 border-l-amber-500/60 p-5 hover:bg-white/[0.07] transition-all duration-300">
                                    <h4 className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest mb-3 text-amber-400">
                                        <span className="p-1.5 rounded-lg bg-amber-500/20 flex items-center justify-center"><IconSun /></span>
                                        Additional Notes
                                    </h4>
                                    <p className="text-sm text-gray-300 leading-relaxed">{analysis.additionalNotes}</p>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* ── Step 4: Dermatologist Finder ── */}
                    <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-white/10 hover:border-pink-500/20 transition-all duration-300 p-6 md:p-8">
                        <StepBadge n={4} label="Find Nearby Dermatologists" active={false} />
                        <p className="text-sm text-gray-500 mb-5 mt-1 ml-9">Uses your device location to find skin clinics near you.</p>

                        {locationError && (
                            <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                <p className="text-sm text-yellow-300">{locationError}</p>
                            </div>
                        )}

                        {isLocating ? (
                            <div className="flex flex-col items-center py-8"><Spinner label="Finding nearby dermatologists…" /></div>
                        ) : (
                            <button
                                onClick={handleFindDermatologists}
                                className="w-full py-5 rounded-2xl font-black text-base uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 bg-gradient-to-r from-rose-600 via-pink-600 to-pink-700 text-white shadow-xl shadow-rose-600/30 hover:shadow-rose-500/50 hover:-translate-y-1 active:scale-[0.98]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                📍 {hasFetchedDerm ? 'Search Again' : 'Find Nearby Dermatologists'}
                            </button>
                        )}

                        {dermatologists.length > 0 && (
                            <div className="mt-6 space-y-3">
                                <p className="text-xs font-black text-pink-400 uppercase tracking-widest">{dermatologists.length} results found</p>
                                {dermatologists.map((doc, i) => (
                                    <a key={i} href={doc.mapsUri} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-pink-500/30 transition-all duration-200 group"
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-pink-500/20 group-hover:scale-110 transition-transform duration-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm group-hover:text-pink-300 transition-colors truncate">{doc.name}</p>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{doc.address}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {doc.rating && (
                                                <span className="text-xs font-bold text-yellow-400 flex items-center gap-0.5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                    {doc.rating}
                                                </span>
                                            )}
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 group-hover:text-pink-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── AI Health Chatbot ── */}
            <HealthChatbot
                accent="violet"
                contextSummary={
                    analysis
                        ? `Condition: ${analysis.diseaseName}. Severity: ${analysis.severity}. Contagious: ${analysis.isContagious ? 'Yes' : 'No'}. Causes: ${analysis.causes.join(', ')}. Home remedies: ${analysis.homeRemedies.join(', ')}. Prevention: ${analysis.preventionTips.join(', ')}.`
                        : undefined
                }
                suggestedQuestions={[
                    'What does my skin result mean?',
                    'Is this skin condition serious?',
                    'What are some good home remedies for this?',
                    'How can I prevent this from coming back?',
                    'When should I see a doctor?',
                ]}
            />
        </>
    );
};

export default SkinDiseaseDetector;
