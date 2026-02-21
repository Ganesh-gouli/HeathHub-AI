import React, { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeMedicalImage, MedicalFinding, MedicalImagingResult, findNearbyImagingCenters, ImagingCenter } from '../services/geminiService';
import HealthChatbot from '../components/HealthChatbot';

const SCAN_TYPES = ['X-Ray', 'MRI', 'CT Scan'] as const;

/* ─── Count-up hook ───────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1200, active = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!active) return;
        let start: number | null = null;
        const tick = (ts: number) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            setVal(Math.round(p * target));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [target, duration, active]);
    return val;
}

/* ─── Severity config ──────────────────────────────────────────────────────── */
const SEV = {
    high: { bar: 'from-red-500 to-rose-400', badge: 'bg-red-500/20 text-red-300 border-red-500/40', ring: 'ring-red-500/30', icon: '🔴', label: 'Needs Attention' },
    moderate: { bar: 'from-amber-500 to-orange-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', ring: 'ring-amber-500/30', icon: '🟡', label: 'Worth Monitoring' },
    low: { bar: 'from-emerald-500 to-teal-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', ring: 'ring-emerald-500/30', icon: '🟢', label: 'Looks Normal' },
};

/* ─── Verdict config ───────────────────────────────────────────────────────── */
const VERDICT: Record<string, { gradient: string; text: string; glow: string; emoji: string }> = {
    'Looks Healthy': { gradient: 'from-emerald-600/30 to-teal-600/20', text: 'text-emerald-300', glow: 'shadow-emerald-500/20', emoji: '✅' },
    'Mostly Normal': { gradient: 'from-cyan-600/30 to-blue-600/20', text: 'text-cyan-300', glow: 'shadow-cyan-500/20', emoji: '✅' },
    'Some Concerns Found': { gradient: 'from-amber-600/30 to-orange-600/20', text: 'text-amber-300', glow: 'shadow-amber-500/20', emoji: '⚠️' },
    'Needs Medical Attention': { gradient: 'from-orange-600/30 to-red-600/20', text: 'text-orange-300', glow: 'shadow-orange-500/20', emoji: '⚠️' },
    'Urgent — See a Doctor': { gradient: 'from-red-700/40 to-rose-700/30', text: 'text-red-300', glow: 'shadow-red-500/30', emoji: '🚨' },
};

/* ─── Scanning stages ──────────────────────────────────────────────────────── */
const SCAN_STAGES = [
    { label: 'Loading image', sub: 'Preparing scan data…' },
    { label: 'Segmenting anatomy', sub: 'Identifying structures…' },
    { label: 'Detecting patterns', sub: 'Running AI pathology model…' },
    { label: 'Cross-referencing', sub: 'Checking diagnostic database…' },
    { label: 'Generating report', sub: 'Writing plain-language summary…' },
];

/* ─── Health Score Ring ────────────────────────────────────────────────────── */
const HealthRing: React.FC<{ score: number; active: boolean }> = ({ score, active }) => {
    const animated = useCountUp(score, 1500, active);
    const r = 52, circ = 2 * Math.PI * r;
    const fill = active ? (animated / 100) * circ : 0;
    const color = score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
    return (
        <div className="relative w-36 h-36 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 1.5s ease-out', filter: `drop-shadow(0 0 8px ${color}80)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-white">{animated}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Health Score</span>
            </div>
        </div>
    );
};

