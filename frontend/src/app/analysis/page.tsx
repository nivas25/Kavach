"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ShieldAlert, FileText, Bot, Scale, Search, Database, CheckCircle2, ChevronRight, Activity, Gavel, FileOutput } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

type TabId = 'clauses' | 'advocate' | 'defender' | 'expert' | 'debate' | 'judgment';

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<TabId>('clauses');
  
  // Simulate the progressive unlocking of tabs as analysis runs
  const [unlockedTabs, setUnlockedTabs] = useState<TabId[]>(['clauses']);
  const [progressStatus, setProgressStatus] = useState<Record<TabId, 'pending' | 'running' | 'completed'>>({
    clauses: 'running', advocate: 'pending', defender: 'pending', expert: 'pending', debate: 'pending', judgment: 'pending'
  });

  useEffect(() => {
    // Simulate the real-time processing flow
    const timers = [
      setTimeout(() => setProgressStatus(prev => ({...prev, clauses: 'completed', advocate: 'running', defender: 'running', expert: 'running'})), 2000),
      setTimeout(() => setUnlockedTabs(prev => [...prev, 'advocate', 'defender', 'expert']), 2000),
      
      setTimeout(() => setProgressStatus(prev => ({...prev, advocate: 'completed', defender: 'completed', expert: 'completed', debate: 'running'})), 6000),
      setTimeout(() => setUnlockedTabs(prev => [...prev, 'debate']), 6000),
      
      setTimeout(() => setProgressStatus(prev => ({...prev, debate: 'completed', judgment: 'running'})), 12000),
      setTimeout(() => setUnlockedTabs(prev => [...prev, 'judgment']), 12000),
      
      setTimeout(() => setProgressStatus(prev => ({...prev, judgment: 'completed'})), 15000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // --- Dynamic Subcomponents for the Left Stage ---

  const renderClausesView = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1f1f1f] mb-2">Extracted Clauses</h2>
        <p className="text-[#664229]/80">The document has been preprocessed and broken down into analyzing chunks.</p>
      </div>
      
      <div className="bg-white border border-[#e0e0e0] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-[#e0e0e0] pb-3">
          <span className="font-bold text-[#1f1f1f] text-lg">Clause 7.2 - Limitation of Liability</span>
          <span className="px-3 py-1 bg-red-50 text-red-600 text-[11px] font-bold uppercase tracking-widest rounded-full">High Risk Flag</span>
        </div>
        <p className="text-[#444746] leading-relaxed font-serif">
          "IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE..."
        </p>
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-2xl p-6 shadow-sm opacity-60">
        <div className="flex items-center justify-between mb-4 border-b border-[#e0e0e0] pb-3">
          <span className="font-bold text-[#1f1f1f] text-lg">Clause 8.1 - Governing Law</span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold uppercase tracking-widest rounded-full">Standard</span>
        </div>
        <p className="text-[#444746] leading-relaxed font-serif">
          "These Terms shall be governed and construed in accordance with the laws of Delaware, without regard to its conflict of law provisions."
        </p>
      </div>
    </motion.div>
  );

  const renderAgentView = (agent: 'advocate' | 'defender' | 'expert') => {
    const data = {
      advocate: {
        name: 'User Advocate', icon: <ShieldAlert className="w-6 h-6" />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200',
        goal: 'Scans for clauses harmful to the user',
        query: 'Searching Qdrant [risk_patterns] for "unlimited data loss liability"...',
        result: 'Found Pattern: rp-liability-001 (Severity: Critical)',
        stance: 'This clause completely strips the user of any recourse if their data is lost. It is a predatory risk.'
      },
      defender: {
        name: 'Company Defender', icon: <Bot className="w-6 h-6" />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
        goal: 'Scans for clauses protecting the company & industry norms',
        query: 'Searching Qdrant [industry_benchmarks] for "SaaS liability indirect damages"...',
        result: 'Found Benchmark: ib-saas-liability-004 (Standard Practice)',
        stance: 'Disclaiming indirect damages is standard SaaS boilerplate required for the company to remain insurable.'
      },
      expert: {
        name: 'India Legal Expert', icon: <Scale className="w-6 h-6" />, color: 'text-[#C69C6D]', bg: 'bg-[#C69C6D]/10', border: 'border-[#C69C6D]/30',
        goal: 'Finds relevant Indian laws and legal implications',
        query: 'Searching Qdrant [core_legal_sections] for "Contract Act Section 73 limitation"...',
        result: 'Found Law: Section 73, Indian Contract Act 1872',
        stance: 'While parties can limit liability, Indian courts may strike down clauses that completely exempt a party from fundamental breach.'
      }
    }[agent];

    return (
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-8 max-w-4xl mx-auto h-full flex flex-col">
        
        {/* Profile Header */}
        <div className={`flex items-center gap-4 p-6 rounded-2xl border ${data.border} ${data.bg} mb-8`}>
          <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm ${data.color}`}>
            {data.icon}
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${data.color}`}>{data.name}</h2>
            <p className="text-[#444746] font-medium">{data.goal}</p>
          </div>
        </div>

        {/* Live Thinking Console */}
        <div className="bg-[#1e1e1e] rounded-2xl p-6 font-mono text-[13px] text-green-400 shadow-xl mb-8 flex-1 max-h-[300px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 text-[#a0a0a0]">
            <Database className="w-4 h-4" /> <span>Knowledge Retrieval Terminal</span>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-2">
            <span className="text-blue-400">[{data.name}]</span> Initializing analysis of Clause 7.2...
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mb-2">
            <span className="text-blue-400">[{data.name}]</span> {data.query}
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mb-2 text-yellow-300">
            {'>'} {data.result}
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }} className="mb-2 text-white">
            <span className="text-blue-400">[{data.name}]</span> Structuring initial arguments for debate...
          </motion.div>
        </div>

        {/* Initial Stance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }} className="bg-white border border-[#e0e0e0] rounded-2xl p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#C69C6D]"></div>
          <h3 className="text-[12px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-3">Initial Stance Formed</h3>
          <p className="text-[16px] text-[#1f1f1f] leading-relaxed font-medium">"{data.stance}"</p>
        </motion.div>
      </motion.div>
    );
  };

  const renderDebateView = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1f1f1f] mb-2 flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#C69C6D]" /> The Debate Room
        </h2>
        <p className="text-[#664229]/80">5-Round structured discussion on Clause 7.2</p>
      </div>

      <div className="flex-1 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-sm overflow-y-auto space-y-6 scrollbar-thin">
        {/* Round 1: Opening */}
        <div className="text-center my-4">
          <span className="px-4 py-1 bg-gray-100 text-gray-500 text-[11px] font-bold uppercase tracking-widest rounded-full">Round 1: Opening Statements</span>
        </div>
        
        <div className="flex flex-col gap-2 items-start w-3/4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-red-600 uppercase tracking-widest pl-2">
            <ShieldAlert className="w-4 h-4" /> User Advocate
          </div>
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl rounded-tl-sm text-[14px] text-[#1f1f1f]">
            This limitation of liability is extremely aggressive. By disclaiming all indirect and consequential damages, our client loses the ability to sue for lost data. If a breach takes down their system, this leaves them with zero recourse.
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end w-3/4 ml-auto">
          <div className="flex items-center gap-2 text-[12px] font-bold text-blue-600 uppercase tracking-widest pr-2">
            Company Defender <Bot className="w-4 h-4" />
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl rounded-tr-sm text-[14px] text-[#1f1f1f] text-right">
            Standard SaaS boilerplate. We cannot accept unlimited liability for indirect damages; it makes the company uninsurable. The carve-outs in Section 7.1 cover direct damages. This is a non-negotiable standard.
          </div>
        </div>

        {/* Round 2: Rebuttals */}
        {progressStatus.debate === 'completed' && (
          <>
            <div className="text-center my-6">
              <span className="px-4 py-1 bg-gray-100 text-gray-500 text-[11px] font-bold uppercase tracking-widest rounded-full">Round 2: Cross Examination</span>
            </div>
            
            <div className="flex flex-col gap-2 items-center w-full my-4">
              <div className="flex items-center gap-2 text-[12px] font-bold text-[#C69C6D] uppercase tracking-widest">
                <Scale className="w-4 h-4" /> India Legal Expert Interjects
              </div>
              <div className="bg-[#C69C6D]/10 border border-[#C69C6D]/30 p-4 rounded-2xl text-[14px] text-[#1f1f1f] text-center max-w-2xl">
                Under Indian Contract Act Section 73, parties can limit liability. However, courts (e.g., BSNL v. Reliance) often refuse to enforce complete exemptions for gross negligence or fundamental breach of data security.
              </div>
            </div>
          </>
        )}

        {progressStatus.debate === 'running' && (
          <div className="flex items-center gap-2 text-[12px] font-medium text-[#a0a0a0] pl-2 pt-4">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            Agents are debating round 2...
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderJudgmentView = () => (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 max-w-4xl mx-auto h-full overflow-y-auto scrollbar-none">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#1f1f1f] mb-2 flex items-center gap-3">
          <Gavel className="w-8 h-8 text-[#C69C6D]" /> Final Judgment & Report
        </h2>
        <p className="text-[#664229]/80">Neutral Judge evaluation based on the 5-round debate.</p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-[#e0e0e0] p-6 rounded-3xl text-center shadow-sm">
          <div className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-2">Harm Potential</div>
          <div className="text-4xl font-bold text-red-500">92/100</div>
        </div>
        <div className="bg-white border border-[#e0e0e0] p-6 rounded-3xl text-center shadow-sm">
          <div className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-2">Legal Strength</div>
          <div className="text-4xl font-bold text-amber-500">65/100</div>
        </div>
        <div className="bg-white border border-[#e0e0e0] p-6 rounded-3xl text-center shadow-sm">
          <div className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-2">Likelihood</div>
          <div className="text-4xl font-bold text-emerald-500">30/100</div>
        </div>
      </div>

      <div className="bg-[#4a301e] p-8 rounded-[32px] shadow-[0_8px_30px_rgba(74,48,30,0.2)] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />
        
        <h3 className="text-xl font-bold mb-4 relative z-10">Verdict: Critical Risk Verified</h3>
        <p className="text-white/80 leading-relaxed mb-8 relative z-10">
          While disclaiming indirect damages is standard practice, the complete exclusion of liability for **data loss** is unacceptable for an enterprise deployment. Indian courts may view this as an unconscionable contract if a fundamental security breach occurs.
        </p>

        <div className="bg-black/30 rounded-2xl p-6 border border-white/10 relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-[12px] font-bold text-white uppercase tracking-widest">Safer Alternative (Redline)</span>
          </div>
          <p className="text-[15px] font-medium text-[#C69C6D] font-serif italic">
            "...except for damages arising from a breach of confidentiality, data security obligations, or gross negligence."
          </p>
        </div>

        <button className="mt-8 w-full bg-white text-[#4a301e] font-bold py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-lg relative z-10">
          Open Negotiation Simulator
        </button>
      </div>
    </motion.div>
  );


  // --- Render ---

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] text-[#444746] font-sans selection:bg-[#C69C6D]/30 flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <header className="w-full flex items-center justify-between px-6 sm:px-8 py-4 shrink-0 bg-white border-b border-[#e0e0e0] z-20 shadow-sm">
        <div className="flex items-center gap-4 w-[240px]">
          <Link href="/dashboard" className="w-10 h-10 rounded-full hover:bg-[#f8f9fa] flex items-center justify-center transition-colors text-[#444746] hover:text-[#1f1f1f]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="relative w-28 h-10 hover:opacity-90 transition-opacity cursor-pointer">
            <Image src="/trans_logo.png" alt="Kavach Logo" fill className="object-contain object-left" priority />
          </div>
        </div>

        <div className="hidden md:flex flex-1 justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#C69C6D]/10 rounded-full border border-[#C69C6D]/20">
            <div className="w-2 h-2 rounded-full bg-[#C69C6D] animate-pulse"></div>
            <span className="text-[13px] font-bold text-[#664229] uppercase tracking-widest">Agent Command Center</span>
          </div>
        </div>

        <div className="w-[240px] flex justify-end">
          <div className="w-10 h-10 rounded-full bg-[#C69C6D] text-white flex items-center justify-center font-bold shadow-sm text-sm">
            A
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT (Left Stage / Right Menu) */}
      <main className="flex-1 w-full flex overflow-hidden">
        
        {/* LEFT PANE: Dynamic Stage (70%) */}
        <div className="flex-1 h-full bg-[#f8f9fa] relative overflow-y-auto flex flex-col scrollbar-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              {activeTab === 'clauses' && renderClausesView()}
              {activeTab === 'advocate' && renderAgentView('advocate')}
              {activeTab === 'defender' && renderAgentView('defender')}
              {activeTab === 'expert' && renderAgentView('expert')}
              {activeTab === 'debate' && renderDebateView()}
              {activeTab === 'judgment' && renderJudgmentView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT PANE: Mission Control Navigation (30%) */}
        <div className="w-[380px] shrink-0 h-full bg-white border-l border-[#e0e0e0] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10 relative">
          
          <div className="p-6 border-b border-[#e0e0e0] bg-gradient-to-b from-[#f8f9fa] to-white">
            <h2 className="text-[14px] font-bold text-[#1f1f1f] uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#C69C6D]" /> Analysis Pipeline
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            
            {/* Nav Items Array */}
            {[
              { id: 'clauses', icon: <FileText className="w-5 h-5" />, label: 'Extracted Clauses', desc: 'Preprocessing' },
              { id: 'advocate', icon: <ShieldAlert className="w-5 h-5" />, label: 'User Advocate', desc: 'Parallel Analysis' },
              { id: 'defender', icon: <Bot className="w-5 h-5" />, label: 'Company Defender', desc: 'Parallel Analysis' },
              { id: 'expert', icon: <Scale className="w-5 h-5" />, label: 'India Legal Expert', desc: 'Parallel Analysis' },
              { id: 'debate', icon: <Activity className="w-5 h-5" />, label: 'The Debate Room', desc: 'Multi-Round Conflict' },
              { id: 'judgment', icon: <FileOutput className="w-5 h-5" />, label: 'Final Judgment', desc: 'Scoring & Report' },
            ].map((item) => {
              
              const isUnlocked = unlockedTabs.includes(item.id as TabId);
              const isActive = activeTab === item.id;
              const status = progressStatus[item.id as TabId];

              return (
                <button
                  key={item.id}
                  onClick={() => isUnlocked && setActiveTab(item.id as TabId)}
                  disabled={!isUnlocked}
                  className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 relative overflow-hidden group
                    ${!isUnlocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[#f8f9fa]'}
                    ${isActive ? 'bg-[#C69C6D]/10 border border-[#C69C6D]/30 shadow-inner' : 'bg-transparent border border-transparent'}
                  `}
                >
                  {/* Status Indicator */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors 
                      ${isActive ? 'bg-[#C69C6D] text-white' : 'bg-[#f0f0f0] text-[#a0a0a0] group-hover:bg-[#e0e0e0]'}
                      ${status === 'completed' && !isActive ? 'bg-emerald-50 text-emerald-600' : ''}
                    `}>
                      {item.icon}
                    </div>
                    {status === 'running' && (
                      <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C69C6D] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#C69C6D]"></span>
                      </span>
                    )}
                    {status === 'completed' && (
                      <span className="absolute -bottom-1 -right-1 bg-white rounded-full">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </span>
                    )}
                  </div>
                  
                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-[14px] truncate transition-colors ${isActive ? 'text-[#664229]' : 'text-[#1f1f1f]'}`}>
                      {item.label}
                    </h3>
                    <p className={`text-[11px] font-medium tracking-wide truncate ${isActive ? 'text-[#C69C6D]' : 'text-[#a0a0a0]'}`}>
                      {item.desc}
                    </p>
                  </div>

                  {/* Active Chevron */}
                  <ChevronRight className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-[#C69C6D] opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
