'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Language } from '@/lib/translations';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    const stored = localStorage.getItem('hotelops-lang') as Language | null;
    if (stored === 'en' || stored === 'es') setLangState(stored);
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem('hotelops-lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
