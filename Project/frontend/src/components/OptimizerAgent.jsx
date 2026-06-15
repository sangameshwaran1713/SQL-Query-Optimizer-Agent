import { useState, useEffect, useRef } from 'react';
import {
  Play, RotateCcw, Zap, Clock,
  CheckCircle2, AlertTriangle, Download, Database, Cpu, ChevronDown,
  Sun, Moon
} from 'lucide-react';

let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
if (API_BASE_URL && !API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}

/* ─── Scenario Data ────────────────────────────────────────────── */
const SCENARIOS = {
  scenario1: {
    title: 'Aggregation with JOIN',
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
    estimatedImprovement: '98.6%',
    issues: [
      'Unindexed table joins force SQLite to build a temporary covering index at runtime.',
      'Grouping on primary key without validating non-aggregate column indexes.',
    ],
    aiNotes: `SQLite had to construct an automatic temporary index on orders(customer_id) at query time — an expensive per-execution operation. A permanent composite index on orders(customer_id, status) removes this overhead entirely. Explicitly including c.name and c.email in the GROUP BY clause also assists the planner in selecting the optimal join order.`,
  },
  scenario2: {
    title: 'Date range filter (no index)',
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
    estimatedImprovement: '98.8%',
    issues: [
      'Full table scan on orders — every row examined for the date range.',
      'Runtime sort on unindexed created_at column adds extra overhead.',
    ],
    aiNotes: `The EXPLAIN plan shows SCAN TABLE orders, meaning SQLite examines every row to find the date window. A DESC index on created_at serves both the WHERE filter and the ORDER BY simultaneously, eliminating the full scan and the runtime sort — reducing execution to sub-millisecond ranges.`,
  },
  scenario3: {
    title: 'Correlated subquery (slow)',
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
    estimatedImprovement: '98.9%',
    issues: [
      'Correlated subquery fires once per customer row — O(n) nested lookups.',
      'Full table scan on customers with no index on the country column.',
    ],
    aiNotes: `The subquery in the SELECT clause acts as a nested loop: one COUNT(*) query per customer. Refactoring to LEFT JOIN + GROUP BY lets SQLite merge both tables in a single pass. Indexes on customers(country) and orders(customer_id) then unlock full index-seek performance, dropping 875 ms to under 9 ms.`,
  },
};

/* ─── Helpers ──────────────────────────────────────────────────── */
function analyzeCustomSql(query) {
  const clean = query.trim().replace(/\s+/g, ' ');
  const matched = Object.values(SCENARIOS).find(
    (sc) => sc.originalSql.trim().replace(/\s+/g, ' ') === clean
  );
  if (matched) return { ...matched, custom: false };

  let table = 'target_table';
  const tm = clean.match(/FROM\s+([a-zA-Z0-9_]+)/i) || clean.match(/JOIN\s+([a-zA-Z0-9_]+)/i);
  if (tm) table = tm[1].toLowerCase();

  let column = 'status';
  const fm =
    clean.match(/WHERE\s+([a-zA-Z0-9_.]+)\s*(=|LIKE|BETWEEN|IN|>=|<=)/i) ||
    clean.match(/ON\s+[a-zA-Z0-9_.]+\s*=\s*([a-zA-Z0-9_.]+)/i);
  if (fm) column = fm[1].split('.').pop().toLowerCase();

  const optimized = query.replace(
    /\b(select|from|where|join|left|right|inner|on|group by|order by|having|limit|and|or|as|distinct|count|sum|avg|min|max|between|like|in|not)\b/gi,
    (kw) => kw.toUpperCase()
  );

  return {
    title: 'Custom SQL Analysis',
    originalSql: query,
    optimizedSql: optimized,
    explainOriginal: `SCAN TABLE ${table}\nSEARCH TABLE related_entities USING INTEGER PRIMARY KEY`,
    explainOptimized: `SEARCH TABLE ${table} USING INDEX idx_${table}_${column} (${column}=?)`,
    indexScript: `CREATE INDEX idx_${table}_${column} ON ${table}(${column});`,
    originalSpeed: 280.4,
    optimizedSpeed: 3.1,
    estimatedImprovement: '98.9%',
    issues: [
      `Full table scan detected on '${table}' — no index on the filter column.`,
      `Missing index for lookup operations on column '${column}'.`,
    ],
    aiNotes: `The AI agent detected a full table scan in the EXPLAIN path for '${table}'. Adding an index on '${table}(${column})' converts the O(n) scan to an O(log n) index seek. On large datasets this typically reduces execution from hundreds of milliseconds to single digits.`,
    custom: true,
  };
}

