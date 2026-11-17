'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { postJson } from '@/lib/client/api';
import { safeNextPath } from '@/lib/validation/auth';

export default function SignIn() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    
    if (val.includes('@')) {
      const domain = val.split('@')[1];
      if (domain && !'khi.iba.edu.pk'.startsWith(domain)) {
        setError('Only @khi.iba.edu.pk accounts can join');
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear the incorrect password error as soon as the user starts typing again
    if (error === 'Incorrect email or password.') {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!email || !password) {
      setError('Please fill out all fields');
      return;
    }

    if (email && !email.endsWith('@khi.iba.edu.pk')) {
      setError('Only @khi.iba.edu.pk accounts can join');
      return;
    }

    setError(null);
    setSubmitting(true);
    const result = await postJson<{ next: string }>('/api/v1/auth/sign-in', { email, password });
    setSubmitting(false);

    if (!result.ok) {
      if (result.error.code === 'email_not_verified') {
        router.push('/verify?error=unverified');
        return;
      }
      setError(result.error.message);
      return;
    }

    // Go back to the page the member asked for, unless their profile still needs finishing
    const requested = new URLSearchParams(window.location.search).get('next');
    const destination =
      result.data.next === '/dashboard' ? safeNextPath(requested, '/dashboard') : result.data.next;
    router.push(destination);
    router.refresh();
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col bg-cover bg-center bg-no-repeat text-gray-900 font-sans selection:bg-red-500 selection:text-white overflow-hidden relative"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute inset-0 backdrop-blur-md/ z-0"></div>
      
      {/* Toast Notification */}
      {error && (
        <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
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
        <Image 
          src="/logo.png" 
          alt="IBA Connect Logo" 
          width={45} 
          height={45} 
          className="rounded-lg shadow-md"
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 z-10 relative">
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-red-50 p-5 sm:p-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Welcome back</h1>
            <p className="text-xs text-gray-500 mt-1">Sign in to your IBA Connect account</p>
          </div>
          
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">Email address</label>
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
              <label className="text-xs font-semibold text-gray-700 ml-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="••••••••" 
                  suppressHydrationWarning
                  className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 ${
                    (submitAttempted && !password) || (error && error.includes('password'))
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-[#8b0000] focus:ring-[#8b0000] transition-colors cursor-pointer" />
                <span className="text-gray-600 group-hover:text-gray-900 transition-colors">Remember me</span>
              </label>
              <Link href="/forgot-password" className="font-semibold text-gray-600 hover:text-[#8b0000] transition-colors">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={submitting} className="w-full border border-gray-200 bg-white text-gray-900 py-2 rounded-xl text-sm font-bold hover:border-[#808080] hover:bg-gray-50 hover:text-[#8b0000] hover:shadow-sm transition-all active:scale-[0.98] mt-2 disabled:opacity-60">
              {submitting ? 'Signing in...' : 'Sign in with Email'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">or</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button className="w-full bg-[#8b0000] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#6b0000] hover:shadow-md transition-all active:scale-[0.98]">
            Sign in with Microsoft (IBA)
          </button>

          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col space-y-2 text-xs text-center">
            <p className="text-gray-600">
              New to IBA Connect? <Link href="/register" className="font-semibold text-[#8b0000] hover:underline">Register here</Link>
            </p>
            <p className="text-gray-600">
              Alumnus? <Link href="/verify-alumni" className="font-semibold text-[#8b0000] hover:underline">Verify your status</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}