'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { postJson } from '@/lib/client/api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [countdown, setCountdown] = useState(45);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isSuccess && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, countdown]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    
    if (val.includes('@')) {
      const domain = val.split('@')[1];
      if (domain && !'khi.iba.edu.pk'.startsWith(domain)) {
        setError('Only @khi.iba.edu.pk accounts can join');
        setIsSuccess(false);
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    // 1. Check for empty fields
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill out all required fields');
      return;
    }

    // 2. Check for domain
    if (!email.endsWith('@khi.iba.edu.pk')) {
      setError('Only @khi.iba.edu.pk accounts can join');
      return;
    }

    // 3. Prevent space-only or space-padded passwords
    if (password.includes(' ')) {
      setError('Password cannot contain spaces');
      return;
    }

    // 4. Explicit Length Check
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // 5. Explicit Complexity Check (Removed the {8,} length requirement from regex)
    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^()_\-=\[\]{};':"\\|,.<>\/])/;
    if (!complexityRegex.test(password)) {
      setError('Password must include an uppercase, lowercase, number, and special character');
      return;
    }

    // 6. Check for matching passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // 7. Check agreement
    if (!agreed) {
      setError('You must agree to the community rules');
      return;
    }

    // 8. Create the account (the server checks everything again)
    setError(null);
    setSubmitting(true);
    const result = await postJson('/api/v1/auth/register', { name, email, password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setIsSuccess(true);
    setCountdown(45);
  };

  const handleResend = async () => {
    setCountdown(45);
    const result = await postJson('/api/v1/auth/resend-verification', { email });
    if (!result.ok) setError(result.error.message);
  };

  const handleWrongEmail = () => {
    setIsSuccess(false);
    setSubmitAttempted(false);
    setEmail('');
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col bg-cover bg-center bg-fixed bg-no-repeat text-gray-900 font-sans selection:bg-red-500 selection:text-white relative"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute inset-0 backdrop-blur-md z-0 fixed"></div>

      {/* Toast Error Notification */}
      {error && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="px-4 py-3 border border-red-200 rounded-lg text-sm text-red-700 bg-white font-medium flex items-center shadow-lg gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500 flex-shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Floating Logo */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/sign-in">
          <Image 
            src="/logo.png" 
            alt="IBA Connect Logo" 
            width={45} 
            height={45} 
            className="rounded-lg shadow-md hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 z-10 relative">
        
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-red-50 p-5 sm:p-6 my-auto relative overflow-hidden">
          
          {/* Pop-up Success Overlay */}
          {isSuccess && (
            <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 fade-in duration-300">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green-600">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-600 mb-6">
                We sent a verification link to <br/><span className="font-semibold text-gray-900">{email}</span>
              </p>
              
              <div className="w-full space-y-3">
                <button 
                  type="button"
                  disabled={countdown > 0}
                  onClick={handleResend}
                  className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  Resend Link {countdown > 0 ? `(0:${countdown.toString().padStart(2, '0')})` : ''}
                </button>
                <button 
                  type="button"
                  onClick={handleWrongEmail}
                  className="w-full py-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  Wrong email address?
                </button>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className={`transition-all duration-300 ${isSuccess ? 'opacity-30 pointer-events-none blur-sm' : ''}`}>
            <div className="text-center mb-5">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Create account</h1>
              <p className="text-xs text-gray-500 mt-1">Join the IBA Connect community</p>
            </div>
            
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 ml-1">Full name *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahsan Haris" 
                  className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
                    submitAttempted && !name 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-200 focus:ring-[#8b0000]'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 ml-1">IBA email * (@khi.iba.edu.pk)</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="name@khi.iba.edu.pk" 
                  suppressHydrationWarning
                  className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
                    (submitAttempted && !email) || (error && error.includes('@khi.iba.edu.pk'))
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-200 focus:ring-[#8b0000]'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 ml-1">Password *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if(error) setError(null); }}
                    placeholder="••••••••" 
                    suppressHydrationWarning
                    className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
                      submitAttempted && (!password || (error && error.includes('Password'))) 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-200 focus:ring-[#8b0000]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 ml-1">Confirm password *</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if(error) setError(null); }}
                    placeholder="••••••••" 
                    suppressHydrationWarning
                    className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
                      submitAttempted && (!confirmPassword || password !== confirmPassword)
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-200 focus:ring-[#8b0000]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex items-start gap-2 text-xs mt-1 pt-1">
                <input 
                  type="checkbox" 
                  checked={agreed}
                  onChange={(e) => { setAgreed(e.target.checked); if(error) setError(null); }}
                  className={`mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#8b0000] focus:ring-[#8b0000] transition-colors cursor-pointer ${
                    submitAttempted && !agreed ? 'border-red-500' : ''
                  }`} 
                />
                <span className="text-gray-600 leading-tight">
                  I agree to the community rules
                </span>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-[#8b0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] hover:shadow-md transition-all active:scale-[0.98] mt-4 disabled:opacity-60"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-600">
                Already have an account? <Link href="/sign-in" className="font-semibold text-[#8b0000] hover:underline">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}