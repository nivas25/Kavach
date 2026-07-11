"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Upload, FileText, MoreVertical, FileCheck2, Loader2, Sparkles, Settings, CheckCircle2, Bot, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { User } from "@supabase/supabase-js";

export default function StylishDashboard() {
  // Input States
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const router = useRouter();

  // User State
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const userInitials = userName.substring(0, 1).toUpperCase();
  
  // Dynamic Greeting & Quotes
  const [quoteIndex, setQuoteIndex] = useState(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const FUNNY_QUOTES = [
    "Because 'I agree' are the two most dangerous words in business.",
    "Reading the terms and conditions so you don't have to.",
    "Finding the loopholes before they find you.",
    "Trust is good, but a bulletproof contract is better.",
    "Making sure your NDA actually NDAs.",
    "Because handshakes don't hold up in court.",
    "Translating 'legalese' into English since 2026.",
    "Spoiler alert: The fine print usually matters.",
    "Saving you from the 'reply all' of legal liabilities.",
    "Your digital magnifying glass for the fine print.",
    "Because 'per my last email' isn't legally binding.",
    "We read the terms so you can blindly click 'Accept'.",
    "Turning 50 pages of anxiety into a 5-minute summary.",
    "Protecting your startup from its own optimism.",
    "Making sure 'standard terms' are actually standard.",
    "Because a gentleman's agreement is a lawyer's nightmare.",
    "Finding the 'gotchas' before they get you.",
    "Your first line of defense against bad deals.",
    "Because 'I didn't read it' is a terrible legal strategy.",
    "Scanning for red flags so you don't have to wear rose-colored glasses.",
    "Where 'Sign Here' meets 'Wait, What?'",
    "Decoding the jargon that keeps lawyers employed.",
    "Because verbal agreements are worth the paper they're written on.",
    "Helping you sign on the dotted line without sweating.",
    "Your AI paralegal that never sleeps (or bills by the hour)."
  ];

  useEffect(() => {
    // Pick a random quote initially
    setQuoteIndex(Math.floor(Math.random() * FUNNY_QUOTES.length));
    
    // Rotate every 1 minute
    const interval = setInterval(() => {
      setQuoteIndex(Math.floor(Math.random() * FUNNY_QUOTES.length));
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Processing State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("Transmitting secure document to backend...");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const simStarted = useRef(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing && uploadProgress >= 90 && uploadProgress < 100 && !simStarted.current) {
      simStarted.current = true;
      const messages = [
        "Parsing document with LlamaParse...",
        "Extracting key clauses with Featherless AI...",
        "Analyzing legal risk vectors...",
        "Generating structured JSON schema...",
        "Wrapping things up..."
      ];
      let msgIndex = 0;
      setProgressMessage(messages[0]);
      
      interval = setInterval(() => {
        setUploadProgress(prev => (prev < 99 ? prev + 1 : 99));
        msgIndex = (msgIndex + 1) % messages.length;
        setProgressMessage(messages[msgIndex]);
      }, 4000);
    }
    
    if (!isAnalyzing || uploadProgress === 100) {
       simStarted.current = false;
       if (uploadProgress === 100) setProgressMessage("Processing complete!");
       else setProgressMessage("Transmitting secure document to backend...");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing, uploadProgress]);
  
  // Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const ALLOWED_EXTS = ['.pdf', '.docx', '.md', '.txt'];

  const validateAndSetFile = (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      setSelectedFile(file);
    } else {
      alert("Invalid file format. Please upload PDF, DOCX, MD, or TXT.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!textInput) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (textInput) return; // Locked because text exists
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const getFileBadgeBg = (filename: string) => {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    switch(ext) {
      case '.pdf': return 'bg-[#E53935]'; // Solid Bright Red
      case '.docx': return 'bg-[#1E88E5]'; // Solid Bright Blue
      case '.md': return 'bg-[#8E24AA]'; // Solid Bright Purple
      case '.txt': return 'bg-[#616161]'; // Solid Dark Gray
      default: return 'bg-[#C69C6D]'; // Solid Kavach Gold
    }
  };
  
  const getFileBadgeText = (filename: string) => {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    switch(ext) {
      case '.pdf': return 'PDF';
      case '.docx': return 'DOCX';
      case '.md': return 'MD';
      case '.txt': return 'TXT';
      default: return 'FILE';
    }
  };

  const handleAnalyzeClick = () => {
    if (!selectedFile && !textInput) return;
    setShowRoleModal(true);
  };

  const handleInitiateAgents = async () => {
    if (!selectedRole) return;
    
    // For now we only support file uploads in this flow
    if (!selectedFile) {
      alert("Please upload a file first.");
      return;
    }

    setShowRoleModal(false);
    setIsAnalyzing(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const userType = selectedRole === 'Others' ? customRole : selectedRole;
      formData.append('userType', userType);
      
      if (user?.id) {
        formData.append('userId', user.id);
      }

      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            // Cap at 90% until the backend extraction finishes
            setUploadProgress(Math.min(percentComplete, 90));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              resolve(xhr.responseText);
            }
          } else {
            reject(new Error(xhr.responseText));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network Error occurred during upload"));
        };

        xhr.send(formData);
      });
      
      // Navigate to the analysis theater view with the session ID
      router.push(`/analysis?sessionId=${data.sessionId}`);
    } catch (error: any) {
      setIsAnalyzing(false);
      
      // Try to parse error to see if it's a legal document rejection
      let errorMessage = "Failed to upload document.";
      try {
        let errorText = error.message;
        
        // If it's a JSON string from our XHR response
        if (errorText.startsWith("{")) {
          const parsed = JSON.parse(errorText);
          if (parsed.error && parsed.error.includes("Backend error: ")) {
             const backendErrStr = parsed.error.replace("Backend error: ", "");
             const backendErr = JSON.parse(backendErrStr);
             if (backendErr.isLegalError || backendErr.error) {
               errorMessage = backendErr.error || backendErr.message || "Document rejected.";
             }
          } else if (parsed.error) {
             errorMessage = parsed.error;
          }
        }
      } catch(e) {
        // Fallback if parsing fails
        if (error.message) errorMessage = error.message;
      }
      
      setUploadError(errorMessage);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const recentAnalyses = [
    { id: 1, name: "Enterprise SaaS Agreement.pdf", date: "You opened today", color: "bg-red-500", risk: "Critical" },
    { id: 2, name: "Employment Contract 2025.docx", date: "You opened yesterday", color: "bg-emerald-500", risk: "Safe" },
    { id: 3, name: "Commercial Office Lease.pdf", date: "You opened past week", color: "bg-amber-500", risk: "Warning" },
    { id: 4, name: "Vendor NDA Template.pdf", date: "You opened past month", color: "bg-emerald-500", risk: "Safe" },
  ];

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] text-[#444746] font-sans selection:bg-[#C69C6D]/30 selection:text-[#664229] relative flex flex-col">
      


      {/* ERROR MODAL FOR NON-LEGAL DOCUMENTS */}
      <AnimatePresence>
        {uploadError && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1f1f1f]/80 backdrop-blur-md"
          >
            <div className="bg-white rounded-[32px] p-10 max-w-md w-full text-center shadow-2xl border-t-8 border-red-500">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-[#1f1f1f] mb-3">Document Rejected</h3>
              <p className="text-red-600 mb-8 text-sm font-medium">
                {uploadError}
              </p>
              <button
                onClick={() => setUploadError(null)}
                className="px-6 py-3 bg-[#1f1f1f] text-white rounded-full font-semibold hover:bg-black transition-colors"
              >
                Try Another Document
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ROLE SELECTION MODAL */}
      <AnimatePresence>
        {showRoleModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1f1f1f]/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden relative border border-[#e0e0e0]"
            >
              <div className="p-8 sm:p-12">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold text-[#1f1f1f] mb-3">Define Your Perspective</h2>
                  <p className="text-[#664229]/80 text-[16px] max-w-2xl mx-auto">
                    Kavach's AI agents need to know who they are defending. Select your persona to calibrate the analysis engine.
                  </p>
                </div>

                {/* 5-Column Grid on Desktop */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                  {[
                    { id: "professional", category: "Primary", label: "Job Seekers & Early Career", support: "Very Strong", img: "https://ik.imagekit.io/nivas25/Kavach/Young_Proffesional_Fresher.jpeg" },
                    { id: "freelancer", category: "Primary", label: "Freelancers & Gig Workers", support: "Very Strong", img: "https://ik.imagekit.io/nivas25/Kavach/Freelancer.jpeg" },
                    { id: "founder", category: "Secondary", label: "Small Business & Founders", support: "Moderate", img: "https://ik.imagekit.io/nivas25/Kavach/Entrepreneur.jpeg" },
                    { id: "consumer", category: "Secondary", label: "General Consumers", support: "Moderate", img: "https://ik.imagekit.io/nivas25/Kavach/Genral_Consumer.jpeg" },
                    { id: "other", category: "Custom", label: "Other (Define Custom)", support: "Adaptive", img: "https://ik.imagekit.io/nivas25/Kavach/Others.jpeg" },
                  ].map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`relative group rounded-2xl overflow-hidden transition-all duration-300 text-center flex flex-col border-2 bg-white
                        ${selectedRole === role.id 
                          ? 'border-[#C69C6D] shadow-[0_8px_30px_rgba(198,156,109,0.2)] scale-105 z-10 ring-4 ring-[#C69C6D]/10' 
                          : 'border-[#e0e0e0] hover:border-[#C69C6D]/40 hover:shadow-md hover:-translate-y-1 z-0'
                        }`}
                    >
                      {/* Fully Visible Image Container */}
                      <div className="aspect-square relative overflow-hidden bg-[#f8f9fa] w-full">
                        <img 
                          src={role.img} 
                          alt={role.label}
                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        {/* Category Tag (Top Right) */}
                        <div className="absolute top-2 right-2 z-10">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest backdrop-blur-md shadow-sm
                            ${role.category === 'Primary' ? 'bg-[#C69C6D]/90 text-white' : 
                              role.category === 'Secondary' ? 'bg-blue-600/90 text-white' : 
                              'bg-gray-600/90 text-white'}`}
                          >
                            {role.category}
                          </span>
                        </div>

                        {/* Selected Indicator */}
                        {selectedRole === role.id && (
                          <div className="absolute top-2 left-2 z-10">
                            <div className="w-6 h-6 rounded-full bg-[#C69C6D] flex items-center justify-center shadow-lg border-2 border-white">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Content Container (Under the image) */}
                      <div className="p-5 flex-1 flex flex-col items-center justify-center bg-white border-t border-[#e0e0e0]/50">
                        <h3 className={`font-bold text-[15px] leading-snug mb-2 transition-colors ${selectedRole === role.id ? 'text-[#664229]' : 'text-[#1f1f1f]'}`}>
                          {role.label}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-auto">
                          <div className={`w-1.5 h-1.5 rounded-full ${role.support === 'Very Strong' ? 'bg-emerald-500' : role.support === 'Moderate' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                          <span className="text-[9px] text-[#666] font-medium uppercase tracking-widest">{role.support} Support</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {selectedRole === "other" && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-8 max-w-xl mx-auto"
                    >
                      <input 
                        type="text" 
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        placeholder="Please specify your perspective (e.g. Tenant, Partner)..."
                        className="w-full bg-[#f8f9fa] border-2 border-[#e0e0e0] rounded-xl px-5 py-4 text-[#1f1f1f] placeholder:text-gray-400 focus:outline-none focus:border-[#C69C6D] focus:bg-white transition-all font-medium text-center shadow-inner"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-center gap-4 mt-8 border-t border-[#e0e0e0] pt-8">
                  <button 
                    onClick={() => setShowRoleModal(false)}
                    className="px-8 py-4 text-[15px] font-bold text-[#444746] hover:bg-[#f8f9fa] rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleInitiateAgents}
                    disabled={!selectedRole || (selectedRole === 'other' && !customRole)}
                    className={`px-12 py-4 text-[15px] font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-3
                      ${!selectedRole || (selectedRole === 'other' && !customRole)
                        ? 'bg-[#e0e0e0] text-[#a0a0a0] cursor-not-allowed'
                        : 'bg-[#4a301e] text-white hover:bg-[#3a2618] shadow-lg hover:shadow-xl'
                      }`}
                  >
                    <Sparkles className="w-5 h-5 text-[#C69C6D]" />
                    Initiate Agents
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. STYLISH FLOATING HEADER */}
      <header className="w-full flex items-center justify-between px-6 sm:px-12 py-6 shrink-0 relative z-20">
        
        {/* Left: Logo (Fluid on mobile, fixed width on desktop) */}
        <div className="w-auto sm:w-[240px]">
          <div className="relative w-32 h-12 sm:w-52 sm:h-20 hover:opacity-90 transition-opacity cursor-pointer">
            <Image 
              src="/trans_logo.png" 
              alt="Kavach Logo" 
              fill 
              className="object-contain object-left" 
              priority 
            />
          </div>
        </div>

        {/* Center: Ultra-Premium Glowing Search Bar */}
        <div className="hidden sm:flex flex-1 justify-center mx-6 relative group">
          {/* Subtle Ambient Aura */}
          <div className="absolute inset-0 max-w-xl mx-auto bg-gradient-to-r from-[#C69C6D]/20 via-[#664229]/10 to-[#C69C6D]/20 blur-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-700 rounded-full pointer-events-none"></div>
          
          <div className="relative flex items-center bg-white border border-[#e0e0e0]/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(198,156,109,0.15)] focus-within:border-[#C69C6D]/50 focus-within:ring-4 focus-within:ring-[#C69C6D]/20 transition-all duration-500 h-14 rounded-full px-5 w-full max-w-xl group-hover:-translate-y-0.5">
            <Search className="w-5 h-5 text-[#444746]/70 group-focus-within:text-[#C69C6D] transition-colors duration-500" />
            <input 
              type="text" 
              placeholder="Search analyses, contracts, or legal risks..." 
              className="bg-transparent border-none outline-none flex-1 px-4 text-[15px] text-[#1f1f1f] placeholder:text-[#444746]/60 placeholder:font-light"
            />
            {/* Modern Keyboard Shortcut Hint */}
            <div className="hidden lg:flex items-center justify-center px-3 py-1.5 rounded-full bg-gradient-to-b from-white to-[#f8f9fa] border border-[#e0e0e0] text-[#664229] text-[11px] font-bold tracking-widest shadow-sm group-hover:border-[#C69C6D]/30 group-hover:bg-[#C69C6D]/5 transition-colors">
              ⌘K
            </div>
          </div>
        </div>
        
        {/* Right: Profile Avatar (Fluid on mobile, fixed width on desktop) */}
        <div className="w-auto sm:w-[200px] flex justify-end relative" ref={profileRef}>
          <div 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 cursor-pointer transition-colors group"
          >
            <div className="hidden lg:flex flex-col text-right mr-1">
              <span className="text-[15px] font-semibold text-[#1f1f1f]">{userName}</span>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#C69C6D] text-white flex items-center justify-center font-bold shadow-sm text-lg hover:shadow-md transition-shadow">
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

      {/* 2. MAIN CANVAS */}
      <main className="flex-1 w-full flex flex-col items-center px-4 sm:px-12 pb-16">
        
        {/* Content Wrapper constrained to max width */}
        <div className="w-full max-w-5xl mt-2 sm:mt-6">
          
          {/* Header Area */}
          <div className="flex flex-col items-center text-center mb-10 mt-6 min-h-[90px]">
            <h1 className="text-3xl sm:text-4xl font-medium text-[#1f1f1f] transition-all duration-500">
              {getGreeting()}, {userName.split(' ')[0]}
            </h1>
            <AnimatePresence mode="wait">
              <motion.p 
                key={quoteIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.5 }}
                className="text-[#664229] mt-3 text-[16px] italic font-medium opacity-80"
              >
                "{FUNNY_QUOTES[quoteIndex]}"
              </motion.p>
            </AnimatePresence>
          </div>

          {/* 3. CONSTRAINED IN-CANVAS INPUT */}
          <div className="mb-16 w-full">
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-white rounded-[32px] border border-[#e0e0e0] shadow-sm p-6 sm:p-10 flex flex-col"
            >
              <h2 className="text-xl font-medium text-[#1f1f1f] mb-8 text-center">Initiate the analysis. <span className="text-[#444746] font-normal">Select a document or paste text to begin.</span></h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* File Upload Box (Highly Visible Branded) */}
                <div 
                  className={`h-[200px] sm:h-[260px] rounded-[24px] border-2 transition-all duration-300 relative overflow-hidden group
                    ${textInput.length > 0 ? 'hidden md:flex flex-col opacity-40 bg-[#f8f9fa] border-[#e0e0e0] pointer-events-none' : 'flex flex-col'}
                    ${selectedFile ? 'border-[#C69C6D] bg-[#FDFBF7] shadow-[0_8px_30px_rgba(198,156,109,0.15)]' 
                                   : 'bg-gradient-to-b from-white to-[#FDFBF7] border-[#C69C6D]/40 shadow-sm hover:border-[#C69C6D] hover:shadow-[0_8px_25px_rgba(198,156,109,0.2)] cursor-pointer'}
                    ${isDragging ? 'border-[#C69C6D] bg-[#FDFBF7] scale-[1.02] shadow-[0_12px_40px_rgba(198,156,109,0.2)]' : ''}
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!selectedFile && !textInput) fileInputRef.current?.click();
                  }}
                >
                  {!selectedFile ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8 relative z-10">
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 transition-all duration-300 
                        ${isDragging ? 'bg-[#C69C6D] text-white scale-110 shadow-lg' 
                                     : 'bg-[#C69C6D]/15 text-[#664229] group-hover:bg-[#C69C6D] group-hover:text-white group-hover:shadow-md group-hover:scale-105'}`}
                      >
                        <Upload className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                      <span className="text-base sm:text-lg text-[#1f1f1f] font-semibold mb-1 sm:mb-2 transition-colors group-hover:text-[#664229]">Upload or drag a file</span>
                      <span className="text-xs sm:text-sm text-[#664229]/70 font-medium">Supports PDF, DOCX, MD, TXT</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8 relative z-10">
                      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${getFileBadgeBg(selectedFile.name)} flex flex-col items-center justify-center mb-4 sm:mb-5 shadow-lg transform hover:scale-105 transition-transform cursor-default`}>
                        <FileCheck2 className="w-6 h-6 sm:w-7 sm:h-7 text-white mb-1" />
                        <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-widest">{getFileBadgeText(selectedFile.name)}</span>
                      </div>
                      <span className="text-base sm:text-lg text-[#1f1f1f] font-bold mb-4 sm:mb-5 line-clamp-1 px-4">{selectedFile.name}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile();
                        }}
                        className="text-[13px] sm:text-[14px] font-bold text-red-500 hover:text-white hover:bg-red-500 px-5 sm:px-6 py-2 rounded-full transition-all duration-300 border border-red-200 hover:border-red-500 hover:shadow-md"
                      >
                        Remove file
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.md,.txt" onChange={handleFileChange} />
                </div>

                {/* Text Paste Box (Highly Visible Branded) */}
                <div 
                  className={`h-[200px] sm:h-[260px] transition-all duration-300 relative group
                    ${selectedFile ? 'hidden md:flex flex-col opacity-40 pointer-events-none' : 'flex flex-col'}
                  `}
                >
                  <textarea 
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Or securely paste your legal text here..."
                    className="flex-1 w-full rounded-[24px] border-2 border-[#C69C6D]/40 bg-gradient-to-b from-white to-[#FDFBF7] shadow-sm p-7 text-[16px] leading-relaxed resize-none transition-all duration-300 hover:border-[#C69C6D] hover:shadow-[0_8px_25px_rgba(198,156,109,0.2)] focus:outline-none focus:border-[#C69C6D] focus:ring-4 focus:ring-[#C69C6D]/15 focus:bg-white focus:shadow-[0_12px_30px_rgba(198,156,109,0.25)] text-[#1f1f1f] placeholder:text-[#664229]/50 placeholder:font-medium relative z-10"
                  />
                </div>
              </div>

              {/* Intelligent Action Area OR Loading Area */}
              <AnimatePresence mode="wait">
                {isAnalyzing ? (
                  <motion.div 
                    key="progress"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="flex flex-col items-center overflow-hidden border-t border-[#e0e0e0] pt-8"
                  >
                    <div className="w-full max-w-md">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-[#1f1f1f]">
                          {uploadProgress < 100 ? "Uploading Document..." : "Parsing & Extracting..."}
                        </span>
                        <span className="text-xs font-bold text-[#664229]">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-[#f8f9fa] rounded-full h-3 mb-3 overflow-hidden border border-[#e0e0e0]">
                        <div 
                          className="bg-[#C69C6D] h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                          style={{ width: `${uploadProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                      <p className="text-[#664229]/70 text-[13px] text-center font-medium min-h-[40px] flex items-center justify-center">
                        {progressMessage}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  (selectedFile || textInput.length > 0) && (
                    <motion.div 
                      key="action"
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="flex justify-end overflow-hidden pt-8 border-t border-[#e0e0e0]"
                    >
                      <button 
                        onClick={handleAnalyzeClick}
                        className="w-full sm:w-auto px-8 py-3.5 text-[15px] font-semibold text-white bg-[#4a301e] hover:bg-[#3a2618] rounded-[16px] transition-all duration-200 shadow-[0_2px_10px_rgba(74,48,30,0.2)] hover:shadow-[0_4px_20px_rgba(74,48,30,0.3)] active:scale-[0.98] flex items-center justify-center gap-2.5 border-t border-white/15"
                      >
                        <Sparkles className="w-[18px] h-[18px] text-[#C69C6D]" />
                        Analyze Document
                      </button>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* 4. RECENT ANALYSES */}
          <div className="w-full mt-6">
            <h2 className="text-[14px] font-bold text-[#1f1f1f] mb-5 pl-1 uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#C69C6D]"></span>
              Recent Analyses
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recentAnalyses.map((file) => (
                <div 
                  key={file.id} 
                  className="bg-white border border-[#e0e0e0] shadow-sm hover:shadow-[0_4px_20px_rgba(198,156,109,0.08)] hover:border-[#C69C6D]/40 rounded-[16px] p-3 sm:p-4 cursor-pointer transition-all duration-300 group flex items-center gap-3 sm:gap-4 hover:-translate-y-0.5"
                >
                  {/* Sleek Dynamic Icon */}
                  <div className={`w-12 h-12 rounded-[12px] ${getFileBadgeBg(file.name)} flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105`}>
                    <span className="text-[11px] font-bold text-white tracking-wider">{getFileBadgeText(file.name)}</span>
                  </div>

                  {/* Clean File Info */}
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1f1f1f] truncate mb-1.5 transition-colors group-hover:text-[#664229]">
                      {file.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* Premium Status Pill */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                        file.risk === 'Critical' ? 'bg-red-50 text-red-600 border border-red-100' :
                        file.risk === 'Warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {file.risk}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[#d4d4d4]"></span>
                      <span className="text-[12px] text-[#444746]/80 font-medium truncate">{file.date}</span>
                    </div>
                  </div>

                  {/* Minimalist Arrow */}
                  <div className="shrink-0 text-[#c7c7c7] group-hover:text-[#C69C6D] transition-colors pr-2">
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