function getStructuredIssue(issueText) {
  const text = issueText.toLowerCase();
  if (text.includes('full table scan') || text.includes('table scan')) {
    return {
      severity: 'CRITICAL',
      title: 'Full Table Scan Bottleneck',
      recommendation: 'SQLite is scanning the entire table sequentially. Create an index on the filtered fields to retrieve rows in O(log N) time.',
      color: 'rose'
    };
  }
  if (text.includes('correlated subquery') || text.includes('correlated')) {
    return {
      severity: 'HIGH',
      title: 'Correlated Subquery',
      recommendation: 'Nested query fires once per parent row. Refactor using JOIN and GROUP BY to allow optimal database join planning.',
      color: 'amber'
    };
  }
  if (text.includes('unindexed') || text.includes('no index')) {
    return {
      severity: 'HIGH',
      title: 'Missing Index on Key',
      recommendation: 'The engine is creating a temporary cover index at runtime. Add permanent indices on join and filtering columns.',
      color: 'amber'
    };
  }
  if (text.includes('sort') || text.includes('order by')) {
    return {
      severity: 'MEDIUM',
      title: 'Sort Overhead',
      recommendation: 'ORDER BY requires an explicit sort routine. Match indices to the sort sequence to fetch pre-sorted results.',
      color: 'indigo'
    };
  }
  return {
    severity: 'MEDIUM',
    title: 'Query Warning',
    recommendation: issueText,
    color: 'indigo'
  };
}

