'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // Supabase po prihlásení presmeruje späť s ?code=...
      const code = new URLSearchParams(window.location.search).get('code');

      // Toto je kľúčový krok: z OAuth/magic-link kódu urobí reálnu session (user + tokeny)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          // keď sa niečo pokazí, pošleme usera na login
          router.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      // úspech → domov na aktuálnej doméne
      window.location.href = window.location.origin;
    };

    run();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      Completing sign-in...
    </div>
  );
}