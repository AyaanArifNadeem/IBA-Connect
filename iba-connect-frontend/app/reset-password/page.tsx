'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  
  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    // Check for empty fields
    if (!password || !confirmPassword) {
      setError('Please fill out all fields');
      setIsSuccess(false);
      return;
    }

    // Check for minimum length
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsSuccess(false);
      return;
    }

    // Check for matching passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsSuccess(false);
      return;
    }

    // Success state
    setError(null);
    setIsSuccess(true);
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col text-gray-900 font-sans overflow-hidden relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/bg.png')" }}
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
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-red-50 p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Reset password</h1>
            <p className="text-xs text-gray-500 mt-1">Create a new secure password</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">New password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSuccess}
                  placeholder="••••••••" 
                  suppressHydrationWarning
                  className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                    submitAttempted && (!password || password.length < 8) 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-200 focus:ring-[#8b0000] focus:border-[#8b0000]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSuccess}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 ml-1">Confirm new password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isSuccess}
                  placeholder="••••••••" 
                  suppressHydrationWarning
                  className={`w-full bg-gray-50 border text-gray-900 rounded-xl p-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                    submitAttempted && (!confirmPassword || password !== confirmPassword)
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-200 focus:ring-[#8b0000] focus:border-[#8b0000]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSuccess}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showConfirmPassword ? (
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
            
            <button 
              type="submit"
              disabled={isSuccess}
              className="w-full bg-[#8b0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] hover:shadow-md transition-all active:scale-[0.98] mt-4 disabled:opacity-70 disabled:hover:bg-[#8b0000] disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Save new password
            </button>
          </form>

          {/* Green Success Message */}
          {isSuccess && (
            <div className="mt-5 p-3 border border-green-200 bg-green-50 rounded-xl flex items-center gap-3 text-sm text-green-700 font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-5 h-5 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-green-700">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              Password reset successfully
            </div>
          )}

          {/* Footer Back Link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <Link href="/sign-in" className="text-xs font-semibold text-gray-500 hover:text-[#8b0000] transition-colors flex items-center justify-center gap-1.5">
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