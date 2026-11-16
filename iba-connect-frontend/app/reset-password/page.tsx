'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col text-gray-900 font-sans overflow-hidden relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('bg.png')" }}
    >
      
      {/* Full-screen backdrop blur overlay */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/10 z-0"></div>

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
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Reset password</h1>
            <p className="text-xs text-gray-500 mt-1">Create a new secure password</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">New password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                suppressHydrationWarning
                className={`w-full bg-white border text-gray-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 shadow-sm ${
                  submitAttempted && !password 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-black focus:border-black'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">Confirm new password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                suppressHydrationWarning
                className={`w-full bg-white border text-gray-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 shadow-sm ${
                  submitAttempted && (!confirmPassword || password !== confirmPassword)
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-200 focus:ring-black focus:border-black'
                }`}
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-[#8b0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] hover:shadow-md transition-all active:scale-[0.98] mt-4"
            >
              Save new password
            </button>
          </form>

          {/* Error message if passwords do not match */}
          {submitAttempted && confirmPassword && password !== confirmPassword && (
            <div className="mt-3 text-xs text-red-500 font-medium text-center">
              Passwords do not match.
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