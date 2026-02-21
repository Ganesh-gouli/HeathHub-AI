import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { ICONS, LANGUAGES } from '../constants';
import { TRANSLATIONS } from '../constants/translations';
import { Page } from '../types';
import { generateHealthTip } from '../services/geminiService';
import { getErrorMessage, calculateMaintenanceCalories } from '../utils/helpers';
import { sendDailyReport } from '../services/emailService';
import MedicalModel3D from '../components/MedicalModel3D';

interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    page: Page;
    colorClass: string;
    gradient: string;
}

// Memoized FeatureCard Component with Premium Glassmorphism
const FeatureCard = React.memo(({ title, description, icon, onClick, colorClass, gradient }: FeatureCardProps & { onClick: () => void }) => (
    <div
        className="group relative overflow-hidden rounded-3xl p-6 cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10"
        onClick={onClick}
    >
        {/* Hover Gradient Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
        {/* Glow Effect */}
        <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-3xl group-hover:opacity-30 transition-all duration-500 group-hover:scale-125`}></div>

        <div className="relative z-10 flex flex-col h-full">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg ${colorClass} text-white transform group-hover:scale-110 transition-transform duration-300 ring-4 ring-white/10`}>
                {React.cloneElement(icon as React.ReactElement<any>, {
                    className: "w-7 h-7",
                    strokeWidth: 2
                })}
            </div>

            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all">
                {title}
            </h3>
            <p className="text-sm text-blue-100/70 leading-relaxed mb-4 flex-grow font-medium">
                {description}
            </p>

            <div className="flex items-center text-xs font-bold text-white uppercase tracking-wider opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                <span>Explore</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            </div>
        </div>
    </div>
));

