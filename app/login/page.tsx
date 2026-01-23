'use client';

import { Suspense, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { track } from '@/lib/ga';

function LoginInner() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const signInWithEmail = async () => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setStatus(error.message);
    else {
      setStatus('Check your email for the login link.');
      track("login", { method: "email" });
    }
  };

  const signInWithGoogle = async () => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setStatus(error.message);
    else {
      track("login", { method: "google" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <a href="/" className="text-xs text-slate-400 underline">Back to app</a>

        <button
          onClick={signInWithGoogle}
          className="w-full bg-white text-slate-900 font-bold py-2 rounded-lg"
        >
          Continue with Google
        </button>

        <div className="h-px bg-slate-800" />

        <label className="text-sm text-slate-300">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2"
        />
        <button
          onClick={signInWithEmail}
          className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-2 rounded-lg"
        >
          Email me a login link
        </button>

        {status && <p className="text-sm text-slate-300">{status}</p>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <LoginInner />
    </Suspense>
  );
}