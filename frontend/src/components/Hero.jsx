import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function Hero({ scrollToSimulator }) {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute top-1/3 left-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-brand-secondary/5 rounded-full blur-[90px] pointer-events-none animate-float"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
        {/* Release Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border-brand-primary/20 text-xs font-semibold text-brand-secondary mb-6 animate-fade-in">
          <span className="flex h-2 w-2 rounded-full bg-brand-secondary animate-ping"></span>
          AI-Powered SQLite Optimization
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl">
          Supercharge SQLite Queries <br />
          With <span className="text-gradient">Local AI Agents</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed font-light">
          An intelligent developer companion that inspects schemas, explains execution plans, benchmarks performance, and applies index rewrites locally via Ollama.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
          <button
            onClick={scrollToSimulator}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-600 hover:to-brand-primary text-white font-semibold shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/35 hover:-translate-y-0.5 transition-all duration-200"
          >
            Try Interactive Simulator
            <ArrowRight size={18} />
          </button>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass border-brand-border text-slate-300 font-semibold hover:bg-slate-800/50 hover:text-white transition-all duration-200"
          >
            How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