/* ─── Finding Card ─────────────────────────────────────────────────────────── */
const FindingCard: React.FC<{ f: MedicalFinding; idx: number; show: boolean }> = ({ f, idx, show }) => {
    const [visible, setVisible] = useState(false);
    const [countOn, setCountOn] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const conf = useCountUp(f.confidence, 1000, countOn);
    const sev = SEV[f.severity] ?? SEV.low;

    useEffect(() => {
        if (!show) return;
        const t1 = setTimeout(() => setVisible(true), idx * 130);
        const t2 = setTimeout(() => setCountOn(true), idx * 130 + 200);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [show, idx]);

    return (
        <div
            className={`rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-all duration-700 overflow-hidden cursor-pointer
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            style={{ transitionDelay: `${idx * 80}ms` }}
            onClick={() => setExpanded(e => !e)}
        >
            {/* Header row */}
            <div className="flex items-center gap-4 p-4">
                {/* Emoji badge */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ring-2 ${sev.ring} bg-white/5`}>
                    {f.icon}
                </div>

                {/* Title + confidence */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-white text-base leading-tight">{f.simpleTitle || f.condition}</p>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${sev.badge}`}>
                            {sev.label}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{f.condition}</p>

                    {/* Confidence bar */}
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${sev.bar} transition-all duration-[1200ms] ease-out`}
                                style={{ width: countOn ? `${f.confidence}%` : '0%' }} />
                        </div>
                        <span className="text-xs font-black text-slate-400 w-8 text-right">{conf}%</span>
                    </div>
                </div>

                {/* Expand chevron */}
                <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Expanded details */}
            <div className={`transition-all duration-400 ease-in-out overflow-hidden ${expanded ? 'max-h-80' : 'max-h-0'}`}>
                <div className="px-4 pb-4 border-t border-white/[0.06] pt-4 grid gap-3">
                    {/* What we found */}
                    <div className="bg-white/[0.03] rounded-xl p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 flex items-center gap-1.5">
                            <span>🔍</span> What We Found
                        </p>
                        <p className="text-sm text-slate-200 leading-relaxed">{f.simpleExplanation}</p>
                    </div>
                    {/* What this means */}
                    <div className="bg-white/[0.03] rounded-xl p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 flex items-center gap-1.5">
                            <span>💡</span> What This Means for You
                        </p>
                        <p className="text-sm text-slate-200 leading-relaxed">{f.whatThisMeans}</p>
                    </div>
                    {/* What to do */}
                    <div className="bg-cyan-500/[0.07] border border-cyan-500/20 rounded-xl p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-1.5 flex items-center gap-1.5">
                            <span>✅</span> What To Do
                        </p>
                        <p className="text-sm text-cyan-100 leading-relaxed font-medium">{f.whatToDo}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Component ───────────────────────────────────────────────────────── */
type Phase = 'upload' | 'scanning' | 'results' | 'error';

const MedicalImaging: React.FC = () => {
    const [phase, setPhase] = useState<Phase>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState(0);
    const [selectedType, setSelectedType] = useState('X-Ray');
    const [aiResult, setAiResult] = useState<MedicalImagingResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [actionOpen, setActionOpen] = useState(false);
    const [scoreActive, setScoreActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Locator state ──
    const [locStatus, setLocStatus] = useState<'idle' | 'locating' | 'fetching' | 'done' | 'error'>('idle');
    const [locError, setLocError] = useState('');
    const [centers, setCenters] = useState<ImagingCenter[]>([]);
    const [locQuery, setLocQuery] = useState('');
    const [serviceFilter, setServiceFilter] = useState<'All' | 'CT Scan' | 'MRI' | 'X-Ray'>('All');
    const isFetchingLoc = useRef(false);

    const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: file.type });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;
        setImageUrl(URL.createObjectURL(file));
        setPhase('scanning');
        setScanProgress(0);
        setCurrentStage(0);
        setAiResult(null);
        setErrorMsg('');
        setActionOpen(false);

        let prog = 0;
        let stageIdx = 0;
        scanIntervalRef.current = setInterval(() => {
            prog += Math.random() * 2.5 + 0.5;
            if (prog >= 90) prog = 90;
            setScanProgress(Math.floor(prog));
            const newStage = Math.min(Math.floor((prog / 90) * SCAN_STAGES.length), SCAN_STAGES.length - 1);
            if (newStage !== stageIdx) { stageIdx = newStage; setCurrentStage(newStage); }
        }, 80);

        fileToBase64(file).then(({ base64, mimeType }) =>
            analyzeMedicalImage(base64, mimeType, selectedType)
        ).then(result => {
            clearInterval(scanIntervalRef.current!);
            setScanProgress(100);
            setCurrentStage(SCAN_STAGES.length - 1);
            setAiResult(result);
            setTimeout(() => {
                setPhase('results');
                setTimeout(() => setScoreActive(true), 400);
            }, 600);
        }).catch(err => {
            clearInterval(scanIntervalRef.current!);
            setErrorMsg(err?.message || 'AI analysis failed. Please try again.');
            setPhase('error');
        });
    }, [selectedType]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, [processFile]);

    const reset = () => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setPhase('upload'); setImageUrl(null); setScanProgress(0);
        setCurrentStage(0); setAiResult(null); setErrorMsg('');
        setScoreActive(false); setActionOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    // ── Locator helpers ──
    const fetchCentersGPS = async () => {
        if (isFetchingLoc.current) return;
        isFetchingLoc.current = true;
        setLocStatus('locating'); setLocError(''); setCenters([]);
        if (!navigator.geolocation) { setLocError('Geolocation not supported. Use manual search.'); setLocStatus('error'); isFetchingLoc.current = false; return; }
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
            );
            setLocStatus('fetching');
            const data = await findNearbyImagingCenters({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setCenters(data); setLocStatus('done');
        } catch (e: unknown) {
            const msg = e instanceof GeolocationPositionError
                ? e.code === e.PERMISSION_DENIED ? 'Location access denied. Use manual search.' : 'Could not get location. Try manual search.'
                : 'Location failed. Try manual search.';
            setLocError(msg); setLocStatus('error');
        } finally { isFetchingLoc.current = false; }
    };

    const fetchCentersManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!locQuery.trim()) return;
        setLocStatus('fetching'); setLocError(''); setCenters([]);
        try {
            const data = await findNearbyImagingCenters(locQuery.trim());
            setCenters(data); setLocStatus('done');
        } catch { setLocError('Search failed. Please try again.'); setLocStatus('error'); }
    };

    const filteredCenters = centers.filter(c =>
        serviceFilter === 'All' || (c.services ?? []).includes(serviceFilter)
    );

    const verdictStyle = aiResult ? (VERDICT[aiResult.verdictLabel] ?? VERDICT['Some Concerns Found']) : null;

    return (
        <>
            <div className="relative min-h-screen w-full bg-gradient-to-br from-[#040e1c] via-[#061624] to-[#020b14] overflow-hidden">
                {/* Scan beam keyframe */}
                <style>{`
                @keyframes scan {
                    0%   { top: 0%; }
                    50%  { top: calc(100% - 3px); }
                    100% { top: 0%; }
                }
            `}</style>
                {/* Ambient blobs */}
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-600/8 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-blue-700/8 rounded-full blur-[120px] pointer-events-none" />
                {/* Dot grid */}
                <div className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(rgba(34,211,238,0.07) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="relative z-10 max-w-6xl mx-auto px-4 py-10">

                    {/* ── Header ── */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/80 via-cyan-950/40 to-slate-900/80 border border-cyan-500/20 p-7 md:p-10 mb-10">
                        <div className="absolute right-0 top-0 w-72 h-72 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                            {/* Glow icon */}
                            <div className="relative flex-shrink-0 w-20 h-20">
                                <div className="absolute inset-0 bg-cyan-500/40 rounded-2xl blur-lg animate-pulse" />
                                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-4xl">
                                    🩻
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 mb-3">
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                                    <span className="text-xs text-cyan-400 font-black tracking-widest uppercase">HealthHub AI · Radiology Engine</span>
                                </div>
                                <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-blue-200 mb-2 leading-tight">
                                    AI Medical Imaging Intelligence
                                </h1>
                                <p className="text-slate-400 text-sm max-w-xl">
                                    Upload any X-Ray, MRI, or CT scan. Our AI will analyse it and explain the results in plain, easy-to-understand language — no medical degree needed.
                                </p>
                            </div>
                            {phase !== 'upload' && (
                                <button onClick={reset}
                                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-sm font-black text-slate-300 hover:text-cyan-300 transition-all">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    New Scan
                                </button>
                            )}
                        </div>

                        {/* Scan type pills */}
                        <div className="flex gap-3 mt-8 flex-wrap">
                            {SCAN_TYPES.map(t => (
                                <button key={t}
                                    onClick={() => { if (phase === 'upload') setSelectedType(t); }}
                                    disabled={phase !== 'upload'}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-black transition-all duration-300 border
                                    ${selectedType === t
                                            ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border-cyan-400/60 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-cyan-500/30 hover:text-slate-200'
                                        } ${phase !== 'upload' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                    {t === 'X-Ray' ? '🦴' : t === 'MRI' ? '🧠' : '🫁'} {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ═══ UPLOAD PHASE ════════════════════════════════════════ */}
                    {phase === 'upload' && (
                        <div
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center py-28 px-8 text-center overflow-hidden group
                            ${isDragging
                                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02] shadow-[0_0_60px_rgba(34,211,238,0.2)]'
                                    : 'border-white/15 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:shadow-[0_0_40px_rgba(34,211,238,0.1)] bg-white/[0.03] backdrop-blur-xl'}`}>

                            {/* Corner brackets */}
                            {[['top-4 left-4', 'M0,18 L0,0 L18,0'], ['top-4 right-4', 'M18,18 L18,0 L0,0'], ['bottom-4 left-4', 'M0,0 L0,18 L18,18'], ['bottom-4 right-4', 'M18,0 L18,18 L0,18']].map(([pos, d], i) => (
                                <svg key={i} className={`absolute w-6 h-6 ${pos} text-cyan-500/40 group-hover:text-cyan-400/70 transition-colors duration-300`}
                                    viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={d} /></svg>
                            ))}
                            {/* Shimmer */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[2000ms] ease-in-out" />

                            <div className={`text-6xl mb-6 transition-transform duration-500 ${isDragging ? 'scale-125' : 'group-hover:scale-110'}`}>🩻</div>
                            <p className="text-2xl font-black text-white mb-2">
                                Drop your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">{selectedType}</span> scan here
                            </p>
                            <p className="text-slate-400 text-sm mb-8">or click to browse your files — PNG, JPG, DICOM supported</p>

                            <div className="flex gap-2 mb-8 flex-wrap justify-center">
                                {['PNG', 'JPG', 'JPEG', 'DICOM', 'TIFF'].map(ext => (
                                    <span key={ext} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-black text-slate-500">{ext}</span>
                                ))}
                            </div>

                            <button className="px-10 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-black rounded-2xl shadow-xl shadow-cyan-900/40 hover:shadow-cyan-500/30 transition-shadow">
                                Select {selectedType} Image
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </div>
                    )}

                    {/* ═══ ERROR PHASE ═════════════════════════════════════════ */}
                    {phase === 'error' && (
                        <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl border border-red-500/20 p-14 flex flex-col items-center text-center gap-6">
                            <div className="text-6xl">❌</div>
                            <div>
                                <p className="text-xl font-black text-white mb-2">Analysis Failed</p>
                                <p className="text-slate-400 text-sm max-w-sm">{errorMsg}</p>
                            </div>
                            <button onClick={reset} className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-2xl">Try Again</button>
                        </div>
                    )}

                    {/* ═══ SCANNING PHASE ══════════════════════════════════════ */}
                    {phase === 'scanning' && imageUrl && (
                        <div className="grid md:grid-cols-5 gap-8">
                            {/* ── Image with cinematic scanner ── */}
                            <div className="md:col-span-3 relative rounded-3xl overflow-hidden border border-cyan-500/25 bg-black/60 min-h-[420px]">
                                <img src={imageUrl} alt="scan" className="w-full h-full object-contain opacity-70 grayscale" />

                                {/* Dot-grid overlay */}
                                <div className="absolute inset-0 pointer-events-none"
                                    style={{ backgroundImage: 'radial-gradient(rgba(34,211,238,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                                {/* Primary scan beam */}
                                <div className="absolute left-0 right-0 pointer-events-none"
                                    style={{ height: '3px', background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.9) 20%, rgba(255,255,255,0.95) 50%, rgba(34,211,238,0.9) 80%, transparent 100%)', boxShadow: '0 0 20px rgba(34,211,238,0.8), 0 0 40px rgba(34,211,238,0.4)', animation: 'scan 2.2s ease-in-out infinite', top: 0 }} />

                                {/* Secondary faint beam */}
                                <div className="absolute left-0 right-0 pointer-events-none"
                                    style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.5) 50%, transparent 100%)', animation: 'scan 2.2s ease-in-out infinite', animationDelay: '-1.1s', top: 0 }} />

                                {/* Scan trail — faint glow below beam */}
                                <div className="absolute left-0 right-0 pointer-events-none"
                                    style={{ height: '80px', background: 'linear-gradient(180deg, rgba(34,211,238,0.06) 0%, transparent 100%)', animation: 'scan 2.2s ease-in-out infinite', top: 0 }} />

                                {/* Corner reticles */}
                                {[['top-3 left-3', 'M0,16 L0,0 L16,0'], ['top-3 right-3', 'M16,16 L16,0 L0,0'], ['bottom-3 left-3', 'M0,0 L0,16 L16,16'], ['bottom-3 right-3', 'M16,0 L16,16 L0,16']].map(([pos, d], i) => (
                                    <svg key={i} className={`absolute w-6 h-6 ${pos}`} viewBox="0 0 16 16" fill="none" stroke="#22d3ee" strokeWidth="1.5"
                                        style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}><path d={d} /></svg>
                                ))}

                                {/* Status chip */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-lg border border-cyan-400/40 text-cyan-300 text-[10px] font-black px-4 py-2 rounded-full flex items-center gap-2"
                                    style={{ boxShadow: '0 0 20px rgba(34,211,238,0.2)' }}>
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping absolute" />
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full" />
                                    AI SCANNING · {selectedType.toUpperCase()}
                                </div>

                                {/* Progress bar at bottom */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-5 py-3">
                                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">
                                        <span>Neural Analysis</span>
                                        <span className="text-cyan-400">{scanProgress}%</span>
                                    </div>
                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-150 ease-linear"
                                            style={{ width: `${scanProgress}%`, boxShadow: '0 0 10px rgba(34,211,238,0.5)' }} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Analysis stages panel ── */}
                            <div className="md:col-span-2 flex flex-col gap-4">
                                <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-5">Analysis Stages</p>
                                    <div className="space-y-3">
                                        {SCAN_STAGES.map((stage, i) => {
                                            const done = i < currentStage;
                                            const active = i === currentStage;
                                            return (
                                                <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-500 ${active ? 'bg-cyan-500/10 border border-cyan-500/30' : done ? 'bg-emerald-500/5 border border-emerald-500/20' : 'border border-white/[0.04]'}`}>
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm
                                                    ${done ? 'bg-emerald-500/20 text-emerald-300' : active ? 'bg-cyan-500/20 text-cyan-300 animate-pulse' : 'bg-white/5 text-slate-600'}`}>
                                                        {done ? '✓' : active ? '◉' : `${i + 1}`}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`font-black text-sm ${active ? 'text-cyan-200' : done ? 'text-emerald-300' : 'text-slate-600'}`}>
                                                            {stage.label}
                                                        </p>
                                                        {active && <p className="text-xs text-cyan-400/70 animate-pulse mt-0.5">{stage.sub}</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Metadata */}
                                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-5 space-y-3">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Scan Info</p>
                                    {[['Scan Type', selectedType], ['AI Engine', 'HealthHub AI Core™'], ['Model', 'Gemini Vision'], ['Mode', 'Plain-Language Analysis']].map(([k, v]) => (
                                        <div key={k} className="flex justify-between text-sm border-b border-white/[0.04] pb-2 last:border-0">
                                            <span className="text-slate-500">{k}</span>
                                            <span className="text-slate-200 font-black">{v}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Skeleton placeholders */}
                                <div className="space-y-3">
                                    {[80, 60, 40].map((w, i) => (
                                        <div key={i} className="bg-white/[0.04] border border-white/[0.05] rounded-2xl p-4 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-2 bg-white/10 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                                                <div className="h-2 bg-white/5 rounded-full animate-pulse w-2/5" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ RESULTS PHASE ═══════════════════════════════════════ */}
                    {phase === 'results' && aiResult && imageUrl && (() => {
                        const vs = verdictStyle!;
                        return (
                            <div className="space-y-8">
                                {/* ── Verdict Banner ── */}
                                <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${vs.gradient} border border-white/10 p-7 md:p-10 shadow-2xl ${vs.glow}`}>
                                    <div className="absolute right-6 top-6 text-6xl opacity-20 select-none">{vs.emoji}</div>
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                                        <HealthRing score={aiResult.healthScore ?? 70} active={scoreActive} />
                                        <div className="flex-1">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Overall Verdict</p>
                                            <h2 className={`text-3xl md:text-4xl font-black ${vs.text} mb-3`}>
                                                {vs.emoji} {aiResult.verdictLabel}
                                            </h2>
                                            <p className="text-slate-300 text-base leading-relaxed max-w-2xl">{aiResult.plainSummary}</p>
                                            <div className="flex gap-4 mt-5 flex-wrap">
                                                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Urgency</p>
                                                    <p className={`font-black text-sm ${vs.text}`}>{aiResult.urgencyLevel}</p>
                                                </div>
                                                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Follow-Up</p>
                                                    <p className="font-black text-sm text-slate-200">{aiResult.followUp}</p>
                                                </div>
                                                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Findings</p>
                                                    <p className="font-black text-sm text-slate-200">{aiResult.findings.length} detected</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-5 gap-8">
                                    {/* ── Left: image thumbnail + action plan ── */}
                                    <div className="md:col-span-2 flex flex-col gap-5">
                                        {/* Thumbnail */}
                                        <div className="relative rounded-3xl overflow-hidden border border-cyan-500/20 bg-black/50 min-h-[260px]">
                                            <img src={imageUrl} alt="scan" className="w-full h-full object-contain grayscale opacity-75" />
                                            <div className="absolute inset-0 pointer-events-none"
                                                style={{ backgroundImage: 'radial-gradient(rgba(34,211,238,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                                            <div className="absolute top-[30%] left-[40%] w-14 h-10 bg-amber-400/20 rounded-full blur-xl animate-pulse" />
                                            <div className="absolute top-[50%] right-[25%] w-10 h-8 bg-cyan-400/15 rounded-full blur-lg animate-pulse" style={{ animationDelay: '0.7s' }} />
                                            <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-[10px] font-black px-3 py-2 rounded-xl flex items-center gap-2">
                                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                                AI Analysis Complete · {aiResult.findings.length} findings
                                            </div>
                                        </div>

                                        {/* Action plan */}
                                        <div className="bg-white/[0.04] backdrop-blur-xl border border-blue-500/20 rounded-3xl overflow-hidden">
                                            <button onClick={() => setActionOpen(p => !p)}
                                                className="w-full flex items-center justify-between px-6 py-5 text-left">
                                                <span className="font-black text-blue-200 flex items-center gap-2 text-sm">
                                                    📋 Your Action Plan
                                                    <span className="text-xs text-blue-400/60 font-normal">{aiResult.actionPlan.length} steps</span>
                                                </span>
                                                <svg className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${actionOpen ? 'rotate-180' : ''}`}
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            <div className={`transition-all duration-500 overflow-hidden ${actionOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
                                                <ul className="px-6 pb-6 pt-2 space-y-3 border-t border-blue-500/10">
                                                    {aiResult.actionPlan.map((step, i) => (
                                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-300 bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                                                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/30 text-blue-300 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                                                            <span className="leading-relaxed">{step}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Key: how to read cards */}
                                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-5">
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">How to Read the Findings</p>
                                            <div className="space-y-2">
                                                {[
                                                    { icon: '🟢', label: 'Looks Normal', desc: 'Nothing to worry about' },
                                                    { icon: '🟡', label: 'Worth Monitoring', desc: 'Keep an eye on this' },
                                                    { icon: '🔴', label: 'Needs Attention', desc: 'Talk to a doctor soon' },
                                                ].map(item => (
                                                    <div key={item.label} className="flex items-center gap-3">
                                                        <span className="text-xl">{item.icon}</span>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-300">{item.label}</p>
                                                            <p className="text-[10px] text-slate-500">{item.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-slate-600 mt-4 leading-relaxed">
                                                💡 Tap any finding card to expand and read a full plain-English explanation.
                                            </p>
                                        </div>
                                    </div>

                                    {/* ── Right: finding cards ── */}
                                    <div className="md:col-span-3 space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-lg font-black text-white">What We Found</h3>
                                            <span className="text-xs text-slate-600 font-mono">Tap a card to learn more ↓</span>
                                        </div>
                                        {aiResult.findings.map((f, i) => (
                                            <FindingCard key={i} f={f} idx={i} show={phase === 'results'} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ═══ NEARBY IMAGING CENTERS ══════════════════════════════ */}
                    <div className="mt-12">
                        {/* Section header */}
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/80 via-indigo-950/40 to-slate-900/80 border border-indigo-500/20 p-7 mb-6">
                            <div className="absolute right-0 top-0 w-56 h-56 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative flex flex-col md:flex-row md:items-center gap-5">
                                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-indigo-400/40 flex items-center justify-center text-3xl">📍</div>
                                <div className="flex-1">
                                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-2">
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-indigo-400 font-black tracking-widest uppercase">Real-Time Location Search</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-white mb-1">Find Nearby Imaging Centers</h2>
                                    <p className="text-slate-400 text-sm">Locate hospitals and clinics offering CT Scan, MRI, and X-Ray services near you.</p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="relative mt-6 flex flex-col md:flex-row gap-3">
                                {/* GPS button */}
                                <button
                                    onClick={fetchCentersGPS}
                                    disabled={locStatus === 'locating' || locStatus === 'fetching'}
                                    className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black rounded-2xl border border-indigo-400/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-transform shadow-lg shadow-indigo-900/40"
                                >
                                    {locStatus === 'locating' ? (
                                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Getting Location…</>
                                    ) : (
                                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Use My Location</>
                                    )}
                                </button>

                                {/* Manual search */}
                                <form onSubmit={fetchCentersManual} className="flex flex-1 gap-2">
                                    <div className="relative flex-1">
                                        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            value={locQuery}
                                            onChange={e => setLocQuery(e.target.value)}
                                            placeholder="Enter city name, e.g. Mumbai…"
                                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all"
                                        />
                                    </div>
                                    <button type="submit"
                                        disabled={locStatus === 'fetching'}
                                        className="px-5 py-3 bg-white/5 border border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/10 rounded-2xl text-sm font-black text-slate-300 hover:text-indigo-300 transition-all disabled:opacity-50">
                                        Search
                                    </button>
                                </form>
                            </div>

                            {/* Service type filter */}
                            {locStatus === 'done' && centers.length > 0 && (
                                <div className="relative flex gap-2 mt-4 flex-wrap">
                                    {(['All', 'CT Scan', 'MRI', 'X-Ray'] as const).map(s => (
                                        <button key={s} onClick={() => setServiceFilter(s)}
                                            className={`px-4 py-2 rounded-full text-xs font-black transition-all duration-300 border
                                            ${serviceFilter === s
                                                    ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-200 shadow-[0_0_16px_rgba(99,102,241,0.2)]'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-indigo-500/30'}`}>
                                            {s === 'CT Scan' ? '🫁' : s === 'MRI' ? '🧠' : s === 'X-Ray' ? '🦴' : '📋'} {s}
                                        </button>
                                    ))}
                                    <span className="ml-auto text-xs text-slate-500 self-center">{filteredCenters.length} result{filteredCenters.length !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>

                        {/* States */}
                        {(locStatus === 'locating' || locStatus === 'fetching') && (
                            <div className="flex flex-col items-center justify-center gap-4 py-16 bg-white/[0.03] border border-white/[0.06] rounded-3xl">
                                <div className="relative w-16 h-16">
                                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10" />
                                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-400 animate-spin" style={{ animationDuration: '1s' }} />
                                    <div className="absolute inset-0 flex items-center justify-center text-2xl">📍</div>
                                </div>
                                <p className="text-sm text-indigo-300 font-black animate-pulse">
                                    {locStatus === 'locating' ? 'Acquiring your location…' : 'Searching for imaging centers…'}
                                </p>
                            </div>
                        )}

                        {locStatus === 'error' && (
                            <div className="bg-red-500/8 border border-red-500/20 rounded-3xl p-8 flex flex-col items-center text-center gap-3">
                                <span className="text-4xl">⚠️</span>
                                <p className="font-black text-white">Search Failed</p>
                                <p className="text-sm text-slate-400 max-w-sm">{locError}</p>
                            </div>
                        )}

                        {locStatus === 'done' && filteredCenters.length === 0 && (
                            <div className="bg-white/[0.03] border border-white/[0.06] rounded-3xl p-10 flex flex-col items-center text-center gap-3">
                                <span className="text-4xl">🔍</span>
                                <p className="font-black text-white">No centers found</p>
                                <p className="text-sm text-slate-400">Try a different city or remove the service filter.</p>
                            </div>
                        )}

                        {/* Center cards grid */}
                        {locStatus === 'done' && filteredCenters.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredCenters.map((center, i) => (
                                    <div key={i}
                                        className="group bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-300 flex flex-col gap-4"
                                        style={{ animationDelay: `${i * 60}ms` }}>
                                        {/* Center name + rating */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-lg flex-shrink-0">🏥</div>
                                                <div>
                                                    <p className="font-black text-white text-sm leading-snug">{center.name}</p>
                                                    {center.rating && center.rating > 0 && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <svg key={s} className={`w-3 h-3 ${s <= Math.round(center.rating!) ? 'text-amber-400 fill-current' : 'text-slate-700'}`} viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                            ))}
                                                            <span className="text-[10px] text-amber-400 font-black ml-1">{center.rating.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Service badges */}
                                        {center.services && center.services.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {center.services.map(svc => (
                                                    <span key={svc} className={`text-[10px] font-black px-2.5 py-1 rounded-full border
                                                    ${svc === 'CT Scan' ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' :
                                                            svc === 'MRI' ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' :
                                                                'bg-amber-500/15 border-amber-500/30 text-amber-300'}`}>
                                                        {svc === 'CT Scan' ? '🫁' : svc === 'MRI' ? '🧠' : '🦴'} {svc}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Address */}
                                        <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
                                            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {center.address}
                                        </p>

                                        {/* CTA */}
                                        <a href={center.mapsUri} target="_blank" rel="noopener noreferrer"
                                            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 hover:border-indigo-400/50 rounded-xl text-sm font-black text-indigo-300 hover:text-indigo-200 transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                            Get Directions
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <HealthChatbot
                accent="cyan"
                contextSummary={
                    aiResult
                        ? `Scan type: ${selectedType}. Verdict: ${aiResult.verdictLabel}. Health score: ${aiResult.healthScore}/100. Summary: ${aiResult.plainSummary}. Findings: ${aiResult.findings.map(f => `${f.simpleTitle} (${f.severity} severity) — ${f.simpleExplanation}`).join('; ')}.`
                        : undefined
                }
                suggestedQuestions={[
                    'What does my scan result mean in simple terms?',
                    'Should I be worried about the findings?',
                    'What follow-up steps should I take?',
                    'Is this condition treatable?',
                    'How serious is my health score?',
                ]}
            />
        </>
    );
};

export default MedicalImaging;

