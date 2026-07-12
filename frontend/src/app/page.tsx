import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Scale, Lightbulb, ArrowRight, Upload, BrainCircuit, FileCheck2, ShieldAlert } from "lucide-react";

export default async function Home(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  // Check if searchParams contains an OAuth code
  if (props.searchParams) {
    const searchParams = await props.searchParams;
    if (searchParams.code) {
      redirect(`/auth/callback?code=${searchParams.code}`);
    }
  }

  // Check auth state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white flex flex-col">
      {/* HEADER */}
      <header className="w-full flex items-center justify-between px-6 py-4 md:px-12 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="relative w-28 h-8">
            <Image 
              src="/trans_logo.png" 
              alt="Kavach Logo" 
              fill 
              className="object-contain object-left" 
              priority 
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Sign In
          </Link>
          <Link href="/login" className="px-4 py-2 bg-[#1f1f1f] text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center">
        
        {/* HERO SECTION */}
        <section className="w-full max-w-6xl mx-auto px-6 py-24 md:py-32 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-600 mb-8">
            <ShieldCheck className="w-4 h-4 text-[#C69C6D]" />
            <span>AI-Powered Legal Intelligence</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 max-w-4xl leading-[1.1]">
            Understand Every Contract Before You Sign
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl font-medium">
            Protect yourself from predatory clauses. Kavach uses a multi-agent AI debate system to analyze legal documents, uncover hidden risks, and provide actionable negotiation strategies.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/login" className="px-8 py-4 bg-[#1f1f1f] text-white rounded-xl text-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 group shadow-lg shadow-black/5">
              Start Free Analysis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="#how-it-works" className="px-8 py-4 bg-white border border-gray-200 text-slate-700 rounded-xl text-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center">
              Learn More
            </Link>
          </div>
        </section>

        {/* WHAT IS KAVACH SECTION */}
        <section className="w-full bg-slate-50 border-y border-slate-100 py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-6">
                The Problem with Standard Contracts
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-6">
                Standard legal agreements are rarely "standard." They are often drafted to protect the other party, burying predatory clauses, blanket indemnifications, and overbroad non-competes in dense legalese.
              </p>
              <p className="text-slate-600 text-lg leading-relaxed">
                Traditional AI tools give generic summaries. <strong className="text-slate-900">Kavach is different.</strong> We orchestrate a debate between an aggressive Company Defender and a protective User Advocate, evaluated by a Neutral Judge, to give you a balanced, bulletproof analysis.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900">Hidden Liabilities</h3>
                <p className="text-sm text-slate-500 font-medium">Uncapped damages and one-sided indemnification clauses.</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C69C6D]/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-[#C69C6D]" />
                </div>
                <h3 className="font-bold text-slate-900">Unenforceable Terms</h3>
                <p className="text-sm text-slate-500 font-medium">Non-competes that violate Indian statutory laws.</p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="w-full max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              How Kavach Works
            </h2>
            <p className="text-slate-600 text-lg font-medium">
              A transparent, three-step process to secure your legal standing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 text-9xl font-bold text-slate-50 -z-10 group-hover:scale-110 transition-transform duration-500">1</div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-6">
                <Upload className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Upload Document</h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                Securely upload your PDF or DOCX file. Our system parses the dense legalese into a structured, readable format instantly.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 text-9xl font-bold text-slate-50 -z-10 group-hover:scale-110 transition-transform duration-500">2</div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-6">
                <BrainCircuit className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Agents Debate</h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                Watch in real-time as our specialized AI agents argue for and against the contract's clauses, referencing actual legal precedents.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 text-9xl font-bold text-slate-50 -z-10 group-hover:scale-110 transition-transform duration-500">3</div>
              <div className="w-12 h-12 bg-[#C69C6D]/10 rounded-xl flex items-center justify-center mb-6">
                <FileCheck2 className="w-6 h-6 text-[#C69C6D]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Receive Verdict</h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                Get a balanced, quantitative risk score alongside actionable negotiation strategies to push back on unfair terms.
              </p>
            </div>
          </div>
        </section>

        {/* KEY BENEFITS SECTION */}
        <section className="w-full bg-[#1f1f1f] text-white py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 grid grid-cols-1 gap-6">
              <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#C69C6D]" />
                  India-First Legal Context
                </h3>
                <p className="text-gray-400 font-medium text-sm leading-relaxed">
                  Our India Legal Expert agent specifically analyzes contracts against the Indian Contract Act (1872), IT Act (2000), and DPDP Act (2023).
                </p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#C69C6D]" />
                  Enkrypt AI Safety Layer
                </h3>
                <p className="text-gray-400 font-medium text-sm leading-relaxed">
                  Every final verdict is independently scored for hallucination risk and bias, ensuring you receive trustworthy, grounded analysis.
                </p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#C69C6D]" />
                  Actionable Strategies
                </h3>
                <p className="text-gray-400 font-medium text-sm leading-relaxed">
                  Don't just discover risks—know how to fix them. Kavach provides specific redline recommendations to use in your negotiations.
                </p>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Designed for precision. Built for your protection.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-10">
                Whether you're a startup founder signing an MSA, a freelancer reviewing an NDA, or an employee looking at a non-compete, Kavach gives you the legal clarity you deserve.
              </p>
              <Link href="/login" className="inline-flex px-8 py-4 bg-white text-slate-900 rounded-xl text-lg font-bold hover:bg-gray-100 transition-colors items-center justify-center gap-2 group">
                Try Kavach Today
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full bg-white border-t border-gray-100 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-24 h-6 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all">
              <Image 
                src="/trans_logo.png" 
                alt="Kavach Logo" 
                fill 
                className="object-contain object-left" 
              />
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            © {new Date().getFullYear()} Kavach. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link href="/login" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
