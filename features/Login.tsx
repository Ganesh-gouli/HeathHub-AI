import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Gender } from '../types';

// --- Animated Text Component ---
const DecryptText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    const [displayText, setDisplayText] = useState(text);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

    const animate = () => {
        let iterations = 0;
        const interval = setInterval(() => {
            setDisplayText(prev =>
                prev.split("").map((letter, index) => {
                    if (index < iterations) {
                        return text[index];
                    }
                    return chars[Math.floor(Math.random() * chars.length)];
                }).join("")
            );

            if (iterations >= text.length) {
                clearInterval(interval);
            }

            iterations += 1 / 3;
        }, 30);
    };

    return (
        <span onMouseEnter={animate} className={className}>
            {displayText}
        </span>
    );
};

// --- Floating Particles Background ---
const ParticleBackground = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
                <div
                    key={i}
                    className="absolute bg-white/10 rounded-full blur-xl animate-float"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        width: `${Math.random() * 300 + 50}px`,
                        height: `${Math.random() * 300 + 50}px`,
                        animationDuration: `${Math.random() * 10 + 10}s`,
                        animationDelay: `-${Math.random() * 10}s`,
                    }}
                />
            ))}
        </div>
    );
};

const Login: React.FC = () => {
    const { login, user, currentPage } = useAppContext();
    const isEditMode = currentPage === 'EDIT_PROFILE' && user;

    const [name, setName] = useState(isEditMode ? user.name : '');
    const [email, setEmail] = useState(isEditMode ? user.email || '' : '');
    const [age, setAge] = useState(isEditMode && user.age ? user.age.toString() : '');
    const [gender, setGender] = useState<Gender>(isEditMode ? user.gender : 'male');
    const [height, setHeight] = useState(isEditMode ? user.height.toString() : '');
    const [weight, setWeight] = useState(isEditMode ? user.weight.toString() : '');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditMode) {
            setName(user.name);
            setEmail(user.email || '');
            setAge(user.age.toString());
            setGender(user.gender);
            setHeight(user.height.toString());
            setWeight(user.weight.toString());
        }
    }, [user, isEditMode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !age || !height || !weight) {
            setError('Please fill in all fields.');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        setError('');
        login({
            name,
            email,
            age: parseInt(age, 10),
            gender,
            height: parseFloat(height),
            weight: parseFloat(weight),
        });
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-900 text-white font-sans selection:bg-cyan-500 selection:text-white">

            {/* Background Gradients */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81]"></div>

            {/* Particles */}
            <ParticleBackground />

            {/* Glassmorphism Container */}
            <div className="relative z-10 w-full max-w-[1400px] h-[90vh]  bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl flex flex-col lg:flex-row overflow-hidden m-4 lg:m-0 animate-fade-in">

                {/* Left Panel: Branding & Visuals */}
                <div className="lg:w-1/2 relative p-12 flex flex-col justify-between overflow-hidden group">
                    {/* Abstract Shapes */}
                    <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-500/20 rounded-full blur-[100px] animate-pulse-slow"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

                    {/* Header */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold tracking-wide">HealthHub AI</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6 cursor-default">
                            <DecryptText text="Unlock Your" className="block text-white" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500">
                                <DecryptText text="Full Potential" />
                            </span>
                        </h1>

                        <p className="text-lg text-blue-100/70 max-w-md font-light">
                            Experience the future of personal health. AI-driven insights for a better you.
                        </p>
                    </div>

                    {/* Illustration Area */}
                    <div className="relative flex-grow flex items-center justify-center my-8">
                        {/* Placeholder for Doctor Illustration */}
                        <div className="relative w-full max-w-md aspect-square">
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent rounded-full blur-3xl transform translate-y-12 opacity-50"></div>
                            {/* Use a placeholder image or the generated one if available */}
                            <img
                                src="https://img.freepik.com/free-photo/doctor-offering-medical-advice-virtual-interface_53876-96122.jpg?t=st=1739626379~exp=1739629979~hmac=a40348705f1f9408605559388151525547614275151526462432822180838676&w=996"
                                alt="Futuristic Doctor"
                                className="w-full h-full object-contain drop-shadow-2xl animate-float-slow hover:scale-105 transition-transform duration-700"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x600/1e293b/FFF?text=Doctor+Illustration';
                                }}
                            />
                            {/* Floating Tooltip */}
                            <div className="absolute top-1/4 -right-4 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-xl animate-bounce-slow opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                    <span className="text-xs font-medium text-white">System Online</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="relative z-10 flex flex-wrap gap-4">
                        {[
                            { icon: "🥗", label: "Smart Diet" },
                            { icon: "🏋️", label: "AI Coach" },
                            { icon: "📊", label: "Live Analytics" }
                        ].map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all duration-300 cursor-default group/btn">
                                <span className="text-lg group-hover/btn:scale-110 transition-transform">{feature.icon}</span>
                                <span className="text-sm font-medium text-blue-100/90">{feature.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Form */}
                <div className="lg:w-1/2 bg-black/20 backdrop-blur-3xl p-8 lg:p-16 flex flex-col justify-center border-l border-white/5 relative z-20">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-10">
                            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                                {isEditMode ? "Welcome Back" : "Care Portal Access"}
                            </h2>
                            <p className="text-blue-200/50 text-sm uppercase tracking-widest font-semibold">
                                {isEditMode ? "Update your biometrics" : "Initialize your health journey"}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div className="group">
                                    <label className="block text-xs font-bold text-blue-300/60 uppercase tracking-wider mb-2 ml-1">Identity</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:bg-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                                        placeholder="Full Name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-blue-300/60 uppercase tracking-wider mb-2 ml-1">Communication</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:bg-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                                            placeholder="Email Address"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-blue-300/60 uppercase tracking-wider mb-2 ml-1">Biological Age</label>
                                        <input
                                            type="number"
                                            value={age}
                                            onChange={(e) => setAge(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:bg-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                                            placeholder="Years"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-blue-300/60 uppercase tracking-wider mb-2 ml-1">Gender</label>
                                        <div className="relative">
                                            <select
                                                value={gender}
                                                onChange={(e) => setGender(e.target.value as Gender)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:bg-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none appearance-none"
                                            >
                                                <option value="male" className="bg-slate-900">Male</option>
                                                <option value="female" className="bg-slate-900">Female</option>
                                                <option value="other" className="bg-slate-900">Other</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-white/40">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-blue-300/60 uppercase tracking-wider mb-2 ml-1">Height</label>
                                        <input
                                            type="number"
                                            value={height}
                                            onChange={(e) => setHeight(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:bg-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                                            placeholder="cm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-blue-300/60 uppercase tracking-wider mb-2 ml-1">Weight</label>
                                        <input
                                            type="number"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:bg-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                                            placeholder="kg"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full group relative py-4 mt-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-500/40"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                                <span className="relative flex items-center justify-center gap-2">
                                    {isEditMode ? "Update Profile" : "Begin Journey"}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float {
                    0%, 100% { transform: translateY(0) translateX(0); }
                    25% { transform: translateY(-20px) translateX(10px); }
                    50% { transform: translateY(0) translateX(20px); }
                    75% { transform: translateY(20px) translateX(10px); }
                }
                @keyframes float-slow {
                     0%, 100% { transform: translateY(0); }
                     50% { transform: translateY(-20px); }
                }
                .animate-float {
                    animation: float 20s infinite linear;
                }
                .animate-float-slow {
                    animation: float-slow 6s ease-in-out infinite;
                }
                .animate-pulse-slow {
                    animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}} />
        </div>
    );
};

export default Login;

