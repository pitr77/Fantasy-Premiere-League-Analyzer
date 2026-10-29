"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  X,
  Trophy,
  Search,
  CalendarRange,
  Calendar,
  ArrowLeftRight,
  Shirt,
  Users,
  BarChart2,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

export default function ScoutHeader() {
  const [lang, setLang] = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navLinks = [
    { href: '/?v=LEAGUE_TABLE', label: 'League Table', icon: Trophy },
    { href: '/?v=TEAM_ANALYSIS', label: 'Team Analysis', icon: Search },
    { href: '/?v=PERIOD_ANALYSIS', label: 'Period Analysis', icon: CalendarRange },
    { href: '/?v=FIXTURES', label: 'Fixtures', icon: Calendar },
    { href: '/?v=TRANSFER_PICKS', label: 'Transfer Picks', icon: ArrowLeftRight },
    { href: '/?v=SQUAD_SIMULATOR', label: 'Squad Simulator', icon: Shirt },
    { href: '/?v=TOP_MANAGERS', label: 'Top Managers', icon: Users },
    { href: '/?v=STATS', label: 'Player Stats', icon: BarChart2 },
  ];

  const LanguageToggle = () => (
    <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => setLang('sk')}
        className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
          lang === 'sk'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
        title="Slovenčina"
      >
        <span className="text-[11px]">🇸🇰</span>
        <span>SK</span>
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
          lang === 'en'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white'
        }`}
        title="English"
      >
        <span className="text-[11px]">🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden md:flex sticky top-0 z-50 h-14 w-full bg-slate-900/80 backdrop-blur-md border-b border-white/5 items-center px-6 justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter hover:opacity-80 transition-opacity"
          >
            FPL STUDIO
          </Link>

          <nav className="flex items-center gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/scout"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-purple-600/20 shadow-[0_0_0_1px_rgba(168,85,247,0.4)] transition-all"
          >
            FPL Scout
          </Link>
          <LanguageToggle />
        </div>
      </header>

      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 z-50 flex items-center justify-between px-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-white shadow-lg transition-transform active:scale-95"
          aria-label="Toggle navigation menu"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link
          href="/"
          className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400"
        >
          FPL STUDIO
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/scout"
            className="text-xs font-semibold text-white px-2 py-1 rounded bg-purple-600/30 border border-purple-500/50"
          >
            FPL Scout
          </Link>
          <LanguageToggle />
        </div>
      </div>

      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 w-72 h-full bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:hidden flex flex-col`}
      >
        <div className="p-6 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <Link
            href="/"
            onClick={() => setIsSidebarOpen(false)}
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400 tracking-tighter text-left"
          >
            FPL STUDIO
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-sm font-medium"
              >
                <Icon size={18} className="text-slate-400" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/scout"
            onClick={() => setIsSidebarOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white bg-purple-600/20 shadow-[0_0_0_1px_rgba(168,85,247,0.4)] transition-all text-sm font-medium"
          >
            <span>FPL Scout</span>
          </Link>
        </nav>

        <div className="p-6 border-t border-slate-800 shrink-0 bg-slate-900">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Data by FPL API <br /> Not PL Affiliated
          </div>
        </div>
      </aside>
    </>
  );
}
