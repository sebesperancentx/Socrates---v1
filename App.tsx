
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { JournalEntry, AlignmentAnalysis, Pattern, Victory, Persona } from './types';
import { analyzeEntries, askCoach } from './services/geminiService';
import { ICONS } from './constants';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer
} from 'recharts';

type AppView = 'analyses' | 'methodology';
type TimeFilter = '7d' | '30d' | 'all';

const rectifyProjectName = (text: string): string => {
  if (!text) return "";
  return text.replace(/NEOMATIX|NOEMATIX/gi, "SOCRATES");
};

const STREAK_GOAL = 35;

const getImpactStyles = (impact: string) => {
  switch (impact) {
    case 'positive':
      return 'bg-emerald-50/60 text-emerald-600 border-emerald-100/50';
    case 'negative':
      return 'bg-rose-50/60 text-rose-600 border-rose-100/50';
    case 'neutral':
    default:
      return 'bg-amber-50/60 text-amber-600 border-amber-100/50';
  }
};

const ExpandableText: React.FC<{ text: string, limit?: number, className?: string }> = ({ text, limit = 200, className = "" }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > limit;

  return (
    <div className={className}>
      <p className="inline">
        {expanded ? text : `${text.slice(0, limit)}${isLong ? '...' : ''}`}
      </p>
      {isLong && (
        <button 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="ml-2 text-current font-bold hover:underline text-[10px] uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity"
        >
          {expanded ? "[ RÉDUIRE ]" : "[ VOIR PLUS ]"}
        </button>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('analyses');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [persona, setPersona] = useState<Persona>('socrates');
  const [chatPersona, setChatPersona] = useState<Persona>('socrates');
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem('socrates_entries');
    return saved ? JSON.parse(saved) : [];
  });
  const [analysis, setAnalysis] = useState<AlignmentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [pending, setPending] = useState<JournalEntry[] | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const filteredEntries = useMemo(() => {
    let base = timeFilter === 'all' ? entries : (() => {
      const now = new Date();
      const days = timeFilter === '7d' ? 7 : 30;
      const limit = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return entries.filter(e => new Date(e.date) >= limit);
    })();
    return base;
  }, [entries, timeFilter]);

  const stats = useMemo(() => {
    const dates: string[] = Array.from(new Set<string>(entries.map(e => e.date.split('T')[0]))).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (dates.length > 0 && (dates[0] === today || dates[0] === yesterday)) {
      streak = 1;
      for (let i = 0; i < dates.length - 1; i++) {
        const d1 = new Date(dates[i]);
        const d2 = new Date(dates[i+1]);
        if (Math.round((d1.getTime() - d2.getTime()) / 86400000) === 1) streak++;
        else break;
      }
    }
    const progress = Math.min(100, Math.round((streak / STREAK_GOAL) * 100));
    return { total: entries.length, streak, progress };
  }, [entries]);

  const performAnalysis = useCallback(async (data: JournalEntry[], activePersona: Persona) => {
    if (data.length === 0) return;
    setLoading(true);
    setStep(`CALIBRATION : ${activePersona.toUpperCase()}`);
    try {
      const res = await analyzeEntries(data, activePersona);
      res.globalState.interpretation = rectifyProjectName(res.globalState.interpretation);
      setAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setStep('');
    }
  }, []);

  useEffect(() => {
    if (filteredEntries.length > 0) {
      performAnalysis(filteredEntries, persona);
    } else if (entries.length > 0) {
      setAnalysis(null);
    }
  }, [timeFilter, persona, entries.length, performAnalysis]);

  useEffect(() => {
    localStorage.setItem('socrates_entries', JSON.stringify(entries));
  }, [entries]);

  const [showTour, setShowTour] = useState(() => {
    return !localStorage.getItem('socrates_tour_completed');
  });
  const [tourStep, setTourStep] = useState(0);

  const tourSteps = [
    {
      title: "Bienvenue dans SOCRATES",
      content: "Votre sonar d'alignement stratégique. SOCRATES transforme vos journaux intimes en une Géométrie du Soi exploitable.",
      icon: "🏺"
    },
    {
      title: "Fragments & Day One",
      content: "Importez vos exports JSON de Day One ou vos fichiers de journalisation. Nous analysons les patterns cachés dans vos écrits.",
      icon: "📥"
    },
    {
      title: "Les Prismes d'Analyse",
      content: "Basculez entre SOCRATES (Philosophie), l'Architecte (Efficience) ou l'Alchimiste (Créativité) pour varier les perspectives.",
      icon: "💎"
    },
    {
      title: "Écho Day One",
      content: "Une fois l'analyse terminée, renvoyez les conseils de l'Oracle directement dans votre journal Day One d'un simple clic.",
      icon: "📤"
    }
  ];

  const nextTourStep = () => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(s => s + 1);
    } else {
      setShowTour(false);
      localStorage.setItem('socrates_tour_completed', 'true');
    }
  };

  const handleDayOneImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Day One JSON structure: { metadata: {...}, entries: [...] }
        const rawEntries = Array.isArray(json) ? json : (json.entries || []);
        const journalEntries: JournalEntry[] = rawEntries.map((e: any) => ({
          date: e.creationDate || e.date || new Date().toISOString(),
          text: rectifyProjectName(e.text || ""),
          emotions: e.emotions || [],
          tags: e.tags || []
        }));
        if (journalEntries.length > 0) {
          setEntries(journalEntries);
          // Optional: persist to localStorage is handled by useEffect
        } else {
          alert("Aucun fragment valide trouvé dans ce fichier.");
        }
      } catch (err) { 
        alert("Format JSON invalide. Assurez-vous d'utiliser un export Day One standard."); 
      }
    };
    reader.readAsText(file);
  };

  const shareToDayOne = (text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`dayone2://post?entry=${encodedText}`, '_blank');
  };

  const activeColor = persona === 'socrates' ? 'emerald' : persona === 'architect' ? 'blue' : 'amber';
  const chatColor = chatPersona === 'socrates' ? 'emerald' : chatPersona === 'architect' ? 'blue' : 'amber';
  const activeColorHex = activeColor === 'emerald' ? '#10b981' : activeColor === 'blue' ? '#2563eb' : '#d97706';

  return (
    <div className="min-h-screen px-6 md:px-12 py-12 selection:bg-slate-100 selection:text-slate-900">
      {/* Onboarding Tour Overlay */}
      {showTour && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="glass-dark max-w-md w-full p-10 rounded-3xl shadow-2xl space-y-8 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 space-y-6 text-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
                {tourSteps[tourStep].icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter swiss-title">
                  {tourSteps[tourStep].title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed font-light">
                  {tourSteps[tourStep].content}
                </p>
              </div>
            </div>

            <div className="relative z-10 flex flex-col gap-4 pt-4">
              <button 
                onClick={nextTourStep}
                className="w-full py-4 bg-white text-slate-900 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] transition-all"
              >
                {tourStep === tourSteps.length - 1 ? "Commencer l'Expérience" : "Suivant"}
              </button>
              <div className="flex justify-center gap-2">
                {tourSteps.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === tourStep ? 'bg-white w-4' : 'bg-white/20'}`}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-24">
        
        {/* Navigation */}
        <nav className="flex flex-col md:flex-row justify-between items-center gap-8 pb-10 border-b border-slate-100">
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-2xl font-bold tracking-tighter uppercase cursor-pointer text-slate-800" onClick={() => setView('analyses')}>
              SOCRATES<span className={`text-${activeColor}-600`}>.</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] text-slate-300 uppercase mt-1">Écho d'Alignement</p>
          </div>
          <div className="flex gap-12">
            <NavBtn active={view === 'analyses'} onClick={() => setView('analyses')}>Analyses</NavBtn>
            <NavBtn active={view === 'methodology'} onClick={() => setView('methodology')}>Méthodologie</NavBtn>
          </div>
        </nav>

        {loading ? (
          <div className="h-[50vh] flex flex-col items-center justify-center gap-6">
            <div className={`w-10 h-10 border-[1.5px] border-slate-100 border-t-${activeColor}-500 rounded-full animate-spin`}></div>
            <p className="text-[11px] font-bold uppercase tracking-[0.5em] text-slate-300 italic">{step}</p>
          </div>
        ) : view === 'analyses' ? (
          <div className="space-y-24 animate-in fade-in duration-700">
            {pending && (
              <div className="glass p-8 rounded-xl flex flex-col md:flex-row items-center justify-between gap-8 border-emerald-50 shadow-sm animate-in slide-in-from-top-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold uppercase tracking-tight text-slate-800">{pending.length} fragments détectés</h2>
                  <p className="text-[11px] font-medium opacity-40 uppercase tracking-widest text-slate-500">Synchronisation SOCRATES prête</p>
                </div>
                <div className="flex gap-8 items-center">
                  <button onClick={() => setPending(null)} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">Ignorer</button>
                  <button onClick={() => { setEntries(pending); setPending(null); }} className={`px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-white rounded-lg bg-${activeColor}-600 shadow-lg shadow-${activeColor}-500/10 hover:scale-[1.02] transition-all`}>Intégrer</button>
                </div>
              </div>
            )}

            {!entries.length && !pending && (
              <div className="space-y-12">
                <div onClick={() => fileRef.current?.click()} className="h-[45vh] glass rounded-2xl border-dashed border-[1.5px] border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 transition-all group">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-8 group-hover:scale-105 transition-all text-2xl opacity-20">🏺</div>
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-40 text-slate-500 italic">IMMERGER LES FRAGMENTS (.JSON)</h3>
                  <p className="text-[10px] mt-4 opacity-30 uppercase tracking-widest font-bold">Compatible avec l'export JSON de Day One</p>
                  <input type="file" ref={fileRef} className="hidden" onChange={handleDayOneImport} accept=".json" />
                </div>

                <div className="max-w-2xl mx-auto glass p-8 rounded-xl border-slate-100 space-y-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 border-b border-slate-50 pb-4">Comment synchroniser avec Day One ?</h4>
                  <ol className="text-[11px] space-y-4 text-slate-500 leading-relaxed">
                    <li className="flex gap-4"><span className="font-bold text-slate-300">01.</span> Ouvrez Day One sur votre Mac ou iOS.</li>
                    <li className="flex gap-4"><span className="font-bold text-slate-300">02.</span> Allez dans Réglages &gt; Import/Export &gt; Exporter au format JSON.</li>
                    <li className="flex gap-4"><span className="font-bold text-slate-300">03.</span> Sélectionnez le journal souhaité et enregistrez le fichier.</li>
                    <li className="flex gap-4"><span className="font-bold text-slate-300">04.</span> Glissez-déposez ou sélectionnez le fichier ci-dessus.</li>
                  </ol>
                </div>
              </div>
            )}

            {analysis && (
              <div className="space-y-32">
                {/* 1. Executive Interpretation (The Hero) */}
                <section className="glass p-12 md:p-20 rounded-2xl border-slate-50 shadow-sm relative overflow-hidden">
                  <div className={`absolute -top-10 -left-10 w-40 h-40 bg-${activeColor}-500/5 rounded-full blur-[60px] pointer-events-none`}></div>
                  <div className="flex justify-between items-start relative z-10">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.6em] text-slate-300 mb-12 italic border-b border-slate-100 pb-4 inline-block">ÉCHO DE L'EXPERTISE / {persona.toUpperCase()}</h4>
                    <button 
                      onClick={() => shareToDayOne(`SOCRATES | ${analysis.globalState.interpretation}\n\n${analysis.feedbacks.mirror}`)}
                      className="glass-card p-4 rounded-full hover:scale-110 transition-all opacity-40 hover:opacity-100"
                      title="Envoyer vers Day One"
                    >
                      <span className="text-xl">📤</span>
                    </button>
                  </div>
                  <ExpandableText text={analysis.globalState.interpretation} limit={500} className="text-2xl md:text-4xl font-extralight tracking-tight leading-relaxed text-slate-800" />
                </section>

                {/* 2. Controls & Performance Snapshot */}
                <section className="space-y-12">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-10 bg-slate-50/50 p-10 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-12 items-center">
                      <div className="space-y-4 text-center md:text-left">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">FENÊTRE</label>
                        <div className="flex bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                          {['7d', '30d', 'all'].map(f => (
                            <button key={f} onClick={() => setTimeFilter(f as any)} className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${timeFilter === f ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4 text-center md:text-left">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PRISME ANALYTIQUE</label>
                        <div className="flex gap-2 p-1 bg-white rounded-lg border border-slate-100 shadow-sm">
                           <ExpertMiniBtn active={persona === 'socrates'} onClick={() => setPersona('socrates')} label="Miroir" color="emerald" />
                           <ExpertMiniBtn active={persona === 'architect'} onClick={() => setPersona('architect')} label="Logique" color="blue" />
                           <ExpertMiniBtn active={persona === 'alchemist'} onClick={() => setPersona('alchemist')} label="Alchimie" color="amber" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-16 items-end">
                      <div className="text-center md:text-right space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Total fragments</p>
                        <p className="text-3xl font-extralight tracking-tighter text-slate-800">{stats.total}</p>
                      </div>
                      <div className="text-center md:text-right space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Série Alignée</p>
                        <div className="flex items-center gap-3 justify-center md:justify-end">
                          <p className="text-3xl font-bold tracking-tighter text-slate-900 leading-none">{stats.streak}</p>
                          <div className={`w-3 h-3 rounded-full bg-${activeColor}-500 animate-pulse`}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Dashboard */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-6">
                        <MetricCard title="ÉNERGIE" val={analysis.globalState.energy} color={activeColor} icon={ICONS.Energy} />
                        <MetricCard title="CLARTÉ" val={analysis.globalState.clarity} color={activeColor} icon={ICONS.Clarity} />
                        <MetricCard title="RÉSILIENCE" val={analysis.globalState.resilience} color={activeColor} icon={ICONS.Energy} />
                        <MetricCard title="AUDACE" val={analysis.globalState.boldness} color={activeColor} icon={ICONS.Pleasure} />
                        <MetricCard title="PLAISIR" val={analysis.globalState.pleasure} color={activeColor} icon={ICONS.Pleasure} />
                        <MetricCard title="CHARGE" val={analysis.globalState.emotionalLoad} color="slate" icon={ICONS.Warning} invert />
                    </div>
                    <div className="lg:col-span-5 glass p-10 rounded-2xl h-full min-h-[400px] flex flex-col items-center justify-center border-slate-50 shadow-sm">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={[
                            { name: 'NRJ', value: analysis.globalState.energy * 10 },
                            { name: 'CLAR', value: analysis.globalState.clarity * 10 },
                            { name: 'CALM', value: (10 - analysis.globalState.emotionalLoad) * 10 },
                            { name: 'JOIE', value: analysis.globalState.pleasure * 10 },
                            { name: 'RÉSI', value: analysis.globalState.resilience * 10 },
                            { name: 'AUD', value: analysis.globalState.boldness * 10 },
                          ]}>
                            <PolarGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                            <PolarAngleAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em'}} />
                            <Radar dataKey="value" stroke={activeColorHex} fill={activeColorHex} fillOpacity={0.04} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                {/* 3. Deep Insights (Cycles & Victories) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                  <section className="space-y-12">
                    <div className="flex items-center gap-6">
                      <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-slate-800">Cycles & Récurrences</h2>
                      <div className="h-[1px] flex-1 bg-slate-100"></div>
                    </div>
                    <div className="space-y-6">
                      {analysis.patterns.map((p, i) => <PatternCard key={i} pattern={p} color={activeColor} />)}
                    </div>
                  </section>

                  <section className="space-y-12">
                    <div className="flex items-center gap-6">
                      <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-slate-800">Haute Fidélité</h2>
                      <div className="h-[1px] flex-1 bg-slate-100"></div>
                    </div>
                    <div className="space-y-6">
                      {analysis.victories.map((v, i) => <VictoryCard key={i} victory={v} color={activeColor} />)}
                    </div>
                  </section>
                </div>

                {/* 4. Consultation (Dialectique Chat) */}
                <section className="glass rounded-2xl p-12 md:p-20 border-slate-50 shadow-sm relative overflow-hidden bg-white/70">
                  <div className={`absolute -top-32 -right-32 w-96 h-96 bg-${chatColor}-500/5 rounded-full blur-[100px] pointer-events-none`}></div>
                  <div className="max-w-3xl relative z-10 space-y-16">
                    <div className="space-y-3">
                       <h2 className="text-5xl md:text-6xl font-extralight tracking-tight uppercase leading-none text-slate-900">DIALECTIQUE<br/><span className={`text-${chatColor}-600 italic`}>{chatPersona.toUpperCase()}.</span></h2>
                       <p className="text-[11px] font-bold uppercase tracking-[0.6em] text-slate-300">Échange de haute précision sémantique</p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                        <ExpertMiniBtn active={chatPersona === 'socrates'} onClick={() => setChatPersona('socrates')} label="Socrates" color="emerald" />
                        <ExpertMiniBtn active={chatPersona === 'architect'} onClick={() => setChatPersona('architect')} label="Architecte" color="blue" />
                        <ExpertMiniBtn active={chatPersona === 'alchemist'} onClick={() => setChatPersona('alchemist')} label="Alchimiste" color="amber" />
                      </div>
                    </div>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!chatInput) return;
                      setChatLoading(true);
                      const res = await askCoach(chatInput, analysis, chatPersona);
                      setChatResponse(rectifyProjectName(res));
                      setChatLoading(false);
                    }} className="space-y-16">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={chatInput} 
                          onChange={e => setChatInput(e.target.value)} 
                          placeholder={`Parler à l'expert ${chatPersona}...`} 
                          className={`w-full bg-white border border-slate-100 rounded-2xl px-10 py-8 text-2xl font-light outline-none focus:border-${chatColor}-200 transition-all placeholder:text-slate-300 text-slate-800 shadow-sm`}
                        />
                        <button disabled={chatLoading} className={`absolute right-5 top-1/2 -translate-y-1/2 bg-${chatColor}-600 text-white px-8 py-5 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-${chatColor}-500/20`}>
                          {chatLoading ? "SONDAGE..." : "ENVOYER"}
                        </button>
                      </div>

                      {chatResponse && (
                        <div className={`bg-white border border-${chatColor}-50 p-12 rounded-2xl animate-in slide-in-from-top-6 duration-700 shadow-sm`}>
                          <p className="text-2xl md:text-3xl font-light leading-relaxed text-slate-700 tracking-tight italic">"{chatResponse}"</p>
                        </div>
                      )}
                    </form>
                  </div>
                </section>
              </div>
            )}
          </div>
        ) : (
          <ProductDocView setView={setView} color={activeColor} />
        )}
      </div>

      <footer className="max-w-6xl mx-auto px-6 py-24 border-t border-slate-100 mt-32 flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="flex items-center gap-10 text-[11px] font-bold uppercase tracking-[0.6em] text-slate-300">
          <span>SOCRATES © 2025</span>
          <div className="h-4 w-[1px] bg-slate-100"></div>
          <span className="italic opacity-40">LUCIDITÉ OPÉRATIONNELLE</span>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <button 
            onClick={() => { setTourStep(0); setShowTour(true); }}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-slate-600 transition-colors"
          >
            [ REVOIR LE TOUR ]
          </button>
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
              Heritage Master IDEA / Master Socratique
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
              By <a href="https://www.linkedin.com/in/sebastienesperance/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors underline decoration-slate-200 underline-offset-4">sebesperance</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// --- Méthodologie ---

