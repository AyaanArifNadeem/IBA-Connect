// app/sign-in/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function SignIn() {
  const [error, setError] = useState<string | null>('Only @khi.iba.edu.pk accounts can join');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <header className="p-4 border-b bg-white">
        <div className="border-2 border-black inline-block px-3 py-1 font-bold text-xl">
          IBA Connect
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-gray-300 shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-6">Sign in</h1>
          
          <button className="w-full bg-[#242424] text-white py-3 rounded-md font-medium hover:bg-black transition-colors mb-6">
            Sign in with Microsoft (IBA)
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-grow border-t-2 border-dashed border-gray-300"></div>
            <span className="text-gray-500 text-sm font-medium">or email</span>
            <div className="flex-grow border-t-2 border-dashed border-gray-300"></div>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <input 
                type="email" 
                placeholder="Email" 
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:outline-none focus:border-black"
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full border-2 border-gray-300 rounded-md p-3 focus:outline-none focus:border-black"
                required
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 border-2 border-gray-400 rounded-sm" />
                <span>Keep me signed in</span>
              </label>
              <Link href="/forgot-password" className="underline hover:text-gray-600">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="w-full border-2 border-black bg-white text-black py-3 rounded-md font-bold hover:bg-gray-50 transition-colors mt-2">
              Sign in
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm">
            <p>New? <Link href="/register" className="underline font-medium">Register with email</Link></p>
            <p>Alumnus? <Link href="/verify-alumni" className="underline font-medium">Verify as alumni</Link></p>
          </div>
        </div>

        {/* Error Messages Container */}
        {error && (
          <div className="w-full max-w-md mt-6 space-y-3">
            <div className="p-3 border-2 border-dashed border-gray-400 rounded-lg text-sm text-center text-gray-700 bg-white">
              {error}
            </div>
            {/* Additional error states shown for reference:
            <div className="p-3 border-2 border-dashed border-gray-400 rounded-lg text-sm text-center text-gray-700 bg-white">
              Account suspended — contact the team
            </div>
            <div className="p-3 border-2 border-dashed border-gray-400 rounded-lg text-sm text-center text-gray-700 bg-white">
              Session expired — please sign in again
            </div>
            */}
          </div>
        )}
      </main>
    </div>
  );
}