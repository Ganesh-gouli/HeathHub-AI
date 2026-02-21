import React, { useState, useEffect, useCallback } from 'react';
import BodyComponent from 'react-body-highlighter';
import { useAppContext } from '../context/AppContext';
import { analyzeDrugImpact } from '../services/geminiService';
import { DrugAnalysisResult } from '../types';
import { ICONS } from '../constants';

const DrugImpactVisualizer: React.FC = () => {
    const { navigateTo } = useAppContext();
    const [drugName, setDrugName] = useState('');
    const [dosage, setDosage] = useState('');
    const [age, setAge] = useState<number | ''>('');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<DrugAnalysisResult | null>(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);

    // Map AI organs to react-body-highlighter parts
    const organMap: Record<string, string[]> = {
        'Brain': ['head'],
        'Heart': ['chest'],
        'Liver': ['abdomen'],
        'Kidney': ['back'],
        'Lungs': ['chest'],
        'Stomach': ['abdomen'],
        'Nervous System': ['head', 'chest', 'abdomen', 'back', 'left-arm', 'right-arm', 'left-leg', 'right-leg']
    };

    // Colors for different systems/organs
    const organColors: Record<string, string> = {
        'Brain': '#A855F7', // Purple
        'Heart': '#EF4444', // Red
        'Liver': '#F97316', // Orange
        'Kidney': '#EAB308', // Yellow
        'Lungs': '#3B82F6', // Blue
        'Stomach': '#22C55E', // Green
        'Nervous System': '#EC4899' // Pink/Pulsing
    };

    const handleAnalyze = async () => {
        if (!drugName.trim()) return;

        setIsLoading(true);
        setScanning(true);
        setError(null);
        setResult(null);
        setSelectedOrgan(null);

        try {
            const data = await analyzeDrugImpact(drugName, dosage, age || undefined);
            setResult(data);
        } catch (err) {
            console.error("Analysis failed:", err);
            setError("Failed to analyze drug. Please try again.");
        } finally {
            setIsLoading(false);
            setScanning(false);
        }
    };

    const getHighlightedData = useCallback(() => {
        if (!result) return [];

        const data: any[] = [];
        result.primary_organs.forEach(organ => {
            const parts = organMap[organ];
            if (parts) {
                parts.forEach(part => {
                    data.push({
                        name: part,
                        color: organColors[organ] || '#ffffff'
                    });
                });
            }
        });
        return data;
    }, [result]);

    const handleOrganClick = (part: string) => {
        if (!result) return;

        // Find which organ this part belongs to in the AI result
        const organ = result.primary_organs.find(o => organMap[o]?.includes(part));
        if (organ) {
            setSelectedOrgan(organ);
        }
    };

    return (
        <div className="relative min-h-screen text-white pb-20 overflow-hidden font-sans">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-900 to-black"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-8 space-y-8 animate-fade-in">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigateTo('DASHBOARD')}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                    >
                        <span className="group-hover:-translate-x-1 block transition-transform">{ICONS.arrowLeft}</span>
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tighter">
                            Drug <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-purple-400">Impact Visualizer</span>
                        </h1>
                        <p className="text-blue-100/60 font-medium">AI-powered pharmacological analysis & visualization</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT PANEL: Inputs */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-purple-500"></div>

                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span className="p-2 rounded-lg bg-rose-500/20 text-rose-400">{ICONS.diet}</span>
                                Analysis Parameters
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-blue-200/50 uppercase tracking-widest mb-1.5 ml-1">Drug Name</label>
                                    <input
                                        type="text"
                                        value={drugName}
                                        onChange={(e) => setDrugName(e.target.value)}
                                        placeholder="e.g., Ibuprofen, Metformin"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all placeholder:text-white/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-200/50 uppercase tracking-widest mb-1.5 ml-1">Dosage (Optional)</label>
                                    <input
                                        type="text"
                                        value={dosage}
                                        onChange={(e) => setDosage(e.target.value)}
                                        placeholder="e.g., 400mg"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all placeholder:text-white/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-200/50 uppercase tracking-widest mb-1.5 ml-1">Age (Optional)</label>
                                    <input
                                        type="number"
                                        value={age}
                                        onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
                                        placeholder="e.g., 25"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all placeholder:text-white/20"
                                    />
                                </div>

                                <button
                                    onClick={handleAnalyze}
                                    disabled={isLoading || !drugName}
                                    className="w-full py-4 mt-4 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-white shadow-lg shadow-rose-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 overflow-hidden relative group"
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                    {isLoading ? (
                                        <div className="flex items-center gap-2 relative z-10">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Analyzing...</span>
                                        </div>
                                    ) : (
                                        <span className="relative z-10">Run Impact Analysis</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium animate-shake">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* CENTER PANEL: 3D Body Visualization */}
                    <div className="lg:col-span-5 relative flex flex-col items-center justify-center min-h-[500px]">
                        <div className="absolute top-4 right-4 z-20 flex bg-white/5 backdrop-blur-md rounded-xl p-1 border border-white/10">
                            {(['male', 'female'] as const).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGender(g)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${gender === g ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>

                        <div className={`relative w-full h-full flex items-center justify-center transition-all duration-1000 ${scanning ? 'scale-105 filter blur-[1px]' : 'scale-100'}`}>
                            <div className="w-full max-w-[400px] animate-float drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-500">
                                <BodyComponent
                                    data={getHighlightedData()}
                                    type={gender as any}
                                    onClick={(obj: any) => handleOrganClick(obj.muscle || obj.name || obj)}
                                />
                            </div>

                            {/* Scanning Animation Overlay */}
                            {scanning && (
                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_20px_#f43f5e] animate-scan"></div>
                                    <div className="absolute inset-0 bg-rose-500/5 animate-pulse-slow"></div>
                                </div>
                            )}

                            {/* HUD Elements */}
                            <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-3xl">
                                <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-white/20"></div>
                                <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-white/20"></div>
                                <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-white/20"></div>
                                <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-white/20"></div>
                            </div>
                        </div>

                        {/* Organ Detail Popup */}
                        {selectedOrgan && result && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[90%] bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 animate-slide-up shadow-2xl">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-lg font-bold flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: organColors[selectedOrgan] }}></div>
                                        {selectedOrgan} Impact
                                    </h4>
                                    <button onClick={() => setSelectedOrgan(null)} className="text-white/40 hover:text-white">✕</button>
                                </div>
                                <p className="text-sm text-blue-100/70 leading-relaxed">
                                    {result.detailed_explanation.split(selectedOrgan)[1]?.split('.')[0]?.trim() || result.mechanism}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL: Results */}
                    <div className="lg:col-span-4 space-y-6">
                        {result ? (
                            <div className="space-y-6 animate-fade-in">
                                {/* Overview Card */}
                                <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-2xl font-black text-white">{result.drug_name}</h3>
                                            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-widest text-blue-300 border border-white/10">{result.category}</span>
                                        </div>
                                        <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${result.risk_level === 'High' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            result.risk_level === 'Moderate' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                'bg-green-500/20 text-green-400 border border-green-500/30'
                                            }`}>
                                            Risk: {result.risk_level}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <div>
                                            <h4 className="text-[10px] font-bold text-blue-200/40 uppercase tracking-widest mb-1.5">Mechanism of Action</h4>
                                            <p className="text-sm text-blue-100/80 leading-relaxed font-medium">{result.mechanism}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Lists */}
                                <div className="grid grid-cols-1 gap-4">
                                    <DetailList title="Affected Systems" items={result.primary_organs} icon="🟢" />
                                    <DetailList title="Short-Term Effects" items={result.short_term_effects} icon="⚡" />
                                    <DetailList title="Long-Term Risks" items={result.long_term_effects} icon="⚠️" />
                                    <DetailList title="Common Side Effects" items={result.side_effects} icon="💊" />
                                    <DetailList title="Contraindications" items={result.contraindications} icon="⛔" red />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 border-dashed">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-white/20">
                                    {ICONS.chatbot}
                                </div>
                                <h3 className="text-lg font-bold text-white/40">Ready for Analysis</h3>
                                <p className="text-sm text-white/20 mt-2">Enter a drug name and click Analyze to visualize its impact on the body.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Safety Disclaimer */}
                <div className="mt-8 p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center">
                    <p className="text-xs text-blue-100/40 leading-relaxed max-w-3xl mx-auto">
                        <span className="font-bold text-blue-300">SAFETY DISCLAIMER:</span> This AI-based drug analysis is for educational and research purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or medication.
                    </p>
                </div>
            </div>

            {/* Global Animations CSS */}
            <style>{`
                @keyframes scan {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(400px); }
                }
                .animate-scan {
                    animation: scan 3s linear infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-float {
                    animation: float 4s ease-in-out infinite;
                }
                @keyframes slideUp {
                    from { transform: translate(-50%, 20px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.3s ease-out forwards;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.1; }
                    50% { opacity: 0.2; }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 3s ease-in-out infinite;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.4s ease-in-out;
                }
            `}</style>
        </div>
    );
};

const DetailList: React.FC<{ title: string; items: string[]; icon: string; red?: boolean }> = ({ title, items, icon, red }) => (
    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
        <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${red ? 'text-rose-400' : 'text-blue-200/40'}`}>
            <span>{icon}</span>
            {title}
        </h4>
        <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${red ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 group-hover:bg-rose-500/20' :
                    'bg-white/5 border-white/10 text-white/70 group-hover:bg-white/10'
                    }`}>
                    {item}
                </span>
            ))}
        </div>
    </div>
);

export default DrugImpactVisualizer;
