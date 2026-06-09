import React from 'react';
import { Database, Search, Cpu, BarChart2, CheckCircle2 } from 'lucide-react';

export default function Pipeline() {
  const steps = [
    {
      icon: <Database className="text-brand-primary" size={20} />,
      num: "01",
      title: "Context Gathering",
      description: "Reads the target database schema, including columns, foreign keys, row counts, and existing indexes."
    },
    {
      icon: <Search className="text-brand-secondary" size={20} />,
      num: "02",
      title: "Execution Plan Profile",
      description: "Executes sqlite `EXPLAIN QUERY PLAN` to audit scan paths, detecting if table scans occur."
    },
    {
      icon: <Cpu className="text-brand-accent" size={20} />,
      num: "03",
      title: "Local LLM Evaluation",
      description: "Sends the query details + schema context to Ollama, prompting it to refactor filters and joins."
    },
    {
      icon: <BarChart2 className="text-brand-primary" size={20} />,
      num: "04",
      title: "Double-Run Benchmarking",
      description: "Runs original and optimized query variants 3 times to measure precision timing improvements."
    },
    {
      icon: <CheckCircle2 className="text-brand-secondary" size={20} />,
      num: "05",
      title: "Index Verification & Reports",
      description: "Optionally compiles indexes, generates comparison metrics, and exports download-ready Markdown logs."
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-slate-950/20 border-t border-brand-border/40 relative">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Under the Hood: The Agent Loop
          </h2>
          <p className="text-slate-400">
            A pipeline combining structural SQL analytics and LLM-driven intelligence to analyze performance bottlenecks.
          </p>
        </div>

        {/* Process Steps */}
        <div className="relative">
          {/* Connecting Line for desktop */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-[2px] bg-slate-800 -translate-y-1/2 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center lg:items-start text-center lg:text-left group"
              >
                {/* Step Circle */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl glass border-brand-border flex items-center justify-center bg-slate-900 group-hover:border-brand-primary/50 group-hover:shadow-lg group-hover:shadow-brand-primary/10 transition-all duration-300">
                    {step.icon}
                  </div>
                  <span className="absolute -top-3 -right-3 px-2 py-0.5 text-[10px] font-bold rounded-md bg-brand-border border border-brand-border text-slate-400 font-mono">
                    {step.num}
                  </span>
                </div>

                {/* Step Details */}
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-primary transition-colors">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed font-light">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
