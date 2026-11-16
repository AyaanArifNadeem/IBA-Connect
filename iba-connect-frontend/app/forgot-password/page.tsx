'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Real-time email validation (same as Sign In page)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    
    if (val.includes('@')) {
      const domain = val.split('@')[1];
      if (domain && !'khi.iba.edu.pk'.startsWith(domain)) {
        setError('Only @khi.iba.edu.pk accounts can join');
        setIsSent(false); // Hide success message if they start typing an invalid email
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    // Trigger top-right error toast if the field is completely empty
    if (!email.trim()) {
      setError('Please enter an email address');
      setIsSent(false);
      return;
    }
    
    if (email && !error) {
      setIsSent(true);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col text-gray-900 font-sans overflow-hidden relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('bg.png')" }}
    >
      
      {/* Full-screen backdrop blur overlay */}
      <div className="absolute inset-0 backdrop-blur-md z-0"></div>

      {/* Toast Error Notification */}
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

      {/* Floating Logo - Clickable to return to sign in */}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 relative">
        
        {/* Elevated Card */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Forgot password</h1>
            <p className="text-xs text-gray-500 mt-1">Enter your email to receive a reset link</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={handleEmailChange}
                placeholder="name@khi.iba.edu.pk" 
                suppressHydrationWarning
                className={`w-full bg-white border text-gray-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 shadow-sm ${
                  (submitAttempted && !email) || error 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-black focus:border-black'
                }`}
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#8b0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] hover:shadow-md transition-all active:scale-[0.98] mt-2"
            >
              Send reset link
            </button>
          </form>

          {/* Success Message */}
          {isSent && (
            <div className="mt-5 p-3 border border-green-200 bg-green-50 rounded-xl flex items-center gap-3 text-sm text-green-700 font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-5 h-5 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-green-700">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              Reset link sent — check your email
            </div>
          )}

          {/* Footer Back Link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <Link href="/sign-in" className="text-xs font-semibold text-gray-500 hover:text-black transition-colors flex items-center justify-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}