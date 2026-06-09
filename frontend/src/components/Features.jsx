import React from 'react';
import { ShieldCheck, Cpu, Zap, BarChart3, Database, KeyRound } from 'lucide-react';

export default function Features() {
  const items = [
    {
      icon: <Cpu className="text-brand-primary" size={24} />,
      title: "Local LLM Integration",
      description: "Direct connection with local Ollama instance (Qwen2.5-Coder / Llama3). No API keys, no network latency, and 100% private."
    },
    {
      icon: <ShieldCheck className="text-brand-secondary" size={24} />,
      title: "Fully Secure & Private",
      description: "All parsing, indexing, and timing occur inside your local SQLite engine. Your database schemas and query details never leak to the cloud."
    },
    {
      icon: <Zap className="text-brand-accent" size={24} />,
      title: "Before & After Profiling",
      description: "App executes query variants multiple times using precision microsecond clocks. Instantly reveals structural improvements."
    },
    {
      icon: <BarChart3 className="text-brand-primary" size={24} />,
      title: "EXPLAIN Plan Analytics",
      description: "Extracts and parses SQLite's internal query plans, tracking down Table Scans, Index Lookups, and Nested Joins."
    },
    {
      icon: <Database className="text-brand-secondary" size={24} />,
      title: "1-Click Index Generator",
      description: "The AI agent generates indexing scripts and lets you apply them directly to database schemas, immediately measuring improvements."
    },
    {
      icon: <KeyRound className="text-brand-accent" size={24} />,
      title: "Interactive Demo DB",
      description: "Includes a built-in schema generator containing 75,000+ relational rows (Customers, Products, Orders) to simulate real-world workloads."
    }
  ];

  return (
    <section id="features" className="py-20 border-t border-brand-border/40 relative">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Engineered for High-Performance Queries
          </h2>
          <p className="text-slate-400">
            A specialized optimization suite designed to analyze, refactor, and index SQLite relational databases entirely on your computer.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => (
            <div 
              key={index}
              className="glass glass-hover p-8 rounded-2xl flex flex-col items-start text-left"
            >
              <div className="p-3 bg-slate-900/80 rounded-xl border border-brand-border mb-6">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                {item.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed font-light">
                {item.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