const Dashboard: React.FC = () => {
    const { user, dailyLog, logHistory, navigateTo, healthTipData, setHealthTipData, language, setLanguage, isHistoryLoading, historyError } = useAppContext();
    const [tipError, setTipError] = useState('');
    const [isTipLoading, setIsTipLoading] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const t = TRANSLATIONS[language] || TRANSLATIONS['English'];

    // Health Tip Speech Synthesis State
    const [isTipSpeaking, setIsTipSpeaking] = useState(false);
    const tipUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    // Effect for speech synthesis setup
    useEffect(() => {
        const handleVoicesChanged = () => {
            setVoices(speechSynthesis.getVoices());
        };
        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        handleVoicesChanged(); // Initial load

        const utterance = new SpeechSynthesisUtterance();
        utterance.onstart = () => setIsTipSpeaking(true);
        utterance.onend = () => setIsTipSpeaking(false);
        utterance.onerror = (e) => {
            if (e.error !== 'interrupted') {
                console.error("Speech synthesis error:", e.error);
            }
            setIsTipSpeaking(false);
        };
        tipUtteranceRef.current = utterance;

        return () => {
            speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
            speechSynthesis.cancel();
        };
    }, []);

    // Effect for fetching health tip - USES LOCAL STORAGE CACHING
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `healthTip_${today}_${language}`;
        const cachedTip = localStorage.getItem(cacheKey);

        // 1. If we have a cached tip for TODAY and THIS LANGUAGE, use it.
        if (cachedTip) {
            setHealthTipData({ text: cachedTip, language: language });
            setIsTipLoading(false);
            setTipError('');
            return;
        }

        // 2. If already loaded in context (e.g. from navigation), don't refetch
        if (healthTipData && healthTipData.language === language) {
            setIsTipLoading(false);
            setTipError('');
            return;
        }

        // 3. Otherwise, fetch from API
        setIsTipLoading(true);
        setTipError('');
        speechSynthesis.cancel();

        generateHealthTip(language)
            .then(tip => {
                setHealthTipData({ text: tip, language: language });
                // Cache the new tip
                localStorage.setItem(cacheKey, tip);
            })
            .catch(err => {
                console.error("Failed to generate health tip:", err);
                const errorMsg = getErrorMessage(err);

                // Fallback for overloaded model
                if (errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.includes("Overloaded")) {
                    const fallbackTip = "Stay hydrated! Drinking water is the easiest way to stay healthy today."; // Simple fallback
                    setHealthTipData({ text: fallbackTip, language: language });
                    localStorage.setItem(cacheKey, fallbackTip); // Cache fallback to stop retries
                } else {
                    setTipError(errorMsg);
                }
            })
            .finally(() => setIsTipLoading(false));
    }, [language, healthTipData, setHealthTipData]);

    const healthTip = healthTipData?.text || '';

    const handleToggleTipSpeech = () => {
        if (!tipUtteranceRef.current || !healthTip) return;

        if (isTipSpeaking) {
            speechSynthesis.cancel();
        } else {
            tipUtteranceRef.current.text = healthTip;
            const langCodeMap: { [key: string]: string } = {
                'English': 'en-US', 'Hindi': 'hi-IN', 'Kannada': 'kn-IN', 'Tamil': 'ta-IN',
                'Telugu': 'te-IN', 'Bengali': 'bn-IN', 'Marathi': 'mr-IN', 'Gujarati': 'gu-IN'
            };
            const langCode = langCodeMap[language] || 'en-US';
            tipUtteranceRef.current.lang = langCode;
            const bestVoice = voices.find(v => v.lang === langCode) || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
            tipUtteranceRef.current.voice = bestVoice || null;
            speechSynthesis.speak(tipUtteranceRef.current);
        }
    };

    const features: FeatureCardProps[] = [
        { title: t.features.diet_plan.title, description: t.features.diet_plan.desc, icon: ICONS.diet, page: 'DIET_PLANNER', colorClass: 'bg-emerald-500', gradient: 'from-emerald-400 to-teal-600' },
        { title: t.features.report_analyzer.title, description: t.features.report_analyzer.desc, icon: ICONS.report, page: 'REPORT_ANALYZER', colorClass: 'bg-blue-500', gradient: 'from-blue-400 to-indigo-600' },
        { title: t.features.calorie_counter.title, description: t.features.calorie_counter.desc, icon: ICONS.flame, page: 'CALORIE_COUNTER', colorClass: 'bg-orange-500', gradient: 'from-orange-400 to-red-600' },
        { title: t.features.exercise_corner.title, description: t.features.exercise_corner.desc, icon: ICONS.exercise, page: 'EXERCISE_CORNER', colorClass: 'bg-purple-500', gradient: 'from-purple-400 to-pink-600' },
        { title: "Gym Management", description: "Build your perfect workout routine.", icon: ICONS.dumbbell, page: 'GYM_MANAGEMENT', colorClass: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' },
        { title: t.features.todays_goal.title, description: t.features.todays_goal.desc, icon: ICONS.goal, page: 'TODAYS_GOAL', colorClass: 'bg-indigo-500', gradient: 'from-indigo-400 to-violet-600' },
        { title: t.features.health_services.title, description: t.features.health_services.desc, icon: ICONS.mapPin, page: 'LOCATION_TRACKER', colorClass: 'bg-rose-500', gradient: 'from-rose-400 to-red-600' },
        { title: "Activity Tracker", description: "Track your steps and calories in real-time.", icon: ICONS.exercise, page: 'ACTIVITY_TRACKER', colorClass: 'bg-cyan-500', gradient: 'from-cyan-400 to-blue-600' },
        { title: "Skin Disease Detector", description: "AI-powered skin condition analysis & nearby dermatologist finder.", icon: ICONS.skin, page: 'SKIN_DISEASE_DETECTOR', colorClass: 'bg-pink-500', gradient: 'from-pink-400 to-rose-600' },
        { title: "Medical Imaging AI", description: "Upload X-Ray, MRI, or CT scans for real-time AI-powered diagnostic analysis.", icon: ICONS.image, page: 'MEDICAL_IMAGING', colorClass: 'bg-sky-500', gradient: 'from-sky-400 to-cyan-600' },
    ];

    // Memoized Calculations
    const chartData = React.useMemo(() => {
        if (!Array.isArray(logHistory)) return [];
        return logHistory.map(log => ({
            ...log,
            caloriesIn: Number(log?.caloriesIn || 0),
            caloriesOut: Number(log?.caloriesOut || 0),
            name: log?.date ? new Date(log.date).toLocaleString('en-US', { weekday: 'short' }) : '?',
        }));
    }, [logHistory]);

    const maintenanceCalories = React.useMemo(() => user ? calculateMaintenanceCalories(user) : 2000, [user]);

    // Filter foods by source
    const intakeFoods = React.useMemo(() => dailyLog.loggedFoods.filter(f => f.source === 'counter'), [dailyLog.loggedFoods]);
    const targetFoods = React.useMemo(() => dailyLog.loggedFoods.filter(f => f.source === 'plan'), [dailyLog.loggedFoods]);

    // Calculate totals based on source
    const consumedCalories = React.useMemo(() => intakeFoods.reduce((sum, food) => sum + food.calories, 0), [intakeFoods]);
    const plannedCalories = React.useMemo(() => targetFoods.reduce((sum, food) => sum + food.calories, 0), [targetFoods]);

    const progress = React.useMemo(() => Math.min((consumedCalories / maintenanceCalories) * 100, 100), [consumedCalories, maintenanceCalories]);
    const netCalories = React.useMemo(() => consumedCalories - dailyLog.caloriesOut, [consumedCalories, dailyLog.caloriesOut]);

    const handleSendReport = async () => {
        if (!user || !user.email) {
            alert("No email address found for user.");
            return;
        }
        setIsSendingEmail(true);
        setEmailStatus('idle');
        try {
            await sendDailyReport(user.email, {
                intake: consumedCalories,
                burned: dailyLog.caloriesOut,
                net: netCalories,
                date: dailyLog.date,
                foods: intakeFoods
            });
            setEmailStatus('success');
            setTimeout(() => setEmailStatus('idle'), 3000);
        } catch (error: any) {
            console.error("Email failed", error);
            setEmailStatus('error');

            // Check for connection error (Server not running)
            if (error.message && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
                alert("❌ Connection Failed!\n\nPlease ensure the BACKEND SERVER is running.\nRun 'node server.js' in a new terminal.");
            } else {
                alert(`❌ Email Failed: ${error.message || "Unknown error"}`);
            }
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <div className="relative min-h-screen text-white pb-20 overflow-hidden font-sans selection:bg-cyan-500 selection:text-white bg-slate-900">

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-900 to-black"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-8 pt-8 space-y-10 animate-fade-in">
                {/* Hero Section with 3D Model */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 items-center">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                            <div>
                                <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-2 leading-tight">
                                    {t.hello}, <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{user?.name}</span>
                                </h2>
                                <p className="text-xl text-blue-100/70 font-light max-w-lg">{t.subtitle}</p>
                            </div>
                        </div>

                        {/* Health Tip Banner */}
                        <div className="relative overflow-hidden rounded-3xl shadow-2xl group border border-white/10 mt-8 max-w-2xl bg-white/5 backdrop-blur-xl">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent"></div>

                            <div className="relative p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
                                <div className="flex-shrink-0 p-3 bg-blue-500/20 rounded-xl">
                                    {React.cloneElement(ICONS.lightbulb as React.ReactElement<any>, { className: "w-6 h-6 text-cyan-300" })}
                                </div>

                                <div className="flex-grow space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                                            {t.daily_insight}
                                        </span>
                                        {isTipLoading && <span className="text-blue-200 text-xs animate-pulse font-mono">{t.generating}</span>}
                                    </div>

                                    {tipError ? (
                                        <p className="text-red-200 text-sm font-medium">{tipError}</p>
                                    ) : (
                                        <p className="text-lg font-medium text-blue-50 leading-relaxed">
                                            "{healthTip || t.generating}"
                                        </p>
                                    )}
                                </div>

                                {!isTipLoading && healthTip && (
                                    <button
                                        onClick={handleToggleTipSpeech}
                                        className="flex-shrink-0 p-3 hover:bg-white/10 rounded-full transition-all duration-300 group-hover:scale-110 active:scale-95"
                                        title={isTipSpeaking ? t.stop : t.listen}
                                    >
                                        {isTipSpeaking ?
                                            <span className="animate-pulse text-cyan-400">{ICONS.speakerOff}</span> :
                                            <span className="text-blue-300">{ICONS.speaker}</span>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Control Bar */}
                        <div className="flex flex-wrap items-center gap-4 mt-6">
                            <button
                                onClick={handleSendReport}
                                disabled={isSendingEmail || emailStatus === 'success'}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md ${emailStatus === 'success'
                                    ? 'bg-green-500/20 text-green-200 border-green-500/30'
                                    : emailStatus === 'error'
                                        ? 'bg-red-500/20 text-red-200 border-red-500/30 hover:bg-red-500/30'
                                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-cyan-500/30 hover:-translate-y-1'
                                    }`}
                            >
                                {isSendingEmail ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Sending...</span>
                                    </>
                                ) : emailStatus === 'success' ? (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        <span>Sent!</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                        <span>Email Report</span>
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                                <span className="text-xs font-bold text-blue-300 ml-2">{t.language}:</span>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer py-1 pr-2 pl-2 hover:text-cyan-300 transition-colors [&>option]:text-gray-900"
                                >
                                    {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3D Model Container */}
                    <div className="lg:col-span-1 h-[400px] lg:h-[500px] relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50 z-0 rounded-full blur-3xl"></div>
                        <MedicalModel3D />
                        <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
                            <span className="text-xs font-mono text-cyan-500/50 uppercase tracking-[0.2em] animate-pulse">System Status: Online</span>
                        </div>
                    </div>
                </div>

                {/* Feature Grid */}
                <div>
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="w-1.5 h-8 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-full"></span>
                            Quick Actions
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map(feature => <FeatureCard key={feature.page} {...feature} onClick={() => navigateTo(feature.page)} />)}
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Today's Intake (Calorie Counter) */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                {React.cloneElement(ICONS.flame as React.ReactElement<any>, { className: "w-24 h-24 text-white" })}
                            </div>

                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <h3 className="text-xl font-bold text-white">{t.todays_intake}</h3>
                                <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-gray-300 border border-white/10">
                                    {t.goal}: {maintenanceCalories.toFixed(0)}
                                </div>
                            </div>

                            <div className="relative mb-8 z-10">
                                <div className="flex items-baseline justify-center mb-4">
                                    <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-sm">
                                        {consumedCalories.toFixed(0)}
                                    </span>
                                    <span className="text-lg text-gray-400 font-medium ml-2">kcal</span>
                                </div>

                                <div className="h-4 w-full bg-gray-700/50 rounded-full overflow-hidden p-0.5 shadow-inner border border-white/5">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_20px_rgba(52,211,153,0.5)] transition-all duration-1000 ease-out relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-gray-400 mt-3 font-medium">{progress.toFixed(0)}% {t.of_daily_goal}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">{t.burned}</p>
                                    <p className="text-xl font-black text-white">{dailyLog.caloriesOut.toFixed(0)}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">{t.net}</p>
                                    <p className="text-xl font-black text-white">{netCalories.toFixed(0)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Intake List */}
                        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/10 flex-grow flex flex-col h-[400px]">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {t.consumed}
                            </h3>
                            {intakeFoods.length > 0 ? (
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                                    {intakeFoods.map((food, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-200 group-hover:text-white transition-colors text-sm">{food.name}</span>
                                            </div>
                                            <span className="font-bold text-emerald-400 text-sm">
                                                {food.calories.toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                    <p className="text-sm font-medium">{t.no_intake}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Middle Section - Graphs & Trends */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        {/* Graph */}
                        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/10 flex flex-col h-full min-h-[500px]">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                                    {t.activity_trends}
                                </h3>
                                <div className="flex items-center space-x-4 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                    <div className="flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-lg shadow-sm">
                                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#10B981]"></span>
                                        <span className="text-xs font-bold text-gray-300">{t.intake}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 px-3 py-1">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#F97316]"></span>
                                        <span className="text-xs font-bold text-gray-400">{t.burned}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-grow relative">
                                {isHistoryLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-xl z-20">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    </div>
                                )}
                                {historyError ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                        <div className="bg-red-500/10 p-4 rounded-full mb-3">
                                            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </div>
                                        <p className="text-red-200 font-medium mb-1">Failed to load activity data</p>
                                        <p className="text-xs text-red-300/70 mb-3">{historyError}</p>
                                        <p className="text-xs text-blue-200">Try running: <code className="bg-black/30 px-1 py-0.5 rounded">node server.js</code> in terminal</p>
                                    </div>
                                ) : chartData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <p className="mb-2">No activity data yet</p>
                                        <p className="text-sm">Log your first meal or workout!</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }} barGap={6}>
                                            <defs>
                                                <linearGradient id="dashboardGraphColorIn" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                                                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                                                </linearGradient>
                                                <linearGradient id="dashboardGraphColorOut" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.8} />
                                                    <stop offset="100%" stopColor="#F97316" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                                                axisLine={{ stroke: '#4B5563' }}
                                                tickLine={{ stroke: '#4B5563' }}
                                                dy={10}
                                            />
                                            <YAxis
                                                tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                                                axisLine={{ stroke: '#4B5563' }}
                                                tickLine={{ stroke: '#4B5563' }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                contentStyle={{
                                                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                                    borderColor: 'rgba(255,255,255,0.1)',
                                                    borderRadius: '16px',
                                                    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
                                                    color: '#F3F4F6',
                                                    padding: '12px',
                                                    backdropFilter: 'blur(12px)',
                                                }}
                                                itemStyle={{ fontWeight: 600 }}
                                            />
                                            <Bar dataKey="caloriesIn" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="caloriesOut" fill="#F97316" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Today's Target (Diet Plan) */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                {React.cloneElement(ICONS.diet as React.ReactElement<any>, { className: "w-24 h-24 text-white" })}
                            </div>
                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <h3 className="text-xl font-bold text-white">{t.todays_target}</h3>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                                    {t.planned}
                                </div>
                            </div>

                            <div className="relative mb-4 text-center z-10">
                                <div className="flex items-baseline justify-center">
                                    <span className="text-5xl font-black text-white drop-shadow-md">
                                        {plannedCalories.toFixed(0)}
                                    </span>
                                    <span className="text-lg text-gray-400 font-medium ml-2">kcal</span>
                                </div>
                                <p className="text-sm text-gray-500 mt-2 font-medium uppercase tracking-wide">{t.total_planned}</p>
                            </div>
                            <div className="h-2 w-full bg-gray-700/50 rounded-full overflow-hidden mt-4 z-10">
                                <div className="h-full bg-emerald-500 w-3/4 animate-pulse rounded-full"></div>
                            </div>
                        </div>

                        {/* Target List */}
                        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/10 flex-grow flex flex-col h-[400px]">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {t.planned_meals}
                            </h3>
                            {targetFoods.length > 0 ? (
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                                    {targetFoods.map((food, index) => (
                                        <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group border-l-2 border-l-emerald-500">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-200 group-hover:text-emerald-300 transition-colors text-sm">{food.name}</span>
                                            </div>
                                            <span className="font-bold text-emerald-400 text-sm">
                                                {food.calories.toFixed(0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                    <p className="text-sm font-medium">{t.no_meals}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating AI Assistant Button */}
            <div className="fixed bottom-6 right-6 z-50 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                <button
                    className="relative w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-xl transform transition-transform group-hover:scale-110 active:scale-95 border border-blue-400/30"
                    title="Ask Health Hub AI"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
