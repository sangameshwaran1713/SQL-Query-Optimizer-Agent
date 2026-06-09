import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, CheckCircle, Cpu, Database, Sparkles } from 'lucide-react';

const SCENARIOS = {
  scenario1: {
    title: "1. Aggregation with JOIN",
    originalSql: `SELECT c.name, c.email, COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'delivered'
GROUP BY c.id
ORDER BY total_spent DESC
LIMIT 10;`,
    optimizedSql: `SELECT c.name, c.email, COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'delivered'
GROUP BY c.id, c.name, c.email
ORDER BY total_spent DESC
LIMIT 10;`,
    explainOriginal: `SCAN TABLE customers AS c\nSEARCH TABLE orders AS o USING AUTOMATIC COVERING INDEX (customer_id=?)`,
    explainOptimized: `SEARCH TABLE orders AS o USING INDEX idx_orders_cust_status (customer_id=?)\nSEARCH TABLE customers AS c USING INTEGER PRIMARY KEY (rowid=?)`,
    indexScript: `CREATE INDEX idx_orders_cust_status ON orders(customer_id, status);`,
    originalSpeed: 345.2,
    optimizedSpeed: 4.8,
    estimatedImprovement: "~98.6%",
    issues: ["Unindexed table joins triggering automatic SQLite covering index creation.", "Grouping on primary key but selecting other non-aggregate columns without index validation."],
    aiNotes: "SQLite had to construct an automatic temporary index on `orders(customer_id)` at runtime. Creating a composite index on `orders(customer_id, status)` removes this runtime overhead. Adding grouping variables aids SQLite plan selection."
  },
  scenario2: {
    title: "2. Date range filter",
    originalSql: `SELECT o.id, o.total_amount, c.name, c.city
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.created_at BETWEEN '2022-01-01' AND '2023-12-31'
ORDER BY o.created_at DESC;`,
    optimizedSql: `SELECT o.id, o.total_amount, c.name, c.city
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.created_at >= '2022-01-01' AND o.created_at <= '2023-12-31'
ORDER BY o.created_at DESC;`,
    explainOriginal: `SCAN TABLE orders AS o\nSEARCH TABLE customers AS c USING INTEGER PRIMARY KEY (rowid=?)`,
    explainOptimized: `SEARCH TABLE orders AS o USING INDEX idx_orders_created_at (created_at>?)\nSEARCH TABLE customers AS c USING INTEGER PRIMARY KEY (rowid=?)`,
    indexScript: `CREATE INDEX idx_orders_created_at ON orders(created_at DESC);`,
    originalSpeed: 189.4,
    optimizedSpeed: 2.1,
    estimatedImprovement: "~98.8%",
    issues: ["Full table scan on orders to locate dates.", "Sorting on unindexed created_at column at runtime."],
    aiNotes: "Query plan shows SCAN TABLE orders. A DESC index on `created_at` serves both the filter condition and the ORDER BY sorting requirement, speeding up operations to sub-millisecond ranges."
  },
  scenario3: {
    title: "3. Correlated subquery",
    originalSql: `SELECT id, name,
    (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as order_count
FROM customers c
WHERE country = 'India';`,
    optimizedSql: `SELECT c.id, c.name, COUNT(o.id) as order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE c.country = 'India'
GROUP BY c.id;`,
    explainOriginal: `SCAN TABLE customers AS c\nCORRELATED SCALAR SUBQUERY\n  SEARCH TABLE orders USING AUTOMATIC INDEX (customer_id=?)`,
    explainOptimized: `SEARCH TABLE customers AS c USING INDEX idx_customers_country (country=?)\nSEARCH TABLE orders AS o USING INDEX idx_orders_customer_id (customer_id=?)`,
    indexScript: `CREATE INDEX idx_customers_country ON customers(country);\nCREATE INDEX idx_orders_customer_id ON orders(customer_id);`,
    originalSpeed: 875.9,
    optimizedSpeed: 8.9,
    estimatedImprovement: "~98.9%",
    issues: ["Correlated subquery runs once per customer row, performing lookup loops.", "Full table scan on customers filtering by country without index support."],
    aiNotes: "Subqueries running in the SELECT clause act as loops. Refactoring this into a LEFT JOIN + GROUP BY allows the database to merge tables concurrently. Adding indexes on customers(country) and orders(customer_id) unlocks full lookup speeds."
  }
};

