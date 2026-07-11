"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ShieldAlert, FileText, Bot, Scale, Activity, Gavel, CheckCircle2, ChevronRight, Send, Database, AlertTriangle, FileOutput, Search, Lightbulb, FileCheck2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { User } from "@supabase/supabase-js";

type TabId = 'clauses' | 'debate' | 'negotiation';
type AgentRole = 'advocate' | 'defender' | 'expert' | 'judge' | 'user';

type ToolBadge = {
  name: string;
  status: 'success' | 'blocked';
  reason?: string;
  query?: string;
};

type ChatMessage = {
  id: number;
  role: AgentRole;
  round?: number;
  text: string;
  tools?: ToolBadge[];
};

export default function AnalysisPage() {
  // User State
  const [user, setUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
    
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const userInitials = userName.substring(0, 1).toUpperCase();

  const [activeTab, setActiveTab] = useState<TabId>('clauses');
  const [viewMode, setViewMode] = useState<'analysis' | 'report'>('analysis');
  
  const [unlockedTabs, setUnlockedTabs] = useState<TabId[]>(['clauses', 'debate', 'negotiation']);
  const [progressStatus, setProgressStatus] = useState<Record<TabId, 'pending' | 'running' | 'completed'>>({
    clauses: 'running', debate: 'pending', negotiation: 'pending'
  });

  // Debate State
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<AgentRole | null>(null);
  const [showVerdict, setShowVerdict] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    
    // Connect to the Fastify SSE stream
    const fastifyUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const sse = new EventSource(`${fastifyUrl}/api/documents/${sessionId}/stream`);
    
    // Move to Debate Tab automatically since Clauses were parsed in Phase 2
    setProgressStatus(prev => ({ ...prev, clauses: 'completed', debate: 'running' }));
    setUnlockedTabs(prev => Array.from(new Set([...prev, 'debate'])));
    setActiveTab('debate');

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === 'typing') {
          setIsTyping(data.agent);
        } else if (data.type === 'message') {
          setIsTyping(null);
          setVisibleMessages(prev => [...prev, { ...data.msg, id: Date.now() }]);
        } else if (data.type === 'verdict') {
          setIsTyping(null);
          setShowVerdict(true);
          setProgressStatus(prev => ({ ...prev, debate: 'completed' }));
        } else if (data.type === 'complete') {
          sse.close();
        } else if (data.type === 'error') {
          console.error("SSE Error:", data.error || data.message);
          sse.close();
        }
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    sse.onerror = (err) => {
      console.error("EventSource failed:", err);
      sse.close();
    };

    return () => sse.close();
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, isTyping, showVerdict]);

  const handleUserChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setVisibleMessages(prev => [...prev, { id: Date.now(), role: 'user', text: chatInput }]);
    setChatInput("");
    setIsTyping('expert'); // Simulate AI responding
    setTimeout(() => {
      setIsTyping(null);
      setVisibleMessages(prev => [...prev, { id: Date.now()+1, role: 'expert', text: "I understand your concern. Let me pull up alternative standard clauses for negotiation." }]);
    }, 2000);
  };

  // --- Components ---

  const renderClausesView = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-10 shrink-0">
        <h2 className="text-3xl font-bold text-[#1f1f1f] tracking-tight mb-2 flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#1f1f1f]" />
          </div>
          Document Breakdown
        </h2>
      </div>
      
      {/* Scrollable Container with custom scrollbar */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-16 pr-6 relative">
        
        {/* Continuous Flow Line */}
        <div className="absolute left-6 top-8 bottom-8 w-px bg-gray-200"></div>

        <div className="space-y-10">
          
          {/* Node 1 */}
          <div className="relative pl-16">
            <div className="absolute left-[1.5rem] top-6 w-3 h-3 rounded-full bg-gray-300 shadow-sm transform -translate-x-1/2"></div>
            
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 border-b border-gray-100 pb-4">
                <h3 className="font-bold text-[#1f1f1f] text-lg">Clause 7.2 - Limitation of Liability</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14px] text-gray-600 leading-relaxed font-sans">
                  "IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE..."
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14.5px] text-[#1f1f1f] font-medium leading-relaxed">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">AI Synthesis</span>
                  The company is completely absolving itself from any responsibility if you lose money, data, or reputation. This transfers catastrophic risk to the user.
                </div>
              </div>
            </div>
          </div>

          {/* Node 2 */}
          <div className="relative pl-16">
            <div className="absolute left-[1.5rem] top-6 w-3 h-3 rounded-full bg-gray-300 shadow-sm transform -translate-x-1/2"></div>
            
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 border-b border-gray-100 pb-4">
                <h3 className="font-bold text-[#1f1f1f] text-lg">Clause 8.1 - Governing Law</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14px] text-gray-600 leading-relaxed font-sans">
                  "These Terms shall be governed and construed in accordance with the laws of Delaware, without regard to its conflict of law provisions."
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14.5px] text-[#1f1f1f] font-medium leading-relaxed">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">AI Synthesis</span>
                  Any legal disputes will be handled under the laws of Delaware. This is standard practice for US-based corporations and presents no unusual risk.
                </div>
              </div>
            </div>
          </div>

          {/* Node 3 */}
          <div className="relative pl-16">
            <div className="absolute left-[1.5rem] top-6 w-3 h-3 rounded-full bg-gray-300 shadow-sm transform -translate-x-1/2"></div>
            
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 border-b border-gray-100 pb-4">
                <h3 className="font-bold text-[#1f1f1f] text-lg">Clause 12.4 - Proprietary AI Data Rights</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14px] text-gray-600 leading-relaxed font-sans">
                  "Customer grants Provider a perpetual, worldwide, royalty-free license to use any data processed through the Service to train, fine-tune..."
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-[14.5px] text-[#1f1f1f] font-medium leading-relaxed">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">AI Synthesis</span>
                  This novel clause lacks precedent. It has been extracted and immediately queued for multi-agent debate to determine specific liabilities.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );

  const renderReport = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto py-12 px-8">
      {/* Back Button */}
      <button 
        onClick={() => setViewMode('analysis')}
        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#1f1f1f] transition-colors mb-8 uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Analysis
      </button>

      {/* Header */}
      <div className="bg-white rounded-3xl p-10 border border-gray-200 shadow-sm mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-widest rounded-md border border-emerald-200">Finalized Report</span>
            <span className="text-sm font-semibold text-gray-400">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <h1 className="text-4xl font-bold text-[#1f1f1f] tracking-tight mb-2">SaaS Enterprise Agreement</h1>
          <p className="text-gray-500 text-lg">Kavach Multi-Agent Security & Risk Analysis</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-white border-2 border-[#e0e0e0] text-[#1f1f1f] font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2">
            Share
          </button>
          <button className="px-5 py-2.5 bg-[#1f1f1f] text-white font-bold rounded-xl hover:bg-black transition-colors shadow-sm flex items-center gap-2">
            <FileOutput className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm col-span-1 flex flex-col justify-center">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Contract Risk Score</h3>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-6xl font-bold text-[#1f1f1f] leading-none tracking-tighter">84</span>
            <span className="text-lg font-medium text-gray-400 mb-1">/ 100</span>
          </div>
          <span className="text-sm font-semibold text-emerald-600">Acceptable Risk Profile</span>
        </div>
        
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm col-span-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5" /> Enkrypt AI Security Audit
          </h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-bold text-[#1f1f1f]">Hallucination Risk</span>
              </div>
              <p className="text-2xl font-bold text-[#C69C6D]">5%</p>
              <p className="text-xs text-gray-500 mt-1">All agent justifications verified against trusted legal corpora.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-bold text-[#1f1f1f]">Data Leakage</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">0 Instances</p>
              <p className="text-xs text-gray-500 mt-1">No PII or proprietary terms leaked during LLM processing.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Clause Analysis */}
      <div className="bg-white rounded-3xl p-10 border border-gray-200 shadow-sm">
        <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-8 border-b pb-4">Clause 7.2 &mdash; Limitation of Liability</h3>
        
        <div className="grid grid-cols-2 gap-10">
          <div>
            <h4 className="text-sm font-bold text-[#1f1f1f] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-red-100 text-red-600 flex items-center justify-center text-xs">A</span>
              Original Draft
            </h4>
            <div className="p-5 bg-red-50/50 rounded-2xl border border-red-100 text-[14.5px] leading-relaxed text-red-900 font-serif">
              "IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE..."
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#1f1f1f] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">B</span>
              Final Suggested Revision
            </h4>
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-[14.5px] leading-relaxed text-emerald-900 font-serif">
              "EXCEPT FOR GROSS NEGLIGENCE, WILLFUL MISCONDUCT, OR BREACH OF CONFIDENTIALITY/DATA SECURITY OBLIGATIONS, IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES..."
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-100">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Neutral Judge Rationale</h4>
          <p className="text-[15px] leading-relaxed text-[#444746] font-medium">
            While disclaiming indirect damages is standard practice, the complete exclusion of liability for data loss is an unacceptable transfer of risk for an enterprise deployment. The revised clause aligns with Indian Contract Act Section 73 by carving out exceptions for gross negligence and fundamental data security breaches, ensuring equitable risk distribution while maintaining commercial viability.
          </p>
        </div>
      </div>
    </motion.div>
  );

  const getAgentProps = (role: AgentRole) => {
    switch(role) {
      case 'advocate': return { name: 'User Advocate', icon: <ShieldAlert className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' };
      case 'defender': return { name: 'Company Defender', icon: <Bot className="w-5 h-5" />, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' };
      case 'expert': return { name: 'India Legal Expert', icon: <Scale className="w-5 h-5" />, color: 'text-[#C69C6D]', bg: 'bg-[#C69C6D]/10', border: 'border-[#C69C6D]/20' };
      case 'judge': return { name: 'Neutral Judge', icon: <Gavel className="w-5 h-5" />, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' };
      case 'user': return { name: 'You', icon: null, color: 'text-gray-800', bg: 'bg-gray-100', border: 'border-gray-200' };
    }
  };

  const renderToolBadge = (tool: ToolBadge) => {
    const isQdrant = tool.name.includes("Qdrant");
    const isEnkrypt = tool.name.includes("Enkrypt");
    
    return (
      <div className="group relative inline-flex items-center mr-2 mb-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border cursor-pointer shadow-sm
          ${tool.status === 'success' ? 'bg-white border-[#e0e0e0] text-[#444746]' : 'bg-red-50 border-red-200 text-red-600'}
        `}>
          {isQdrant && <Database className="w-3 h-3 text-[#C69C6D]" />}
          {isEnkrypt && <AlertTriangle className={`w-3 h-3 ${tool.status === 'blocked' ? 'text-red-600' : 'text-emerald-600'}`} />}
          {tool.name}
        </div>
        
        {/* Tooltip */}
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-3 bg-[#1f1f1f] rounded-xl shadow-xl border border-gray-700 z-50">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {tool.status === 'blocked' ? 'Guardrail Interception' : 'Knowledge Retrieval'}
          </div>
          <div className={`text-[12px] font-medium leading-relaxed ${tool.status === 'blocked' ? 'text-red-400' : 'text-emerald-400'}`}>
            {tool.reason || tool.query}
          </div>
          {/* Triangle pointer */}
          <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-[#1f1f1f] border-r border-b border-gray-700 transform rotate-45"></div>
        </div>
      </div>
    );
  };

  const renderDebateRoom = () => {
    // Group messages by round
    const rounds = [1, 2, 3];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col pb-6 max-w-5xl mx-auto w-full">
        
        <div className="p-6 shrink-0 border-b border-[#e0e0e0] bg-[#f8f9fa] z-10 sticky top-0">
          <h2 className="text-2xl font-bold text-[#1f1f1f] flex items-center gap-3">
            <Activity className="w-6 h-6 text-[#C69C6D]" /> The Debate Room
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-8">
            
            {rounds.map(roundNum => {
              const roundMsgs = visibleMessages.filter(m => m.round === roundNum);
              if (roundMsgs.length === 0 && (!isTyping || isTyping === 'judge')) return null;

              return (
                <div key={`round-${roundNum}`} className="border border-[#e0e0e0] bg-white rounded-3xl p-6 shadow-sm">
                  <div className="text-center mb-6">
                    <span className="px-4 py-1.5 bg-gray-100 text-gray-500 text-[11px] font-bold uppercase tracking-widest rounded-full border border-gray-200">
                      {roundNum === 1 ? 'Round 1: Opening Arguments' : roundNum === 2 ? 'Round 2: Rebuttals' : 'Round 3: Adjudication'}
                    </span>
                  </div>

                  <div className="space-y-6">
                    {roundMsgs.map(msg => {
                      const agent = getAgentProps(msg.role);
                      const isLeft = msg.role !== 'user';
                      
                      return (
                        <div key={msg.id} className={`flex w-full mt-6 gap-3 ${isLeft ? 'justify-start' : 'justify-end'}`}>
                          
                          {/* Avatar (Left) */}
                          {isLeft && (
                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-auto mb-1 shadow-sm border ${agent.bg} ${agent.border} ${agent.color}`}>
                              {React.cloneElement(agent.icon as React.ReactElement, { className: 'w-4 h-4' })}
                            </div>
                          )}

                          <div className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isLeft ? 'items-start' : 'items-end'}`}>
                            {/* Sender Name */}
                            <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-2 ${agent.color}`}>
                              {agent.name}
                            </span>
                            
                            {/* Chat Bubble */}
                            <div className={`relative px-5 py-3.5
                              ${!isLeft ? 'bg-[#1f1f1f] text-white rounded-[20px] rounded-br-[4px]' : `bg-[#f0f2f5] text-[#1f1f1f] rounded-[20px] rounded-bl-[4px]`}
                            `}>
                              {/* Tool Badges */}
                              {msg.tools && msg.tools.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                  {msg.tools.map((t, i) => <div key={i}>{renderToolBadge(t)}</div>)}
                                </div>
                              )}

                              <div className="text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap">
                                {msg.text}
                              </div>
                            </div>
                          </div>

                          {/* Avatar (Right) */}
                          {!isLeft && (
                            <div className="shrink-0 w-8 h-8 rounded-full bg-[#1f1f1f] text-white flex items-center justify-center font-bold text-xs mt-auto mb-1 shadow-sm">
                              {userInitials}
                            </div>
                          )}

                        </div>
                      );
                    })}

                    {/* Typing Indicator if it belongs in this round */}
                    {isTyping && isTyping !== 'judge' && (
                      <div className="flex items-center gap-2 text-[12px] font-medium text-[#a0a0a0] justify-center pt-4">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        {getAgentProps(isTyping).name} is writing...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* NEUTRAL JUDGE VERDICT BOX */}
            {showVerdict && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 border-2 border-[#C69C6D] bg-[#4a301e] rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                    <Gavel className="w-6 h-6 text-[#4a301e]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Neutral Judge Verdict</h3>
                    <p className="text-white/60 text-[12px] uppercase tracking-widest font-bold">Analysis Complete</p>
                  </div>
                </div>

                <p className="text-white/90 text-[15px] leading-relaxed mb-8 relative z-10 font-serif">
                  While disclaiming indirect damages is standard practice, the complete exclusion of liability for data loss is an unacceptable transfer of risk for an enterprise deployment. Indian courts may view this as an unconscionable contract under Section 73 if a fundamental security breach occurs. The Company Defender's justification relies on hallucinations blocked by Enkrypt AI.
                </p>

                <div className="flex justify-end relative z-10">
                  <button 
                    onClick={() => setViewMode('report')}
                    className="px-6 py-3 bg-white text-[#4a301e] font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    View Full Report
                  </button>
                </div>
              </motion.div>
            )}

            {/* User Messages after verdict */}
            {visibleMessages.filter(m => (m.role as string) === 'user' || ((m.role as string) !== 'user' && m.id > 5)).map(msg => {
              const agent = getAgentProps(msg.role);
              const isLeft = msg.role !== 'user';
              
              return (
                <div key={msg.id} className={`flex w-full mt-6 gap-3 ${isLeft ? 'justify-start' : 'justify-end'}`}>
                  
                  {/* Avatar (Left) */}
                  {isLeft && (
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-auto mb-1 shadow-sm border ${agent.bg} ${agent.border} ${agent.color}`}>
                      {React.cloneElement(agent.icon as React.ReactElement, { className: 'w-4 h-4' })}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isLeft ? 'items-start' : 'items-end'}`}>
                    {/* Sender Name */}
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-2 ${!isLeft ? 'text-[#1f1f1f]' : agent.color}`}>
                      {!isLeft ? userName : agent.name}
                    </span>
                    
                    {/* Chat Bubble */}
                    <div className={`relative px-5 py-3.5
                      ${!isLeft ? 'bg-[#1f1f1f] text-white rounded-[20px] rounded-br-[4px]' : `bg-[#f0f2f5] text-[#1f1f1f] rounded-[20px] rounded-bl-[4px]`}
                    `}>
                      {/* Tool Badges */}
                      {msg.tools && msg.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {msg.tools.map((t, i) => <div key={i}>{renderToolBadge(t)}</div>)}
                        </div>
                      )}

                      <div className="text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    </div>
                  </div>

                  {/* Avatar (Right) */}
                  {!isLeft && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#1f1f1f] text-white flex items-center justify-center font-bold text-xs mt-auto mb-1 shadow-sm">
                      {userInitials}
                    </div>
                  )}

                </div>
              );
            })}

            {isTyping === 'expert' && showVerdict && (
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#a0a0a0] pt-4">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-[#C69C6D] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                India Legal Expert is replying...
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* HUMAN CHAT INPUT (Only shows after verdict) */}
        <AnimatePresence>
          {showVerdict && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="p-6 shrink-0 bg-[#f8f9fa] border-t border-[#e0e0e0] relative z-20"
            >
              <form onSubmit={handleUserChatSubmit} className="relative max-w-4xl mx-auto">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask the agents a question or propose a new clause..."
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-2xl px-6 py-4 pr-16 text-[15px] text-[#1f1f1f] focus:outline-none focus:border-[#C69C6D] shadow-sm transition-all"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="absolute right-3 top-3 bottom-3 w-10 bg-[#C69C6D] hover:bg-[#b0885c] disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderNegotiationRoom = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-10 shrink-0">
        <h2 className="text-3xl font-bold text-[#1f1f1f] tracking-tight mb-2 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#C69C6D]/10 rounded-xl flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-[#C69C6D]" />
          </div>
          Negotiation Suggestions
        </h2>
        <p className="text-[#664229]/70 text-[15px] max-w-2xl mt-2 font-medium">
          Strategic pushbacks and alternative clauses generated by the User Advocate agent.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-16 pr-6 space-y-6">
        
        {/* Suggestion 1 */}
        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm hover:border-[#C69C6D]/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold text-[#C69C6D] uppercase tracking-widest bg-[#C69C6D]/10 px-2 py-0.5 rounded-md border border-[#C69C6D]/20 mb-2 inline-block">Suggestion 1</span>
              <h3 className="font-bold text-[#1f1f1f] text-lg">Push back on 'Limitation of Liability'</h3>
            </div>
          </div>
          <div className="bg-[#f8f9fa] p-4 rounded-xl border border-gray-100 text-[14.5px] text-[#444746] leading-relaxed mb-4">
            Instead of accepting a blanket waiver of all indirect damages, request a cap equal to 12 months of service fees. This gives you baseline protection without breaking standard SaaS norms.
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-[#1f1f1f] text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">Apply Redline</button>
            <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Dismiss</button>
          </div>
        </div>

        {/* Suggestion 2 */}
        <div className="bg-white rounded-2xl p-6 border border-[#e0e0e0] shadow-sm hover:border-[#C69C6D]/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold text-[#C69C6D] uppercase tracking-widest bg-[#C69C6D]/10 px-2 py-0.5 rounded-md border border-[#C69C6D]/20 mb-2 inline-block">Suggestion 2</span>
              <h3 className="font-bold text-[#1f1f1f] text-lg">Reject 'Proprietary AI Data Rights'</h3>
            </div>
          </div>
          <div className="bg-[#f8f9fa] p-4 rounded-xl border border-gray-100 text-[14.5px] text-[#444746] leading-relaxed mb-4">
            This clause bypasses the NDA and allows them to train models on your proprietary data. You must strictly require an opt-out or strike this clause entirely.
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-[#1f1f1f] text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">Apply Redline</button>
            <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Dismiss</button>
          </div>
        </div>
        
      </div>
    </motion.div>
  );

  // --- Main Render ---

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] text-[#444746] font-sans selection:bg-[#C69C6D]/30 flex flex-col h-screen overflow-hidden">
      
      {/* 1. COMPACT HEADER */}
      <header className="w-full flex items-center justify-between px-6 sm:px-8 py-3 shrink-0 relative z-20 bg-[#f8f9fa] border-b border-[#e0e0e0]">
        
        {/* Left: Back Button & Logo */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200 transition-all text-gray-600 hover:text-gray-900 shadow-sm text-sm font-medium group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="relative w-32 h-10 hover:opacity-90 transition-opacity cursor-pointer">
            <Image 
              src="/trans_logo.png" 
              alt="Kavach Logo" 
              fill 
              className="object-contain object-left" 
              priority 
            />
          </div>
        </div>
        
        {/* Right: Profile Avatar */}
        <div className="flex justify-end relative" ref={profileRef}>
          <div 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 p-1.5 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 cursor-pointer transition-all group"
          >
            <div className="hidden lg:flex flex-col text-right mr-1">
              <span className="text-[14px] font-semibold text-[#1f1f1f] leading-none">{userName}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#C69C6D] text-white flex items-center justify-center font-bold shadow-sm text-sm hover:shadow-md transition-shadow">
              {userInitials}
            </div>
          </div>
          
          {/* Dropdown Menu */}
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#e0e0e0] overflow-hidden z-50"
              >
                <div className="p-5 border-b border-[#e0e0e0] bg-gradient-to-b from-white to-[#f8f9fa]">
                  <h3 className="text-[16px] font-bold text-[#1f1f1f]">{userName}</h3>
                  <p className="text-[13px] text-[#444746] mt-1 font-medium">{user?.email || ""}</p>
                  <div className="mt-4 inline-block px-3 py-1.5 bg-[#C69C6D]/10 text-[#664229] text-[10px] font-bold tracking-widest uppercase rounded-md border border-[#C69C6D]/20">
                    Kavach Member
                  </div>
                </div>
                <div className="p-2">
                  <button onClick={() => signOut()} className="w-full text-left px-4 py-2.5 text-[14px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors flex items-center gap-3">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      {viewMode === 'report' ? (
        <main className="flex-1 w-full bg-[#f8f9fa] overflow-y-auto custom-scrollbar">
          {renderReport()}
        </main>
      ) : (
        <main className="flex-1 w-full flex overflow-hidden">
          
          {/* LEFT PANE: Dynamic Stage (75%) */}
          <div className="flex-1 h-full bg-[#f8f9fa] relative flex flex-col overflow-hidden">
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
              {activeTab === 'debate' && renderDebateRoom()}
              {activeTab === 'negotiation' && renderNegotiationRoom()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT PANE: Navigation (25%) */}
        <div className="w-[360px] shrink-0 h-full bg-[#f8f9fa] border-l border-[#e0e0e0] flex flex-col z-10 relative overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* Box 1: Enkrypt AI Security Overview */}
          <div className="bg-white rounded-[24px] border border-[#e0e0e0] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 shrink-0">
            <h2 className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-6 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" /> Safety Overview
            </h2>
            
            <div className="space-y-6">
              {/* Contract Safe Score */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">Contract Risk Score</span>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-[#1f1f1f] leading-none">84</span>
                    <span className="text-[12px] font-medium text-gray-400 mb-0.5">/ 100</span>
                  </div>
                </div>
                {/* Sleek horizontal gauge */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex mb-1">
                  <div className="h-full bg-[#1f1f1f] rounded-full w-[84%] relative">
                    <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/30"></div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600">Acceptable Risk Profile</span>
              </div>

              {/* Enkrypt AI Hallucination Score */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    AI Hallucination Risk
                  </span>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-[#C69C6D] leading-none">5</span>
                    <span className="text-[12px] font-medium text-gray-400 mb-0.5">%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex mb-1">
                  <div className="h-full bg-[#C69C6D] rounded-full w-[5%] relative shadow-[0_0_8px_rgba(198,156,109,0.8)]"></div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600">Enkrypt AI Certified</span>
              </div>
              
            </div>
          </div>

          {/* Box 2: Live Workflow */}
          <div className="bg-white rounded-[24px] border border-[#e0e0e0] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 relative flex-1 shrink-0 flex flex-col">
            <h2 className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Live Workflow
            </h2>
            
            <div className="relative flex-1 pt-1">
              {/* Perfect Timeline Track */}
              <div className="absolute left-[16px] top-4 bottom-4 w-[2px] bg-gray-100 rounded-full"></div>

              <div className="space-y-4 relative">
                {[
                  { id: 'clauses', icon: <FileCheck2 className="w-4 h-4" />, label: 'Breakdown', desc: 'Secure Parsing' },
                  { id: 'debate', icon: <Gavel className="w-4 h-4" />, label: 'Debate Room', desc: 'Live AI Negotiation' },
                  { id: 'negotiation', icon: <MessageSquare className="w-4 h-4" />, label: 'Suggestions', desc: 'Actionable Insights' },
                ].map((item) => {
                  const isUnlocked = unlockedTabs.includes(item.id as TabId);
                  const isActive = activeTab === item.id;
                  const isPast = unlockedTabs.indexOf(item.id as TabId) < unlockedTabs.indexOf(activeTab);

                  return (
                    <div key={item.id} className="relative z-10 pl-10 group cursor-pointer" onClick={() => isUnlocked && setActiveTab(item.id as TabId)}>
                      
                      {/* Timeline Node */}
                      <div className={`absolute left-[11px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-[2px] border-white transition-all duration-300 z-20 shadow-sm
                        ${isActive ? 'bg-[#C69C6D] ring-[3px] ring-[#C69C6D]/20 scale-[1.3]' : 
                          isPast ? 'bg-emerald-500' : 'bg-gray-300'}
                      `}></div>

                      {/* Box Design */}
                      <div className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center gap-4
                        ${isActive ? 'bg-gradient-to-br from-[#1f1f1f] to-gray-800 border-gray-700 shadow-[0_8px_20px_rgba(0,0,0,0.12)] -translate-y-0.5' : 
                          isPast ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm' :
                          'bg-[#f8f9fa] border-transparent opacity-60'}
                      `}>
                        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors
                          ${isActive ? 'bg-white/10 text-[#C69C6D]' : 
                            isPast ? 'bg-gray-50 text-[#1f1f1f] border border-gray-100' :
                            'bg-gray-200 text-gray-400'}
                        `}>
                          {item.icon}
                        </div>
                        
                        <div className="flex flex-col">
                          <span className={`text-[14px] font-bold tracking-tight transition-colors
                            ${isActive ? 'text-white' : isPast ? 'text-[#1f1f1f]' : 'text-gray-400'}
                          `}>
                            {item.label}
                          </span>
                          <span className={`text-[11px] font-medium transition-colors mt-0.5 tracking-wide
                            ${isActive ? 'text-gray-300' : 'text-gray-500'}
                          `}>
                            {item.desc}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Footer Button as its own element */}
          <button className="w-full py-4 rounded-2xl bg-[#1f1f1f] text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-gray-800 hover:shadow-md transition-all shrink-0">
            <FileOutput className="w-4 h-4" />
            Export Final Report
          </button>

        </div>
      </main>
      )}
    </div>
  );
}
