"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ShieldPlus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { signUpWithEmail, signInWithGoogle } from "@/app/actions/auth";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleSignUp = async (formData: FormData) => {
    setIsLoading(true);
    try {
      await signUpWithEmail(formData);
    } catch {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen hide-scrollbar overflow-y-auto bg-[#FAF7F2] flex flex-col relative selection:bg-kavach-gold selection:text-white z-0">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#FAF7F2] via-[#FDFBF7] to-[#F5EFE6]" />
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-20 max-w-[1600px] mx-auto w-full min-h-screen">

        {/* LEFT PANEL: Branding */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 relative min-h-[50vh] lg:min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 flex flex-col items-center text-center w-full"
          >
            {/* Logo */}
            <div className="relative w-64 h-64 lg:w-[450px] lg:h-[450px] drop-shadow-2xl mb-6">
              <Image
                src="/trans_logo.png"
                alt="Kavach Logo"
                fill
                className="object-contain"
                priority
              />
            </div>

            <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-kavach-dark leading-snug mb-3">
              Join the Shield.<br />
              <span className="text-kavach-brown">Protect What Matters.</span>
            </h1>
            <p className="text-kavach-dark/60 font-sans text-base max-w-sm">
              Create your Kavach account and start analyzing contracts with AI-powered legal intelligence.
            </p>
          </motion.div>
        </div>

        {/* RIGHT PANEL: Registration Form */}
        <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 min-h-[60vh] lg:min-h-screen">

          {/* Top Right Header */}
          <div className="absolute top-8 right-8 flex items-center gap-4 text-sm font-medium z-30">
            <span className="text-kavach-dark/60 hidden sm:block">Already have an account?</span>
            <Link href="/login" className="text-kavach-brown hover:text-kavach-gold transition-colors text-base font-semibold">
              Sign In
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-[460px] glass-card rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl z-30"
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/10 pointer-events-none rounded-[2.5rem]" />

            <div className="relative z-10 text-center mb-8">
              <h2 className="font-serif text-4xl font-semibold text-kavach-dark mb-2">Create Account</h2>
              <p className="text-kavach-dark/60 text-sm">Start your journey with Kavach</p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 mb-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{decodeURIComponent(error)}</span>
              </motion.div>
            )}

            <form className="relative z-10 space-y-5" action={handleSignUp}>

              {/* Full Name Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-kavach-dark/40" />
                </div>
                <input
                  id="register-name"
                  name="fullName"
                  type="text"
                  className="glass-input block w-full pl-11 pr-4 py-4 rounded-2xl text-kavach-dark placeholder-kavach-dark/40 sm:text-base font-medium"
                  placeholder="Full Name"
                />
              </div>

              {/* Email Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-kavach-dark/40" />
                </div>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  required
                  className="glass-input block w-full pl-11 pr-4 py-4 rounded-2xl text-kavach-dark placeholder-kavach-dark/40 sm:text-base font-medium"
                  placeholder="Email Address"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-kavach-dark/40" />
                </div>
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="glass-input block w-full pl-11 pr-12 py-4 rounded-2xl text-kavach-dark placeholder-kavach-dark/40 sm:text-base font-medium"
                  placeholder="Password (min. 6 characters)"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-kavach-dark/40 hover:text-kavach-brown transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-kavach-dark/40 hover:text-kavach-brown transition-colors" />
                  )}
                </button>
              </div>

              {/* Terms notice */}
              <p className="text-xs text-kavach-dark/50 text-center mt-2">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="text-kavach-brown hover:underline">Terms of Service</Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-kavach-brown hover:underline">Privacy Policy</Link>.
              </p>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-between px-6 py-4 rounded-2xl text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 group overflow-hidden relative disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                style={{
                  background: 'linear-gradient(135deg, #8B5A2B 0%, #B8860B 100%)',
                }}
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <ShieldPlus className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-base tracking-wide">
                    {isLoading ? "Creating account..." : "Create Kavach Account"}
                  </span>
                </div>
                <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
              </button>

              {/* Divider */}
              <div className="mt-8 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-kavach-gold/20" />
                </div>
                <div className="relative flex justify-center text-[11px] font-bold tracking-widest text-kavach-dark/40 uppercase">
                  <span className="bg-[#fcfaf7] px-3 rounded-full">Or sign up with</span>
                </div>
              </div>

              {/* Google Sign Up */}
              <div className="mt-5">
                <button
                  type="button"
                  disabled={isGoogleLoading}
                  onClick={handleGoogleSignUp}
                  className="flex justify-center items-center gap-3 w-full py-3.5 rounded-2xl bg-white border border-kavach-gold/10 hover:border-kavach-gold/30 hover:shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-kavach-dark/40" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      <span className="text-kavach-dark/70 font-medium text-sm">Sign up with Google</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