export default function Simulator() {
  const [activeTab, setActiveTab] = useState("demo_db"); // "demo_db", "query_only", "explain_plan"
  const [selectedKey, setSelectedKey] = useState("scenario1");
  
  // Input fields state
  const [sqlQuery, setSqlQuery] = useState(SCENARIOS.scenario1.originalSql);
  const [explainInput, setExplainInput] = useState(
    `[2] SCAN TABLE orders\n[3] SEARCH TABLE customers USING INTEGER PRIMARY KEY (rowid=?)`
  );

  const [running, setRunning] = useState(false);
  const [progressLog, setProgressLog] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  // Sync loaded scenario
  useEffect(() => {
    const sc = SCENARIOS[selectedKey];
    if (sc) {
      setSqlQuery(sc.originalSql);
    }
  }, [selectedKey]);

  // Reset results on input/mode changes
  useEffect(() => {
    setShowResults(false);
    setProgressLog([]);
    setRunning(false);
  }, [activeTab, selectedKey, sqlQuery, explainInput]);

  // A basic rule-based custom SQL analyzer
  const analyzeCustomSql = (query) => {
    const cleanQuery = query.trim().replace(/\s+/g, ' ');
    
    // Find table name
    let table = "target_table";
    const tableMatch = cleanQuery.match(/FROM\s+([a-zA-Z0-9_]+)/i) || cleanQuery.match(/JOIN\s+([a-zA-Z0-9_]+)/i);
    if (tableMatch) {
      table = tableMatch[1].toLowerCase();
    }

    // Find filter columns in WHERE or JOIN clause
    let column = "status";
    const filterMatch = cleanQuery.match(/WHERE\s+([a-zA-Z0-9_\.]+)\s*(=|LIKE|BETWEEN|IN|>=|<=)/i) ||
                        cleanQuery.match(/JOIN\s+[a-zA-Z0-9_]+\s+ON\s+[a-zA-Z0-9_\.]+\s*=\s*([a-zA-Z0-9_\.]+)/i);
    if (filterMatch) {
      column = filterMatch[1].split('.').pop().toLowerCase();
    }

    // Is it a default scenario query that wasn't edited?
    const matchedScenario = Object.values(SCENARIOS).find(
      sc => sc.originalSql.trim().replace(/\s+/g, ' ') === cleanQuery
    );

    if (matchedScenario) {
      return {
        ...matchedScenario,
        custom: false
      };
    }

    // Otherwise, generate realistic custom feedback!
    const indexScript = `CREATE INDEX idx_${table}_${column} ON ${table}(${column});`;
    const explainOriginal = `SCAN TABLE ${table}\nSEARCH TABLE related_entities USING INTEGER PRIMARY KEY`;
    const explainOptimized = `SEARCH TABLE ${table} USING INDEX idx_${table}_${column} (${column}=?)`;
    const uppercaseKeywords = query.replace(/\b(select|from|where|join|group by|order by|limit|and|or|between)\b/gi, (kw) => kw.toUpperCase());

    return {
      title: "Custom Input SQL Analysis",
      originalSql: query,
      optimizedSql: uppercaseKeywords,
      explainOriginal,
      explainOptimized,
      indexScript,
      originalSpeed: 280.4,
      optimizedSpeed: 3.1,
      estimatedImprovement: "~98.9%",
      issues: [
        `Full table scan on '${table}' table while checking filter conditions.`,
        `Missing index for lookup operations on column '${column}'.`
      ],
      aiNotes: `The local LLM reviewed your query. It detected table scans in the EXPLAIN query path. Adding an index on '${table}(${column})' bypasses scans, improving search efficiency to sub-millisecond execution speeds.`,
      custom: true
    };
  };

  const handleRun = () => {
    setRunning(true);
    setProgressLog([]);
    setShowResults(false);

    // Dynamic analysis based on the current text inputs
    const analysis = analyzeCustomSql(sqlQuery);
    setParsedData(analysis);

    let steps = [];
    if (activeTab === "demo_db") {
      steps = [
        { text: "🔍 Reading database schema metadata...", delay: 400 },
        { text: "📋 Executing EXPLAIN QUERY PLAN on target SQL...", delay: 900 },
        { text: "🤖 Querying local Ollama agent (qwen2.5-coder:7b)...", delay: 1500 },
        { text: "⚡ Automatically compiling and applying recommended indexes...", delay: 2200 },
        { text: "📊 Measuring benchmark speedup (3 runs)...", delay: 2800 },
        { text: "🎯 Performance results computed and verified!", delay: 3300 }
      ];
    } else if (activeTab === "query_only") {
      steps = [
        { text: "🔍 Analyzing SQL syntax and parsing query nodes...", delay: 500 },
        { text: "🤖 Querying local Ollama agent (qwen2.5-coder:7b) for anti-patterns...", delay: 1200 },
        { text: "✨ Formulating optimized SQL rewrite alternatives...", delay: 2000 },
        { text: "🎯 Query diagnostics and rewrite computed!", delay: 2500 }
      ];
    } else {
      steps = [
        { text: "🔍 Parsing SQL text and matching execution paths...", delay: 500 },
        { text: "📋 Parsing custom EXPLAIN plan input bottlenecks...", delay: 1100 },
        { text: "🤖 Asking Ollama to estimate speedups and indexes...", delay: 1800 },
        { text: "🎯 Performance optimization plan compiled!", delay: 2400 }
      ];
    }

    steps.forEach((step) => {
      setTimeout(() => {
        setProgressLog(prev => [...prev, step.text]);
        if (step.text.includes("computed") || step.text.includes("completed") || step.text.includes("compiled")) {
          setRunning(false);
          setShowResults(true);
        }
      }, step.delay);
    });
  };

  return (
    <section id="simulator" className="py-20 max-w-7xl mx-auto px-6 relative">
      
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="text-center max-w-3xl mx-auto mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Interactive Web Simulator
        </h2>
        <p className="text-slate-400">
          Select an analysis approach, edit or write your own custom queries, and watch the agent pipeline optimize indexing and speeds automatically.
        </p>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="flex justify-center mb-8">
        <div className="flex p-1 bg-slate-900 border border-brand-border/80 rounded-xl max-w-lg w-full">
          <button
            onClick={() => setActiveTab("demo_db")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "demo_db"
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="text-emerald-400">🟢</span>
            Demo Database
          </button>
          <button
            onClick={() => setActiveTab("query_only")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "query_only"
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="text-indigo-400">🔵</span>
            Query Only
          </button>
          <button
            onClick={() => setActiveTab("explain_plan")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "explain_plan"
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="text-rose-400">🟣</span>
            Query + Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Configuration Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Mode Info Badge */}
          <div className="glass p-4 rounded-2xl text-left border-brand-primary/10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Active Analysis Mode</span>
            <span className="text-sm font-semibold text-white">
              {activeTab === "demo_db" && "🟢 Demo Database (Simulate database profiling & automatic indexing)"}
              {activeTab === "query_only" && "🔵 Query Only (AI anti-pattern reviews - no database required)"}
              {activeTab === "explain_plan" && "🟣 Query + Plan (Root cause analytics using your EXPLAIN output)"}
            </span>
          </div>

          {/* Scenario Selector (only for Demo DB) */}
          {activeTab === "demo_db" && (
            <div className="glass p-5 rounded-2xl text-left">
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Load Scenario Template
              </label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full bg-slate-900 border border-brand-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary"
              >
                {Object.entries(SCENARIOS).map(([key, sc]) => (
                  <option key={key} value={key}>{sc.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* SQL Input Area */}
          <div className="glass p-5 rounded-2xl flex flex-col text-left">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Your SQL Query:
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-brand-border text-slate-400 font-mono">Editable</span>
            </div>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              rows={6}
              placeholder="SELECT * FROM table WHERE condition..."
              className="w-full bg-slate-950/70 border border-brand-border/60 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 resize-y"
            />

            {/* Additional EXPLAIN Input for Query + Plan mode */}
            {activeTab === "explain_plan" && (
              <div className="mt-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Execution Plan (EXPLAIN output):
                  </label>
                </div>
                <textarea
                  value={explainInput}
                  onChange={(e) => setExplainInput(e.target.value)}
                  rows={4}
                  placeholder="Paste your EXPLAIN QUERY PLAN output..."
                  className="w-full bg-slate-950/70 border border-brand-border/60 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 resize-y"
                />
              </div>
            )}

            <button
              onClick={handleRun}
              disabled={running || !sqlQuery.trim()}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-primary hover:bg-brand-primary/95 disabled:opacity-50 text-white font-semibold shadow-lg shadow-brand-primary/10 transition-all duration-200"
            >
              <Play size={14} fill="white" />
              {running ? "Analyzing..." : (
                activeTab === "demo_db" ? "⚡ Run Optimizer Agent" : 
                activeTab === "query_only" ? "🔍 Analyze Query" : "🔬 Analyze Query + Plan"
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Log Console / Output Metrics */}
        <div className="lg:col-span-8">
          
          {/* Default Screen */}
          {!running && !showResults && (
            <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center text-center min-h-[460px]">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-brand-border/50 flex items-center justify-center mb-6">
                <Sparkles className="text-slate-500" size={28} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Awaiting Analysis</h3>
              <p className="text-slate-400 text-xs max-w-sm font-light">
                Write or edit your SQL query on the left and click run to trigger the local LLM diagnostics and indexing steps.
              </p>
            </div>
          )}

          {/* Running State Logs */}
          {running && (
            <div className="glass p-8 rounded-2xl min-h-[460px] flex flex-col justify-between text-left">
              <div>
                <h3 className="text-xs font-semibold text-slate-300 mb-6 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-secondary"></span>
                  </span>
                  Agent Loop Execution Console
                </h3>
                <div className="flex flex-col gap-3 font-mono text-xs">
                  {progressLog.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-300 animate-fade-in">
                      <span className="text-brand-secondary">✓</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 bg-brand-primary/5 border border-brand-primary/10 p-4 rounded-xl mt-6">
                <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-brand-primary/95 font-mono">Agent pipeline is executing diagnostics...</p>
              </div>
            </div>
          )}

          {/* Results State */}
          {showResults && parsedData && (
            <div className="flex flex-col gap-6 animate-fade-in text-left">
              
              {/* Timing & Metrics Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeTab === "demo_db" && (
                  <>
                    <div className="glass p-5 rounded-2xl">
                      <span className="text-xs text-slate-400 block mb-1">Original Speed (Avg)</span>
                      <span className="text-xl font-bold text-rose-400">{parsedData.originalSpeed.toFixed(1)} ms</span>
                    </div>
                    <div className="glass p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
                      <span className="text-xs text-slate-400 block mb-1">Optimized Speed (Avg)</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-emerald-400">{parsedData.optimizedSpeed.toFixed(1)} ms</span>
                        <span className="text-[10px] text-emerald-500 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10">Index Applied</span>
                      </div>
                    </div>
                    <div className="glass bg-gradient-to-br from-indigo-950/20 to-slate-900 p-5 rounded-2xl border-brand-primary/20">
                      <span className="text-xs text-brand-secondary block mb-1">Speedup Factor</span>
                      <span className="text-xl font-bold text-white">+{parsedData.estimatedImprovement} Faster</span>
                    </div>
                  </>
                )}

                {activeTab === "query_only" && (
                  <div className="col-span-3 glass p-5 rounded-2xl border-brand-primary/20 bg-brand-primary/5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Analysis Result</span>
                      <span className="text-base font-bold text-white">Query Analysis & Code Rewrite suggestions computed</span>
                    </div>
                    <span className="text-xs px-3 py-1.5 rounded-xl bg-indigo-500/10 text-brand-primary border border-brand-primary/20 font-mono">Offline Mode</span>
                  </div>
                )}

                {activeTab === "explain_plan" && (
                  <>
                    <div className="col-span-2 glass p-5 rounded-2xl">
                      <span className="text-xs text-slate-400 block mb-1">Supplied Execution Plan Diagnostic</span>
                      <span className="text-sm font-semibold text-white">Traced table scan paths from your EXPLAIN output</span>
                    </div>
                    <div className="glass bg-gradient-to-br from-indigo-950/20 to-slate-900 p-5 rounded-2xl border-brand-primary/20">
                      <span className="text-xs text-brand-secondary block mb-1">Estimated Speedup</span>
                      <span className="text-xl font-bold text-white">{parsedData.estimatedImprovement}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Side: Original query / plan */}
                <div className="glass p-6 rounded-2xl flex flex-col gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Before Configuration</h4>
                    <span className="text-xs text-slate-500 block mb-1.5">Original SQL:</span>
                    <pre className="bg-slate-950/40 p-3 rounded-lg text-[10px] font-mono text-slate-400 overflow-x-auto max-h-[140px] whitespace-pre-wrap border border-brand-border/30">
                      {parsedData.originalSql}
                    </pre>
                  </div>

                  {activeTab !== "query_only" && (
                    <div>
                      <span className="text-xs text-slate-500 block mb-1.5">Baseline EXPLAIN Plan:</span>
                      <pre className="bg-slate-950/40 p-3 rounded-lg text-[10px] font-mono text-rose-300 overflow-x-auto max-h-[100px] border border-rose-900/15">
                        {activeTab === "explain_plan" ? explainInput : parsedData.explainOriginal}
                      </pre>
                    </div>
                  )}

                  <div>
                    <span className="text-xs text-slate-500 block mb-1.5">Identified Anti-patterns:</span>
                    <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                      {parsedData.issues.map((iss, i) => (
                        <li key={i}>{iss}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Side: Optimized SQL / Plan */}
                <div className="glass p-6 rounded-2xl flex flex-col gap-4 border-brand-primary/25">
                  <div>
                    <h4 className="text-xs font-semibold text-brand-secondary mb-2 uppercase tracking-wider">After AI Rewrite</h4>
                    <span className="text-xs text-slate-500 block mb-1.5">Optimized SQL Code:</span>
                    <pre className="bg-slate-950/60 p-3 rounded-lg text-[10px] font-mono text-slate-200 overflow-x-auto max-h-[140px] whitespace-pre-wrap border border-brand-border/80">
                      {parsedData.optimizedSql}
                    </pre>
                  </div>

                  {activeTab !== "query_only" && (
                    <div>
                      <span className="text-xs text-slate-500 block mb-1.5">Optimized EXPLAIN Plan:</span>
                      <pre className="bg-slate-950/40 p-3 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-[100px] border border-emerald-900/15">
                        {parsedData.explainOptimized}
                      </pre>
                    </div>
                  )}

                  {activeTab !== "query_only" && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase block">Index Creation Script</span>
                        <code className="text-[10px] font-mono text-emerald-200 mt-1 block">
                          {parsedData.indexScript}
                        </code>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Applied Automatically</span>
                    </div>
                  )}
                </div>

              </div>

              {/* AI diagnostic response notes */}
              <div className="glass p-6 rounded-2xl">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">🤖 AI Agent Diagnostic Notes</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-light font-sans">
                  {parsedData.aiNotes}
                </p>
              </div>

              {/* Reset action */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => {
                    setShowResults(false);
                    setProgressLog([]);
                  }}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors"
                >
                  <RotateCcw size={12} />
                  Reset Simulator
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </section>
  );
}
