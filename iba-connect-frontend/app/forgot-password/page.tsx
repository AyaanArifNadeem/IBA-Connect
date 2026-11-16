// app/forgot-password/page.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export default function ForgotPassword() {
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <header className="p-4 border-b bg-white">
         <Image 
           src="/logo.png" 
           alt="IBA Connect Logo" 
           width={50} 
           height={50} 
           className="rounded-lg"
         />
       </header>

      <main className="flex-grow flex flex-col items-center pt-20 p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-gray-300 shadow-sm p-8">
          <h1 className="text-2xl font-bold mb-2">Forgot password</h1>
          <div className="h-2 w-full bg-gray-200 rounded-full mb-6 max-w-[200px]"></div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <input 
                type="email" 
                placeholder="Email" 
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:outline-none focus:border-black"
                required
              />
            </div>
            
            <button type="submit" className="w-full bg-[#242424] text-white py-3 rounded-md font-medium hover:bg-black transition-colors">
              Send reset link
            </button>
          </form>

          {isSent && (
            <div className="mt-4 p-4 border border-gray-300 bg-gray-100 rounded-md flex items-center gap-3 text-sm font-medium">
              <div className="w-4 h-4 border border-black flex items-center justify-center rounded-sm bg-white">
                <span className="text-black text-xs">✓</span>
              </div>
              Reset link sent — check your email
            </div>
          )}
        </div>
      </main>
    </div>
  );
}