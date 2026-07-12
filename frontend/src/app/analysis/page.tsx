"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ShieldAlert, FileText, Bot, Scale, Activity, Gavel, CheckCircle2, ChevronRight, Send, Database, AlertTriangle, FileOutput, Search, Lightbulb, FileCheck2, MessageSquare, Users, Calendar, Briefcase, DollarSign, Landmark, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from 'react-markdown';
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
  id: number | string;
  role: AgentRole;
  round?: number;
  text: string;
  tools?: ToolBadge[];
};

function AnalysisContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

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

  const [documentData, setDocumentData] = useState<any>(null);
  const [finalScoreData, setFinalScoreData] = useState<any>(null);
  const [finalVerdictText, setFinalVerdictText] = useState<string>("");

  useEffect(() => {
    if (!sessionId) return;
    
    // Connect to the Fastify API (use 127.0.0.1 to avoid localhost resolution issues)
    const fastifyUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
    
    // 1. Fetch initial document clauses
    fetch(`${fastifyUrl}/api/documents/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.extractedData) {
          setDocumentData(data);
        }
      })
      .catch(err => console.error("Error fetching doc data:", err));

    // 2. Connect to SSE Stream
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
        } else if (data.type === 'stream_start') {
          setIsTyping(data.agent);
          setVisibleMessages(prev => {
            if (prev.find(m => m.id === data.msg.id)) return prev;
            return [...prev, data.msg];
          });
        } else if (data.type === 'stream_chunk') {
          setVisibleMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === data.msg.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], text: updated[idx].text + data.msg.text };
            }
            return updated;
          });
        } else if (data.type === 'stream_end') {
          setIsTyping(null);
        } else if (data.type === 'message') {
          setIsTyping(null);
          setVisibleMessages(prev => [...prev, { ...data.msg, id: Date.now() }]);
        } else if (data.type === 'verdict') {
          setIsTyping(null);
          setShowVerdict(true);
          setProgressStatus(prev => ({ ...prev, debate: 'completed' }));
        } else if (data.type === 'complete') {
          setFinalScoreData(data.scoreData);
          setFinalVerdictText(data.finalVerdictText);
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

  const renderClausesView = () => {
    if (!documentData || !documentData.extractedData) {
      return (
        <div className="p-8 flex items-center justify-center h-full">
          <p className="text-gray-500 font-medium">Loading document data...</p>
        </div>
      );
    }

    const { extractedData } = documentData;
    const title = extractedData.title || "Document Analysis";
    
    // Filter out top-level metadata for the clauses list
    const fieldsToRender = Object.entries(extractedData).filter(([k]) => !['title', 'isLegalDocument', 'riskLevel', 'rejectionReason'].includes(k));

    const getSectionIcon = (key: string) => {
      const k = key.toLowerCase();
      if (k.includes('part')) return { icon: <Users className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50 border border-blue-100" };
      if (k.includes('date') || k.includes('time')) return { icon: <Calendar className="w-5 h-5 text-purple-600" />, bg: "bg-purple-50 border border-purple-100" };
      if (k.includes('oblig') || k.includes('respons')) return { icon: <Briefcase className="w-5 h-5 text-indigo-600" />, bg: "bg-indigo-50 border border-indigo-100" };
      if (k.includes('finan') || k.includes('pay') || k.includes('fee')) return { icon: <DollarSign className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50 border border-emerald-100" };
      if (k.includes('law') || k.includes('juris') || k.includes('govern')) return { icon: <Landmark className="w-5 h-5 text-amber-600" />, bg: "bg-amber-50 border border-amber-100" };
      if (k.includes('critic') || k.includes('risk') || k.includes('liab')) return { icon: <AlertCircle className="w-5 h-5 text-red-600" />, bg: "bg-red-50 border border-red-100" };
      return { icon: <FileCheck2 className="w-5 h-5 text-gray-700" />, bg: "bg-gray-100 border border-gray-200" };
    };

    const renderSmartValue = (val: any, themeColor: string = "text-gray-900"): React.ReactNode => {
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          return (
            <div className="flex flex-col gap-4 mt-2">
              {val.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-5">
                    {Object.entries(item).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <span className="text-[11px] font-bold text-black/40 uppercase tracking-widest mb-1.5">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-[15px] text-black font-semibold leading-relaxed break-words">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        return (
          <ul className="space-y-3 mt-2 pl-1">
            {val.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-black/5">
                <ChevronRight className={`w-5 h-5 ${themeColor.split(' ')[0]} mt-0.5 shrink-0`} />
                <span className="text-[15px] text-black font-medium leading-relaxed break-words">{String(item)}</span>
              </li>
            ))}
          </ul>
        );
      } else if (typeof val === 'object' && val !== null) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {Object.entries(val).map(([k, v]) => (
              <div key={k} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                <h4 className="text-[11px] font-bold text-black/40 uppercase tracking-widest mb-2">{k.replace(/([A-Z])/g, ' $1').trim()}</h4>
                <div className="text-[15px] text-black font-semibold leading-relaxed break-words">{renderSmartValue(v, themeColor)}</div>
              </div>
            ))}
          </div>
        );
      } else {
        return <span className="text-black text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-words">{String(val)}</span>;
      }
    };

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-10 shrink-0">
          <h2 className="text-3xl font-bold text-black tracking-tight mb-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
              <FileText className="w-5 h-5 text-black" />
            </div>
            {title}
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-16 pr-6">
          <div className="space-y-8">
            {fieldsToRender.map(([key, value], idx) => {
              const style = getSectionIcon(key);
              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} key={idx} className={`${style.bg} rounded-3xl p-8 shadow-sm hover:shadow-md transition-all duration-200`}>
                  <div className="flex items-center gap-4 mb-6 border-b border-black/10 pb-5">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-white flex items-center justify-center shrink-0">
                      {style.icon}
                    </div>
                    <h3 className="text-2xl font-black text-black capitalize tracking-tight">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  </div>
                  
                  <div className="pl-1">
                    {renderSmartValue(value, style.icon.props.className)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderReport = () => {
    if (!finalScoreData) {
      return (
        <div className="p-8 flex items-center justify-center h-full">
          <p className="text-gray-500 font-medium animate-pulse">Report is still generating...</p>
        </div>
      );
    }

    const docTitle = documentData?.extractedData?.title || "Document Analysis";
    const riskLevel = finalScoreData.overall_risk_level || "Unknown";
    const riskScore = finalScoreData.overall_risk_score || 0;
    const summary = finalScoreData.summary || "No summary available.";
    const enkryptScore = finalScoreData.enkrypt_hallucination_score !== undefined ? finalScoreData.enkrypt_hallucination_score : "?";
    
    // Determine risk color
    let riskColor = "text-emerald-600";
    if (riskLevel === "medium") riskColor = "text-[#C69C6D]";
    if (riskLevel === "high" || riskLevel === "critical") riskColor = "text-red-600";

    return (
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
            <h1 className="text-4xl font-bold text-[#1f1f1f] tracking-tight mb-2">{docTitle}</h1>
            <p className="text-gray-500 text-lg">Kavach Multi-Agent Security & Risk Analysis</p>
          </div>
          <div className="flex gap-3">
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
              <span className="text-6xl font-bold text-[#1f1f1f] leading-none tracking-tighter">{riskScore}</span>
              <span className="text-lg font-medium text-gray-400 mb-1">/ 100</span>
            </div>
            <span className={`text-sm font-semibold capitalize ${riskColor}`}>{riskLevel} Risk Profile</span>
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
                <p className="text-2xl font-bold text-[#C69C6D]">{enkryptScore}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {finalScoreData.enkrypt_explanation || "Agent justifications verified against trusted legal corpora."}
                </p>
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

        {/* Final Verdict Details */}
        <div className="bg-white rounded-3xl p-10 border border-gray-200 shadow-sm">
          <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-8 border-b pb-4">Executive Summary</h3>
          
          <div className="mb-8">
            <ReactMarkdown 
              components={{
                h3: ({node, ...props}) => <h3 className="text-lg font-bold text-[#1f1f1f] mt-6 mb-3" {...props} />,
                h4: ({node, ...props}) => <h4 className="text-base font-bold text-[#1f1f1f] mt-5 mb-2" {...props} />,
                p: ({node, ...props}) => <p className="text-[15px] leading-relaxed text-[#444746] font-medium mb-4 whitespace-pre-wrap" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-[15px] text-[#444746]" {...props} />,
                li: ({node, ...props}) => <li {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-[#1f1f1f]" {...props} />
              }}
            >
              {summary}
            </ReactMarkdown>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Neutral Judge Rationale</h4>
            <ReactMarkdown 
              components={{
                h3: ({node, ...props}) => <h3 className="text-lg font-bold text-[#1f1f1f] mt-6 mb-3" {...props} />,
                h4: ({node, ...props}) => <h4 className="text-base font-bold text-[#1f1f1f] mt-5 mb-2" {...props} />,
                p: ({node, ...props}) => <p className="text-[15px] leading-relaxed text-[#444746] font-medium mb-4 whitespace-pre-wrap" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-[15px] text-[#444746]" {...props} />,
                li: ({node, ...props}) => <li {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-[#1f1f1f]" {...props} />
              }}
            >
              {finalVerdictText}
            </ReactMarkdown>
          </div>
        </div>
      </motion.div>
    );
  };

  const formatMessageText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-black opacity-90">{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
        {i !== text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const getAgentProps = (role: AgentRole) => {
    switch(role) {
      case 'advocate': return { name: 'User Advocate', icon: <ShieldAlert className="w-5 h-5" />, color: 'text-[#1f1f1f]', bubbleBg: 'bg-[#1f1f1f]', bubbleText: 'text-white' };
      case 'defender': return { name: 'Company Defender', icon: <Bot className="w-5 h-5" />, color: 'text-[#4a301e]', bubbleBg: 'bg-[#4a301e]', bubbleText: 'text-white' };
      case 'expert': return { name: 'India Legal Expert', icon: <Scale className="w-5 h-5" />, color: 'text-[#C69C6D]', bubbleBg: 'bg-[#C69C6D]', bubbleText: 'text-white' };
      case 'judge': return { name: 'Neutral Judge', icon: <Gavel className="w-5 h-5" />, color: 'text-[#664229]', bubbleBg: 'bg-white border border-[#C69C6D]/30', bubbleText: 'text-[#1f1f1f]' };
      case 'user': return { name: 'You', icon: null, color: 'text-gray-800', bubbleBg: 'bg-[#f8f9fa] border border-[#e0e0e0]', bubbleText: 'text-[#1f1f1f]' };
    }
  };

  const renderToolBadge = (tool: ToolBadge) => {
    const isQdrant = tool.name.includes("Qdrant");
    const isEnkrypt = tool.name.includes("Enkrypt");
    
    let badgeStyle = "bg-white border-[#e0e0e0] text-[#444746]";
    let iconStyle = "text-[#C69C6D]";

    if (tool.status === 'blocked') {
      badgeStyle = "bg-red-50 border-red-200 text-red-600";
      iconStyle = "text-red-600";
    } else if (isQdrant) {
      badgeStyle = "bg-[#E8415F] border-[#E8415F] text-white";
      iconStyle = "text-white";
    } else if (isEnkrypt) {
      badgeStyle = "bg-[#7c3aed] border-[#7c3aed] text-white";
      iconStyle = "text-white";
    }

    return (
      <div className="group relative inline-flex items-center mr-2 mb-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border cursor-pointer shadow-sm transition-colors ${badgeStyle}`}>
          {isQdrant && <Database className={`w-3 h-3 ${iconStyle}`} />}
          {isEnkrypt && <AlertTriangle className={`w-3 h-3 ${iconStyle}`} />}
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
                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-auto mb-1 shadow-sm ${agent.bubbleBg} text-white`}>
                              {React.cloneElement(agent.icon as any, { className: 'w-4 h-4' })}
                            </div>
                          )}

                          <div className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isLeft ? 'items-start' : 'items-end'}`}>
                            {/* Sender Name */}
                            <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-2 ${agent.color}`}>
                              {agent.name}
                            </span>
                            
                            {/* Chat Bubble */}
                            <div className={`relative px-5 py-3.5 shadow-sm
                              ${!isLeft ? `${agent.bubbleBg} ${agent.bubbleText} rounded-[20px] rounded-br-[4px]` : `${agent.bubbleBg} ${agent.bubbleText} rounded-[20px] rounded-bl-[4px]`}
                            `}>
                              {/* Tool Badges */}
                              {msg.tools && msg.tools.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                  {msg.tools.map((t, i) => <div key={i}>{renderToolBadge(t)}</div>)}
                                </div>
                              )}

                              <div className="text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap">
                                {formatMessageText(msg.text)}
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

                <p className="text-white/90 text-[15px] leading-relaxed mb-8 relative z-10 font-serif whitespace-pre-wrap">
                  The final comprehensive report and risk analysis is ready to view.
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
            {visibleMessages.filter((m, i) => (m.role as string) === 'user' || ((m.role as string) !== 'user' && i > 5)).map(msg => {
              const agent = getAgentProps(msg.role);
              const isLeft = msg.role !== 'user';
              
              return (
                <div key={msg.id} className={`flex w-full mt-6 gap-3 ${isLeft ? 'justify-start' : 'justify-end'}`}>
                  
                  {/* Avatar (Left) */}
                  {isLeft && (
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-auto mb-1 shadow-sm ${agent.bubbleBg} text-white`}>
                      {React.cloneElement(agent.icon as any, { className: 'w-4 h-4' })}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isLeft ? 'items-start' : 'items-end'}`}>
                    {/* Sender Name */}
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 mx-2 ${!isLeft ? 'text-[#1f1f1f]' : agent.color}`}>
                      {!isLeft ? userName : agent.name}
                    </span>
                    
                    {/* Chat Bubble */}
                    <div className={`relative px-5 py-3.5 shadow-sm
                      ${!isLeft ? `${agent.bubbleBg} ${agent.bubbleText} rounded-[20px] rounded-br-[4px]` : `${agent.bubbleBg} ${agent.bubbleText} rounded-[20px] rounded-bl-[4px]`}
                    `}>
                      {/* Tool Badges */}
                      {msg.tools && msg.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {msg.tools.map((t, i) => <div key={i}>{renderToolBadge(t)}</div>)}
                        </div>
                      )}

                      <div className="text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap">
                        {formatMessageText(msg.text)}
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
        <main className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden">
          
          {/* LEFT PANE: Dynamic Stage */}
          <div className="flex-1 h-full bg-[#f8f9fa] relative flex flex-col overflow-y-auto lg:overflow-hidden min-h-[60vh] lg:min-h-0">
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

        {/* RIGHT PANE: Navigation */}
        <div className="w-full lg:w-[360px] shrink-0 h-auto lg:h-full bg-[#f8f9fa] border-t lg:border-t-0 lg:border-l border-[#e0e0e0] flex flex-col z-10 relative overflow-y-auto custom-scrollbar p-6 space-y-6">
          
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
                    <span className="text-3xl font-bold text-[#1f1f1f] leading-none">
                      {finalScoreData?.overall_risk_score ?? '--'}
                    </span>
                    <span className="text-[12px] font-medium text-gray-400 mb-0.5">/ 100</span>
                  </div>
                </div>
                {/* Sleek horizontal gauge */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex mb-1">
                  <div className="h-full bg-[#1f1f1f] rounded-full relative transition-all duration-1000" style={{ width: typeof finalScoreData?.overall_risk_score === 'number' ? `${finalScoreData.overall_risk_score}%` : '0%' }}>
                    <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/30"></div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 capitalize">
                  {finalScoreData?.overall_risk_level ? `${finalScoreData.overall_risk_level} Risk Profile` : 'Analyzing...'}
                </span>
              </div>

              {/* Enkrypt AI Hallucination Score */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${finalScoreData ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                    AI Hallucination Risk
                  </span>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-[#C69C6D] leading-none">
                      {finalScoreData?.enkrypt_hallucination_score ?? '--'}
                    </span>
                    <span className="text-[12px] font-medium text-gray-400 mb-0.5">%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex mb-1">
                  <div className="h-full bg-[#C69C6D] rounded-full relative shadow-[0_0_8px_rgba(198,156,109,0.8)] transition-all duration-1000" style={{ width: typeof finalScoreData?.enkrypt_hallucination_score === 'number' ? `${finalScoreData.enkrypt_hallucination_score}%` : '0%' }}></div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {finalScoreData ? 'Enkrypt AI Certified' : 'Verifying...'}
                </span>
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

export default function AnalysisPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">Loading...</div>}>
      <AnalysisContent />
    </React.Suspense>
  );
}