const ProductDocView: React.FC<{ setView: any, color: string }> = ({ setView, color }) => (
  <div className="max-w-4xl mx-auto space-y-32 py-10 animate-in slide-in-from-bottom-8 duration-700 text-slate-800">
    
    <section className="space-y-10">
      <h2 className="text-4xl md:text-7xl font-extralight tracking-tighter leading-tight uppercase text-slate-900">
        L'ALIGNEMENT<br/>EST UNE<br/>STRATÉGIE<span className={`text-${color}-600`}>.</span>
      </h2>
      <p className="text-2xl font-extralight opacity-60 leading-relaxed max-w-2xl tracking-tight uppercase">
        SOCRATES est un sonar psycho-émotionnel qui transforme le bruit mental en signaux de pilotage de haute fidélité.
      </p>
    </section>

    <section className="space-y-12">
      <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-4 inline-block">Indicateurs de Pilotage</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <DemoStatCard title="FIDÉLITÉ ANALYTIQUE" val="94.2%" label="ALIGNEMENT" desc="Précision sémantique entre l'intention et le fragment écrit." color="emerald" />
        <DemoStatCard title="DENSITÉ MÉTAPHORIQUE" val="1.8" label="COEFF IDEA" desc="Capacité d'identification des archétypes structurants." color="amber" />
        <DemoStatCard title="OPTIMISATION NEURALE" val="-22%" label="CHARGE COGNITIVE" desc="Réduction prédictive du bruit mental après analyse." color="blue" />
      </div>
    </section>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      <div className="p-12 glass-card border-slate-50 rounded-2xl space-y-10 shadow-sm">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.5em] text-slate-300">L'APPROCHE</h4>
        <p className="text-2xl font-light leading-snug text-slate-700">Accumuler des notes n'est pas comprendre. SOCRATES agit comme un processeur qui traite vos fragments pour en extraire une structure objective.</p>
      </div>
      <div className="p-12 glass-card border-slate-50 rounded-2xl italic font-light text-slate-400 flex items-center text-xl leading-relaxed shadow-sm">
        "Le pilotage de vie exige de passer du récit à l'infrastructure. SOCRATES est cet outil de mesure."
      </div>
    </div>

    <section className="space-y-12">
      <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-4 inline-block">LA TRIADE DIALECTIQUE</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <DocExpertCard icon="⚖️" title="ORACLE" role="Miroir" desc="Révèle les contradictions et l'essence par la maïeutique pure." color="emerald" />
        <DocExpertCard icon="📐" title="ARCHITECTE" role="Logique" desc="Analyse l'efficience systémique de vos patterns comportementaux." color="blue" />
        <DocExpertCard icon="🧪" title="ALCHIMISTE" role="Symboles" desc="Identifie les archétypes et le potentiel de transformation créative." color="amber" />
      </div>
    </section>

    <div className="p-20 glass border-slate-100 rounded-2xl text-center space-y-12 shadow-sm">
      <h3 className="text-5xl font-extralight uppercase tracking-tight text-slate-900 leading-none italic">ALIGNEMENT = PUISSANCE</h3>
      <p className="text-xl font-light text-slate-500 max-w-xl mx-auto leading-relaxed">La lucidité est le seul avantage compétitif durable. SOCRATES automatise la clarté stratégique.</p>
      <button onClick={() => setView('analyses')} className={`px-20 py-8 rounded-xl bg-slate-900 text-white text-[11px] font-bold uppercase tracking-[0.5em] hover:bg-${color}-600 transition-all shadow-2xl shadow-slate-200 active:scale-95`}>
        DÉMARRER LE PILOTAGE
      </button>
    </div>
  </div>
);

