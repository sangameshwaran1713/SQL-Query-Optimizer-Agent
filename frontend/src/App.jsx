import React, { useRef } from 'react';
import Hero from './components/Hero';
import Pipeline from './components/Pipeline';
import Simulator from './components/Simulator';
import Footer from './components/Footer';

export default function App() {
  const simulatorRef = useRef(null);

  const scrollToSimulator = (e) => {
    e.preventDefault();
    simulatorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-brand-dark selection:bg-brand-primary/30 selection:text-white relative font-sans">
      
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-brand-border/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="text-xl">⚡</span>
            <span className="font-bold text-white tracking-tight text-sm sm:text-base">SQL Optimizer Agent</span>
          </div>


        </div>
      </nav>

      {/* Main Content Sections */}
      <main className="relative z-10 pt-16">
        <Hero scrollToSimulator={scrollToSimulator} />
        
        <div ref={simulatorRef} id="simulator-wrapper">
          <Simulator />
        </div>

        <div id="pipeline-wrapper">
          <Pipeline />
        </div>
      </main>

      {/* Footer */}
      <Footer scrollToSimulator={scrollToSimulator} />
    </div>
  );
}
