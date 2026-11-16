// app/reset-password/page.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';


export default function ResetPassword() {
  const [password, setPassword] = useState('');

  // Calculate simple password strength width (0 to 100)
  const strengthWidth = Math.min(100, password.length * 10);

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
          <h1 className="text-2xl font-bold mb-6">Reset password</h1>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <input 
                type="password" 
                placeholder="New password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:outline-none focus:border-black"
                required
              />
            </div>
            
            {/* Password Strength Indicator */}
            <div className="h-3 w-full border-2 border-gray-300 rounded-full overflow-hidden p-[1px]">
              <div 
                className="h-full bg-[#333333] rounded-full transition-all duration-300"
                style={{ width: `${strengthWidth}%` }}
              ></div>
            </div>

            <div>
              <input 
                type="password" 
                placeholder="Confirm new password" 
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:outline-none focus:border-black"
                required
              />
            </div>
            
            <button type="submit" className="w-full bg-[#242424] text-white py-3 rounded-md font-medium hover:bg-black transition-colors mt-2">
              Save new password
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}