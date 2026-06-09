import React from 'react';

export default function Footer({ scrollToSimulator }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-border/40 py-12 mt-16 bg-slate-950/40 relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2 text-white font-bold text-lg mb-2">
            <span>⚡</span>
            <span>SQL Optimizer Agent</span>
          </div>
          <p className="text-slate-500 text-xs font-light max-w-sm">
            AI-powered diagnostics, plan analyzer, and benchmarking suite for SQLite schemas. Built for the Infinite AI Prototype Challenge.
          </p>
        </div>


        {/* Copyright */}
        <div className="text-xs text-slate-500 font-light">
          &copy; {currentYear} SQL Optimizer Agent. MIT License.
        </div>

      </div>
    </footer>
  );
}
