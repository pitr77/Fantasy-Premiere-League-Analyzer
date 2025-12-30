'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const signInWithEmail = async () => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setStatus(error.message);
    else setStatus(mode === 'signup' ? 'Check your email to finish creating your account.' : 'Check your email for the sign-in link.');
  };

  const signInWithGoogle = async () => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setStatus(error.message);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">{mode === 'signup' ? 'Sign up' : 'Sign in'}</h1>
        <p className="text-xs text-slate-400">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <a href="/login" className="underline">
                Sign in
              </a>
            </>
          ) : (
            <>
              New here?{' '}
              <a href="/login?mode=signup" className="underline">
                Sign up
              </a>
            </>
          )}
        </p>
        <a href="/" className="text-xs text-slate-400 underline">
          Back to app
        </a>

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
          {mode === 'signup' ? 'Email me a sign-up link' : 'Email me a sign-in link'}
        </button>

        {status && <p className="text-sm text-slate-300">{status}</p>}
      </div>
    </div>
  );
}