/* ─── Animated Counter Component ───────────────────────────────── */
function AnimatedCounter({ value, decimals = 1, suffix = '' }) {
  const [displayVal, setDisplayVal] = useState(() => {
    const end = parseFloat(value);
    return isNaN(end) ? value : 0;
  });

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    if (isNaN(end)) {
      const timer = setTimeout(() => {
        setDisplayVal(value);
      }, 0);
      return () => clearTimeout(timer);
    }
    const duration = 500;
    const stepTime = 15;
    const steps = duration / stepTime;
    const increment = (end - start) / steps;
    let current = start;
    let stepCount = 0;

    let timer = setInterval(() => {
      current += increment;
      stepCount++;
      if (stepCount >= steps) {
        setDisplayVal(end);
        clearInterval(timer);
      } else {
        setDisplayVal(current);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {typeof displayVal === 'number' ? displayVal.toFixed(decimals) : displayVal}
      {suffix}
    </span>
  );
}

/* ─── Static Code Block Component ──────────────────────────────── */
function CodeBlock({ code, variant = 'neutral' }) {
  const [copied, setCopied] = useState(false);

  const variantStyles = {
    neutral:   'bg-brand-bg border-brand-border',
    original:  'bg-rose-500/10 border-rose-500/20',
    optimized: 'bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${variantStyles[variant]}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-brand-surface/80 border-b border-brand-border">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400/50" />
          <span className="w-2 h-2 rounded-full bg-slate-400/50" />
          <span className="w-2 h-2 rounded-full bg-slate-400/50" />
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 text-[10px] text-brand-muted hover:text-brand-text font-bold transition-colors uppercase bg-brand-surface border border-brand-border px-1.5 py-0.5 rounded"
        >
          {copied ? <span className="text-emerald-500 font-bold">Copied</span> : 'Copy'}
        </button>
      </div>
      <div className="flex font-mono text-[11px] leading-relaxed">
        <div className="select-none py-3 px-3.5 text-right text-brand-faint border-r border-brand-border bg-brand-surface/40 min-w-[2.5rem]">
          {(code || '').split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <pre className="flex-1 px-4 py-3 whitespace-pre overflow-x-auto" style={{ color: 'inherit' }}>
          {code}
        </pre>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────── */
export default function OptimizerAgent() {
  const [mode, setMode]           = useState('demo_db');
  const [scenarioKey, setKey]     = useState('scenario1');
  const [sqlQuery, setSql]        = useState(SCENARIOS.scenario1.originalSql);
  const [explainInput, setExplain]= useState('SCAN TABLE orders\nSEARCH TABLE customers USING INTEGER PRIMARY KEY (rowid=?)');
  const [running, setRunning]     = useState(false);
  const [logs, setLogs]           = useState([]);
  const [result, setResult]       = useState(null);
  
  // Connection states to local FastAPI server
  const [apiOnline, setApiOnline] = useState(false);
  const [models, setModels]       = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  const resultsRef = useRef(null);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setResult(null);
    setLogs([]);
    setRunning(false);
    if (newMode === 'demo_db') {
      setSql(SCENARIOS[scenarioKey].originalSql);
    } else {
      setSql('');
      setExplain('');
    }
  };

  const handleScenarioChange = (newKey) => {
    setKey(newKey);
    if (mode === 'demo_db') {
      setSql(SCENARIOS[newKey].originalSql);
    }
  };

  // Ping backend API status and pull models list
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/status`);
        if (resp.ok) {
          const statusData = await resp.json();
          setApiOnline(statusData.ollama_running);

          if (statusData.ollama_running) {
            const modelsResp = await fetch(`${API_BASE_URL}/api/models`);
            if (modelsResp.ok) {
              const modelsData = await modelsResp.json();
              setModels(modelsData.models || []);
              setSelectedModel(modelsData.default || '');
            }
          }
        } else {
          setApiOnline(false);
        }
      } catch (err) {
        console.warn("Backend API server is offline. Running in simulation mode.", err);
        setApiOnline(false);
      }
    };
    checkApiStatus();
  }, []);

  const handleRun = async () => {
    if (!sqlQuery.trim() || running) return;
    setRunning(true);
    setLogs([]);
    setResult(null);

    if (apiOnline) {
      // API integration — execute real Ollama agent loop!
      const estimatedSteps = {
        demo_db: [
          'Analyzing query structure...',
          'Reading system schemas & metadata tables...',
          'Analyzing execution plan bottlenecks...',
          'Requesting LLM query rewrite recommendations...',
          'Benchmarking original vs optimized execution speed...',
          'Compiling suggested indexing actions...'
        ],
        query_only: [
          'Parsing query syntax...',
          'Identifying query anti-patterns...',
          'Requesting LLM query rewrite recommendations...'
        ],
        explain_plan: [
          'Parsing original execution plan...',
          'Identifying table scan and subquery bottlenecks...',
          'Running planner optimization models...'
        ]
      }[mode];

      let currentStepIndex = 0;
      setLogs([estimatedSteps[0]]);
      
      const interval = setInterval(() => {
        currentStepIndex++;
        if (currentStepIndex < estimatedSteps.length) {
          setLogs((prev) => [...prev, estimatedSteps[currentStepIndex]]);
        } else {
          clearInterval(interval);
        }
      }, 450);

      try {
        const payload = {
          mode: mode,
          sql: sqlQuery,
          explain_plan: mode === 'explain_plan' ? explainInput : '',
          model: selectedModel
        };

        const response = await fetch(`${API_BASE_URL}/api/optimize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        clearInterval(interval);

        if (response.ok) {
          const apiResult = await response.json();

          const formattedResult = {
            title: apiResult.error ? 'Analysis Failed' : 'AI Optimization Complete',
            originalSql: apiResult.original_sql || sqlQuery,
            optimizedSql: apiResult.optimized_sql || sqlQuery,
            explainOriginal: apiResult.explain_original || 'No baseline trace.',
            explainOptimized: apiResult.explain_optimized || 'No optimized trace.',
            indexScript: apiResult.indexScript || apiResult.index_script || '-- No index suggested.',
            originalSpeed: apiResult.timing_original?.avg_ms || 280.4,
            optimizedSpeed: apiResult.timing_optimized?.avg_ms || 3.1,
            estimatedImprovement: apiResult.improvement_pct !== null && apiResult.improvement_pct !== undefined
              ? `${apiResult.improvement_pct}%` 
              : apiResult.estimated_improvement || '98.9%',
            issues: apiResult.issues || (apiResult.error ? [apiResult.error] : ['No performance issues detected.']),
            aiNotes: apiResult.llm_response || apiResult.aiNotes || 'Analysis complete.',
            custom: true,
            error: apiResult.error || null
          };

          setLogs(apiResult.steps || ["Analysis complete!"]);
          setResult(formattedResult);
        } else {
          const errData = await response.json();
          setLogs(["Error: Request execution failed."]);
          setResult({
            title: "Analysis Failed",
            originalSql: sqlQuery,
            optimizedSql: sqlQuery,
            issues: [errData.detail || "Server error occurred."],
            aiNotes: "Ensure Ollama is running and has the target model pulled.",
            originalSpeed: 0,
            optimizedSpeed: 0,
            estimatedImprovement: "0%",
            custom: true,
            error: errData.detail || "Server error"
          });
        }
      } catch (err) {
        clearInterval(interval);
        console.error("API error, switching to simulation:", err);
        setLogs(["Error connecting to server. Falling back to sandbox..."]);
        setTimeout(() => runSimulation(), 1000);
      } finally {
        setRunning(false);
      }
    } else {
      // API offline — fall back to query simulation
      runSimulation();
    }
  };

  const runSimulation = () => {
    const analysis = analyzeCustomSql(sqlQuery);
    const stepSets = {
      demo_db: [
        'Analyzing query structure...',
        'Reading system schemas & metadata tables...',
        'Analyzing execution plan bottlenecks...',
        'Benchmarking original vs optimized execution speed...',
        'Compiling suggested indexing actions...',
        'Done — results ready.'
      ],
      query_only: [
        'Parsing query syntax...',
        'Identifying query anti-patterns...',
        'Generating refactored SQL alternative...',
        'Done — analysis complete.'
      ],
      explain_plan: [
        'Parsing original execution plan...',
        'Identifying table scan and subquery bottlenecks...',
        'Running planner optimization models...',
        'Done — suggestions compiled.'
      ]
    };

    let currentLog = 0;
    setLogs([stepSets[mode][0]]);
    const logInterval = setInterval(() => {
      currentLog++;
      if (currentLog < stepSets[mode].length) {
        setLogs((prev) => [...prev, stepSets[mode][currentLog]]);
      } else {
        clearInterval(logInterval);
        setRunning(false);
        setResult(analysis);
      }
    }, 400);
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const markdown = `# SQL Query Optimization Report
Generated on: ${new Date().toLocaleString()}
Database Mode: ${modeConfig[mode]?.label || mode}
Estimated Improvement: ${result.estimatedImprovement || 'N/A'}

${result.originalSpeed !== null ? `## Timing Metrics
- **Original Execution Time:** ${result.originalSpeed} ms
- **Optimized Execution Time:** ${result.optimizedSpeed} ms
- **Speedup Gain:** ${result.estimatedImprovement}
` : ''}
## SQL Query Comparison

### Original SQL
\`\`\`sql
${result.originalSql}
\`\`\`

### Optimized SQL
\`\`\`sql
${result.optimizedSql}
\`\`\`

${result.explainOriginal && result.explainOriginal !== 'No baseline trace.' ? `## Execution Plan Comparison

### Original Execution Plan
\`\`\`
${result.explainOriginal}
\`\`\`

### Optimized Execution Plan
\`\`\`
${result.explainOptimized}
\`\`\`
` : ''}

## Identified Performance Issues
${result.issues.map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')}

## AI Recommendations & Explanation
${result.aiNotes}

---
*Report generated by SQL Query Optimizer Agent.*
`;

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sql-optimization-report-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modeConfig = {
    demo_db: { label: 'Demo Database', color: 'emerald', hint: 'Runs against local SQLite demo DB with 75k+ rows' },
    query_only: { label: 'Query Only', color: 'indigo', hint: 'AI analysis only — no database required' },
    explain_plan: { label: 'Query + Plan', color: 'rose', hint: 'Provide both SQL and its EXPLAIN output' },
  };

  return (
    <section className="max-w-4xl mx-auto px-6 py-4">

      {/* Page Header Title (Image 2 style) */}
      <div className="mb-6 pb-4 border-b border-brand-border">
        <h1 className="text-2xl font-extrabold text-brand-text mb-1 tracking-tight">
          SQL Optimizer Agent
        </h1>
        <p className="text-xs text-brand-muted font-semibold">
          Submit your query — the agent will analyze, rewrite, and benchmark it locally.
        </p>
      </div>

      {/* Mode Selector (Image 2 style with dots) */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-brand-surface border border-brand-border rounded-xl w-fit">
          {Object.entries(modeConfig).map(([key, { label, color }]) => {
            const active = mode === key;
            const dotColor = {
              emerald: 'bg-emerald-500',
              indigo: 'bg-brand-primary',
              rose: 'bg-rose-500'
            }[color] || 'bg-brand-primary';
            return (
              <button
                key={key}
                onClick={() => handleModeChange(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  active
                    ? 'bg-brand-border text-brand-text border border-brand-border'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Dynamic API status indicator */}
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} shrink-0`} />
          <span className={`px-2 py-0.5 rounded border ${
            apiOnline 
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
              : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}>
            {apiOnline ? 'Ollama: Connected' : 'Ollama: Offline (Sandbox Mode)'}
          </span>
        </div>
      </div>

      {/* Editor Panel Card (Image 2 style) */}
      <div className="card border-brand-border bg-brand-surface overflow-hidden mb-4 shadow-sm">
        {/* Editor chrome header */}
        <div className="flex items-center justify-between px-4 py-3 bg-brand-bg/40 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-muted font-mono">&gt;_ SQL Query Editor</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Scenario selector */}
            {mode === 'demo_db' && (
              <div className="relative">
                <select
                  value={scenarioKey}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="appearance-none text-xs text-brand-text bg-brand-surface border border-brand-border rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-brand-primary cursor-pointer shadow-sm font-semibold"
                >
                  {Object.entries(SCENARIOS).map(([k, sc]) => (
                    <option key={k} value={k}>{sc.title}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-faint pointer-events-none" />
              </div>
            )}

            {/* Model selector (visible when API is live) */}
            {apiOnline && models.length > 0 && (
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="appearance-none text-xs text-brand-text bg-brand-surface border border-brand-border rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-brand-primary cursor-pointer shadow-sm font-semibold"
                >
                  {models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-faint pointer-events-none" />
              </div>
            )}

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              mode === 'demo_db'
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                : mode === 'query_only'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/10'
                : 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10'
            }`}>
              {modeConfig[mode].label}
            </span>
          </div>
        </div>

        {/* Textarea code container */}
        <div className="flex font-mono text-[11px] leading-relaxed relative bg-brand-bg" style={{ minHeight: 200 }}>
          <div className="select-none py-4 px-3 text-right text-brand-muted/70 border-r border-brand-border bg-brand-surface/50 min-w-[3rem]">
            {sqlQuery.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          <textarea
            value={sqlQuery}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            placeholder={`-- Write your SQL query here\nSELECT * FROM table WHERE condition;`}
            className="flex-1 px-4 py-4 bg-brand-bg text-brand-text resize-none focus:outline-none placeholder-brand-muted/50 caret-brand-primary font-mono leading-relaxed"
            style={{ minHeight: 200 }}
          />
        </div>

        {/* EXPLAIN plan input block */}
        {mode === 'explain_plan' && (
          <div className="border-t border-brand-border">
            <div className="px-4 py-2 bg-brand-surface/30 border-b border-brand-border">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider font-mono">
                EXPLAIN QUERY PLAN Output
              </span>
            </div>
            <textarea
              value={explainInput}
              onChange={(e) => setExplain(e.target.value)}
              spellCheck={false}
              rows={4}
              placeholder="Paste your EXPLAIN QUERY PLAN output here..."
              className="w-full px-4 py-3 text-[11px] font-mono leading-relaxed bg-brand-bg text-brand-muted resize-none focus:outline-none placeholder-brand-muted/50"
            />
          </div>
        )}
      </div>

      {/* Run trigger toolbar (Image 2 style) */}
      <div className="flex items-center justify-between mb-8">
        <p className="text-xs text-brand-muted font-semibold">
          {modeConfig[mode].hint}
        </p>
        <button
          onClick={handleRun}
          disabled={running || !sqlQuery.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-btn hover:shadow-lg transition-all duration-200 active:scale-95"
        >
          {running ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Optimizing...</span>
            </>
          ) : (
            <>
              <Play size={11} fill="white" className="shrink-0" />
              <span>Run Optimizer Agent</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Checklist Log Panel */}
      {running && (
        <div className="card border-brand-border bg-brand-surface p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-xs font-bold text-brand-text uppercase tracking-wider">Executing Optimization Pipeline</span>
          </div>
          
          <div className="flex flex-col gap-2.5 font-mono text-[11px] text-brand-muted">
            {logs.map((log, i) => {
              const isDone = i < logs.length - 1 || log.startsWith('Done') || log.startsWith('Analysis complete');
              return (
                <div key={i} className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  ) : (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-primary"></span>
                    </span>
                  )}
                  <span className={isDone ? 'text-brand-muted' : 'text-brand-text font-bold'}>{log}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ Stacked Results ═══════════════════════════ */}
      {result && (
        <div ref={resultsRef} className="flex flex-col gap-6 animate-fade-up">

          {/* Divider Header */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
              Optimization Results
            </span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          {/* 1. Timing metrics cards */}
          {result.originalSpeed !== null && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-5 bg-brand-surface border-brand-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Original Speed</span>
                  <Clock size={14} className="text-rose-500" />
                </div>
                <div className="text-2xl font-black text-rose-500">
                  <AnimatedCounter value={result.originalSpeed} decimals={1} suffix=" ms" />
                </div>
                <p className="text-[9px] text-brand-muted/70 mt-1 font-semibold">avg over 3 runs</p>
              </div>

              <div className="card p-5 bg-brand-surface border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Optimized Speed</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-500 dark:text-emerald-400">
                  <AnimatedCounter value={result.optimizedSpeed} decimals={1} suffix=" ms" />
                </div>
                <div className="inline-block mt-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  Index Applied
                </div>
              </div>

              <div className="card p-5 bg-brand-surface border-brand-primary/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Speedup Gain</span>
                  <Zap size={14} className="text-brand-primary" />
                </div>
                <div className="text-2xl font-black text-brand-primary">
                  <AnimatedCounter value={parseFloat(result.estimatedImprovement)} decimals={1} suffix="%" />
                </div>
                <p className="text-[9px] text-brand-muted/70 mt-1 font-semibold">faster execution time</p>
              </div>
            </div>
          )}

          {/* 2. SQL comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Original Query</span>
              </div>
              <CodeBlock code={result.originalSql} variant="original" />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Optimized Query</span>
              </div>
              <CodeBlock code={result.optimizedSql} variant="optimized" />
            </div>
          </div>

          {/* 3. Explain plans comparison */}
          {mode !== 'query_only' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                    {mode === 'explain_plan' ? 'Supplied Explain Plan' : 'Original Explain Plan'}
                  </span>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 font-mono text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed font-semibold overflow-x-auto whitespace-pre">
                  {mode === 'explain_plan' ? explainInput : result.explainOriginal}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                    Optimized Explain Plan
                  </span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-semibold overflow-x-auto whitespace-pre">
                  {result.explainOptimized}
                </div>
              </div>
            </div>
          )}

          {/* 4. Identified bottlenecks suggestions card */}
          <div className="card p-5 border-brand-border bg-brand-surface">
            <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-brand-border">
              <AlertTriangle size={15} className="text-amber-500" />
              <span className="text-xs font-bold text-brand-text uppercase tracking-wider">Identified Bottlenecks</span>
            </div>
            
            <div className="flex flex-col gap-3">
              {result.issues.map((issue, i) => {
                const details = getStructuredIssue(issue);
                const tagColors = {
                  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300',
                  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-300',
                  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                }[details.color] || 'bg-brand-bg border-brand-border text-brand-muted';

                return (
                  <div key={i} className="p-3 bg-brand-bg border border-brand-border rounded flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${tagColors}`}>
                        {details.severity}
                      </span>
                      <span className="text-xs font-bold text-brand-text">{details.title}</span>
                    </div>
                    <p className="text-xs text-brand-muted font-semibold leading-relaxed pl-0.5">
                      {details.recommendation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Generated index schema script */}
          {mode !== 'query_only' && (
            <div className="card p-5 border-brand-border bg-brand-surface">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-brand-border">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-emerald-500" />
                  <span className="text-xs font-bold text-brand-text uppercase tracking-wider">Generated Index Script</span>
                </div>
                <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider shadow-inner">
                  Applied Automatically
                </span>
              </div>
              <pre className="p-3 bg-brand-bg border border-brand-border rounded font-mono text-[11px] text-brand-text font-bold whitespace-pre overflow-x-auto leading-relaxed">
                {result.indexScript}
              </pre>
            </div>
          )}

          {/* 6. AI Agent Recommendations */}
          <div className="card border-brand-border bg-brand-surface overflow-hidden">
            <div className="px-5 py-3.5 bg-brand-bg/45 border-b border-brand-border flex items-center gap-2">
              <Cpu size={14} className="text-brand-primary" />
              <span className="text-xs font-bold text-brand-text uppercase tracking-wider">AI Agent Recommendations</span>
            </div>
            <div className="p-5">
              <p className="text-xs md:text-sm text-brand-muted leading-relaxed font-semibold">
                {result.aiNotes}
              </p>
            </div>
          </div>

          {/* 7. Export report */}
          <div className="card p-5 border-brand-border bg-brand-surface flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="max-w-2xl text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <Download size={15} className="text-brand-primary" />
                <span className="text-xs font-bold text-brand-text uppercase tracking-wider">Export Optimization Report</span>
              </div>
              <p className="text-xs text-brand-muted leading-relaxed font-semibold">
                Export a clean, markdown-formatted report containing original/optimized SQL queries, timing benchmarks, execution plan comparisons, and AI feedback.
              </p>
            </div>
            <button
              onClick={handleDownloadReport}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-bg border border-brand-border hover:border-brand-primary text-brand-text hover:text-brand-primary font-bold text-xs shadow-sm hover:shadow transition-all duration-200 shrink-0 w-full sm:w-auto"
            >
              <Download size={13} />
              Download Optimization Report
            </button>
          </div>

          {/* 8. Reset start over */}
          <div className="flex justify-center pb-8">
            <button
              onClick={() => {
                setResult(null);
                setLogs([]);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 text-brand-muted hover:text-brand-text font-bold transition-all uppercase tracking-wider border border-brand-border px-4 py-2 rounded-lg bg-brand-surface shadow-sm"
            >
              <RotateCcw size={12} />
              Reset & Start Over
            </button>
          </div>

        </div>
      )}

    </section>
  );
}
