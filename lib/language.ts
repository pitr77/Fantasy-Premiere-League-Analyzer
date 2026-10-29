"use client";

import { useEffect, useState } from 'react';

export type Language = 'en' | 'sk';

const STORAGE_KEY = 'fpl_studio_language';
const EVENT_KEY = 'fpl_language_change';

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'sk' || saved === 'en') return saved;
  } catch (e) {
    // ignore
  }
  return 'en';
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: lang }));
  } catch (e) {
    // ignore
  }
}

export function useLanguage(): [Language, (lang: Language) => void] {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    setLanguageState(getStoredLanguage());

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail === 'sk' || customEvent.detail === 'en') {
        setLanguageState(customEvent.detail);
      }
    };

    window.addEventListener(EVENT_KEY, handleLanguageChange);
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'sk' || e.newValue === 'en')) {
        setLanguageState(e.newValue);
      }
    });

    return () => {
      window.removeEventListener(EVENT_KEY, handleLanguageChange);
    };
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  };

  return [language, changeLanguage];
}