// --- Atomic Components ---

const DocExpertCard: React.FC<{ icon: string, title: string, role: string, desc: string, color: string }> = ({ icon, title, role, desc, color }) => (
  <div className="p-10 glass-card rounded-2xl border-slate-50 shadow-sm space-y-6">
    <div className={`w-14 h-14 flex items-center justify-center rounded-xl bg-${color}-50 text-3xl`}>{icon}</div>
    <div className="space-y-1">
      <h4 className="font-bold uppercase tracking-tight text-lg text-slate-800">{title}</h4>
      <p className={`text-[10px] font-bold uppercase tracking-widest text-${color}-600`}>{role}</p>
    </div>
    <p className="text-base font-light leading-relaxed text-slate-500 italic">{desc}</p>
  </div>
);

const NavBtn: React.FC<{active: boolean, onClick: () => void, children: React.ReactNode}> = ({active, onClick, children}) => (
  <button onClick={onClick} className={`text-[12px] font-bold uppercase tracking-[0.25em] py-3 px-2 relative transition-all ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
    {children}
    {active && <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-slate-900 rounded-full shadow-sm"></div>}
  </button>
);

const ExpertMiniBtn: React.FC<{ active: boolean, onClick: () => void, label: string, color: string }> = ({ active, onClick, label, color }) => (
  <button 
    onClick={onClick}
    className={`px-5 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${active ? `bg-slate-900 text-white shadow-md` : 'text-slate-400 hover:text-slate-900'}`}
  >
    {label}
  </button>
);

const MetricCard: React.FC<{title: string, val: number, color: string, icon: any, invert?: boolean}> = ({title, val, color, icon, invert}) => {
  const normVal = Math.max(1, Math.min(10, val));
  const fill = invert ? (10 - normVal) : normVal;
  return (
    <div className="glass-card p-8 rounded-2xl space-y-8 group border-slate-50 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-lg text-slate-400 group-hover:bg-slate-100 transition-all">{icon}</div>
        <span className="text-3xl font-light tracking-tighter text-slate-800">{normVal.toFixed(1)}</span>
      </div>
      <h5 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-300">{title}</h5>
      <div className="h-[2px] w-full bg-slate-50 rounded-full overflow-hidden">
        <div className={`h-full bg-${color}-500 transition-all duration-[1.5s] ease-out`} style={{width: `${fill * 10}%`}}></div>
      </div>
    </div>
  );
};

const VictoryCard: React.FC<{victory: Victory, color: string}> = ({victory, color}) => (
  <div className="glass-card p-10 rounded-2xl flex flex-col h-full group border-slate-50 shadow-sm">
    <div className="flex justify-between items-start mb-8">
       <span className={`text-[10px] font-bold px-4 py-2 bg-${color}-50 text-${color}-600 rounded-lg tracking-widest uppercase`}>FIDÉLITÉ: {victory.alignmentScore}</span>
       <span className="text-[10px] font-bold text-slate-200 italic">{new Date(victory.date).toLocaleDateString()}</span>
    </div>
    <h4 className="text-xl font-light tracking-tight mb-4 uppercase text-slate-800 leading-snug">{victory.title}</h4>
    <ExpandableText text={victory.description} limit={160} className="text-base font-light text-slate-500 leading-relaxed italic" />
  </div>
);

const PatternCard: React.FC<{pattern: Pattern, color: string}> = ({pattern, color}) => {
  const impactStyles = getImpactStyles(pattern.impact);
  return (
    <div className="glass-card p-10 rounded-2xl space-y-6 h-full flex flex-col justify-between group border-slate-50 shadow-sm">
      <div className="space-y-5">
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-xl font-light uppercase tracking-tight text-slate-800 leading-tight flex-1">{pattern.name}</h3>
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${impactStyles}`}>
            {pattern.impact}
          </span>
        </div>
        <p className="text-base font-light text-slate-500 leading-relaxed italic">"{pattern.description}"</p>
      </div>
      <div className="flex items-center gap-6 pt-6 border-t border-slate-50">
        <div className="flex-1 h-[2px] bg-slate-50 rounded-full overflow-hidden">
          <div className={`h-full bg-slate-300 transition-all duration-1000 ${pattern.frequency === 'high' ? 'w-full' : pattern.frequency === 'medium' ? 'w-2/3' : 'w-1/3'}`}></div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{pattern.frequency}</span>
      </div>
    </div>
  );
};

const DemoStatCard: React.FC<{ title: string, val: string, label: string, desc: string, color: string }> = ({ title, val, label, desc, color }) => (
  <div className={`glass-card p-10 rounded-2xl border-slate-50 shadow-sm transition-all hover:translate-y-[-2px]`}>
    <h4 className="text-[10px] font-bold uppercase tracking-[0.5em] text-slate-300 mb-8 italic">{title}</h4>
    <div className={`text-6xl font-extralight tracking-tighter mb-6 text-${color}-600`}>{val}</div>
    <div className="text-[11px] font-bold uppercase tracking-widest mb-4 text-slate-600 opacity-80">{label}</div>
    <p className="text-base font-light text-slate-400 leading-relaxed italic">{desc}</p>
  </div>
);

export default App;
