import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calculator, ShieldAlert, Scale, AlertTriangle } from 'lucide-react';

interface ScoringSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScoringSystemModal({ isOpen, onClose }: ScoringSystemModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-4xl max-h-[85vh] bg-white rounded-3xl shadow-2xl z-[101] flex flex-col overflow-hidden border border-black/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-[#f8f9fa]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">3-Factor Weighted Scoring System</h2>
                  <p className="text-[13px] text-gray-500 font-medium">How the Neutral Judge calculates contract risk</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
              
              {/* Formula */}
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">The Formula</h3>
                <div className="bg-gray-900 rounded-2xl p-6 text-center shadow-inner">
                  <div className="text-lg md:text-xl font-bold text-white tracking-wide font-mono">
                    <span className="text-[#ff6b6b]">Harm</span> × 0.40 + 
                    <span className="text-[#4dabf7]"> Legal</span> × 0.35 + 
                    <span className="text-[#fab005]"> Likelihood</span> × 0.25
                  </div>
                  <p className="text-gray-400 mt-3 text-sm font-medium">
                    Each factor is scored 1–10. The sum is multiplied by 10 to produce a 0–100 final score.
                  </p>
                </div>
              </section>

              {/* Factors Overview */}
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Factor Weights</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-red-700 font-bold">
                        <ShieldAlert className="w-4 h-4" /> Harm Potential
                      </div>
                      <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-md">40%</span>
                    </div>
                    <p className="text-red-900/70 text-sm">Severity of damage is the most important factor for user decisions.</p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-blue-700 font-bold">
                        <Scale className="w-4 h-4" /> Legal Strength
                      </div>
                      <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">35%</span>
                    </div>
                    <p className="text-blue-900/70 text-sm">Enforceability determines whether risk is theoretical or real.</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <AlertTriangle className="w-4 h-4" /> Practical Likelihood
                      </div>
                      <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-1 rounded-md">25%</span>
                    </div>
                    <p className="text-amber-900/70 text-sm">Even high-harm, enforceable clauses matter less if rarely invoked.</p>
                  </div>
                </div>
              </section>

              {/* Detailed Tables */}
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Factor 1: Harm Potential (1-10)</h3>
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                      <tr>
                        <th className="p-4 border-b">Score</th>
                        <th className="p-4 border-b">Level</th>
                        <th className="p-4 border-b">Description</th>
                        <th className="p-4 border-b">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      <tr><td className="p-4 font-bold">1-2</td><td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">Negligible</span></td><td className="p-4">Trivial inconvenience</td><td className="p-4 text-gray-500">Standard confidentiality for project names</td></tr>
                      <tr><td className="p-4 font-bold">3-4</td><td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">Minor</span></td><td className="p-4">Short-term limitation</td><td className="p-4 text-gray-500">30-day notice period for termination</td></tr>
                      <tr><td className="p-4 font-bold">5-6</td><td className="p-4"><span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-semibold">Moderate</span></td><td className="p-4">Meaningful financial/career effect</td><td className="p-4 text-gray-500">Late payment penalties exceeding standard</td></tr>
                      <tr><td className="p-4 font-bold">7-8</td><td className="p-4"><span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">Serious</span></td><td className="p-4">Major financial loss</td><td className="p-4 text-gray-500">12-18 month non-compete</td></tr>
                      <tr><td className="p-4 font-bold">9-10</td><td className="p-4"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">Severe</span></td><td className="p-4">Can destroy future opportunities</td><td className="p-4 text-gray-500">Unlimited personal liability with broad indemnity</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Factor 2: Legal Strength (1-10)</h3>
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                      <tr>
                        <th className="p-4 border-b">Score</th>
                        <th className="p-4 border-b">Level</th>
                        <th className="p-4 border-b">Description</th>
                        <th className="p-4 border-b">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      <tr><td className="p-4 font-bold">1-2</td><td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">Unenforceable</span></td><td className="p-4">Explicitly void under Indian law</td><td className="p-4 text-gray-500">Non-compete for employees (Section 27)</td></tr>
                      <tr><td className="p-4 font-bold">3-4</td><td className="p-4"><span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-semibold">Weak</span></td><td className="p-4">Likely challenged successfully</td><td className="p-4 text-gray-500">Excessive bond period without training</td></tr>
                      <tr><td className="p-4 font-bold">5-6</td><td className="p-4"><span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">Uncertain</span></td><td className="p-4">Ambiguous, case-by-case basis</td><td className="p-4 text-gray-500">Broad IP clause with unclear scope</td></tr>
                      <tr><td className="p-4 font-bold">7-8</td><td className="p-4"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">Strong</span></td><td className="p-4">Clear statutory basis</td><td className="p-4 text-gray-500">Reasonable NDA with defined scope</td></tr>
                      <tr><td className="p-4 font-bold">9-10</td><td className="p-4"><span className="bg-red-900 text-white px-2 py-1 rounded text-xs font-semibold">Very Strong</span></td><td className="p-4">Ironclad under Indian law</td><td className="p-4 text-gray-500">Properly defined dispute resolution</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Factor 3: Practical Likelihood (1-10)</h3>
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                      <tr>
                        <th className="p-4 border-b">Score</th>
                        <th className="p-4 border-b">Level</th>
                        <th className="p-4 border-b">Description</th>
                        <th className="p-4 border-b">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      <tr><td className="p-4 font-bold">1-2</td><td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">Very Unlikely</span></td><td className="p-4">Almost never invoked</td><td className="p-4 text-gray-500">Force majeure clause</td></tr>
                      <tr><td className="p-4 font-bold">3-4</td><td className="p-4"><span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-semibold">Low</span></td><td className="p-4">Unusual circumstances only</td><td className="p-4 text-gray-500">Termination-for-cause in employment</td></tr>
                      <tr><td className="p-4 font-bold">5-6</td><td className="p-4"><span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">Moderate</span></td><td className="p-4">Invoked sometimes</td><td className="p-4 text-gray-500">Late payment penalties</td></tr>
                      <tr><td className="p-4 font-bold">7-8</td><td className="p-4"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">High</span></td><td className="p-4">Frequently invoked</td><td className="p-4 text-gray-500">Payment delay in milestone contracts</td></tr>
                      <tr><td className="p-4 font-bold">9-10</td><td className="p-4"><span className="bg-red-900 text-white px-2 py-1 rounded text-xs font-semibold">Almost Certain</span></td><td className="p-4">Very high probability</td><td className="p-4 text-gray-500">Immediate termination without notice</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
