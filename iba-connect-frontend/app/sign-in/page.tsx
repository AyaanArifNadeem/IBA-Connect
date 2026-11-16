'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  return (
    // Added a subtle red-tinted gradient to the background
    <div 
  className="min-h-screen w-full flex flex-col bg-cover bg-center bg-no-repeat text-gray-900 font-sans selection:bg-red-500 selection:text-white overflow-hidden relative"
  style={{ backgroundImage: "url('/bg.png')" }}
>

  {/* 1. Full-screen backdrop blur overlay applied to the background image */}
      <div className="absolute inset-0 backdrop-blur-md/ z-0"></div>
      
      {/* Toast Notification */}
      {error && (
        <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="px-4 py-3 border border-red-200 rounded-lg text-sm text-red-700 bg-white font-medium flex items-center shadow-lg gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* 2. Floating Logo - Replaced the top bar with a fixed top-left div */}
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
      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        
        {/* Card with reduced padding to prevent scrolling */}
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-red-50 p-5 sm:p-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Welcome back</h1>
            <p className="text-xs text-gray-500 mt-1">Sign in to your IBA Connect account</p>
          </div>
          
          <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={handleEmailChange}
                placeholder="name@khi.iba.edu.pk" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b0000] transition-all placeholder:text-gray-400"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8b0000] transition-all placeholder:text-gray-400"
                required
              />
            </div>
            
            <div className="flex items-center justify-between text-xs mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer group">
                {/* Checkbox updated to red theme */}
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-[#8b0000] focus:ring-[#8b0000] transition-colors cursor-pointer" />
                <span className="text-gray-600 group-hover:text-gray-900 transition-colors">Remember me</span>
              </label>
              <Link href="/forgot-password" className="font-semibold text-gray-600 hover:text-[#8b0000] transition-colors">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="w-full border border-gray-200 bg-white text-gray-900 py-2 rounded-xl text-sm font-bold hover:border-[#808080] hover:bg-gray-50 hover:text-[#8b0000] hover:shadow-sm transition-all active:scale-[0.98] mt-2">
              Sign in with Email
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">or</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Microsoft Button updated to IBA Maroon */}
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