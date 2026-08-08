import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, Copy, CheckCircle, Terminal, Code, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

type CodeLang = 'javascript' | 'python';

const LANG_CONFIG: Record<CodeLang, { label: string; placeholder: string; color: string }> = {
  javascript: {
    label: 'JavaScript',
    placeholder: '// Write JavaScript code here\nconsole.log("Hello, Aira!");\n\n// Math operations\nconst result = [1,2,3,4,5].reduce((a,b) => a+b, 0);\nconsole.log("Sum:", result);',
    color: 'text-yellow-400',
  },
  python: {
    label: 'Python',
    placeholder: '# Write Python code here\nprint("Hello, Aira!")\n\n# Math operations\nresult = sum([1,2,3,4,5])\nprint("Sum:", result)',
    color: 'text-green-400',
  },
};

// Web Worker instance for JavaScript execution (true sandbox)
let codeWorker: Worker | null = null;
let executionId = 0;

function getOrCreateWorker(): Worker {
  if (!codeWorker) {
    codeWorker = new Worker('/code-worker.js');
  }
  return codeWorker;
}

function executeJavaScript(code: string): Promise<{ output: string; error: string | null }> {
  return new Promise((resolve) => {
    const id = ++executionId;
    const worker = getOrCreateWorker();

    const timeout = setTimeout(() => {
      worker.terminate();
      codeWorker = null;
      resolve({ output: '', error: 'Execution timed out (max 5 seconds)' });
    }, 6000); // 6s hard limit (worker has 5s soft limit)

    const handler = (e: MessageEvent) => {
      if (e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
        resolve({ output: e.data.output || '(no output)', error: e.data.error || null });
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ code, id });
  });
}

export default function CodePanel() {
  const [language, setLanguage] = useState<CodeLang>('javascript');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  async function handleRun() {
    const sourceCode = code.trim();
    if (!sourceCode) return;

    setIsRunning(true);
    setOutput('');
    setError('');

    if (language === 'javascript') {
      // Execute JavaScript in Web Worker (true sandbox — no access to window/document/fetch)
      try {
        const result = await executeJavaScript(sourceCode);
        setOutput(result.output || '(no output)');
        if (result.error) setError(result.error);
      } catch {
        setError('Code execution failed. The sandbox may be unavailable.');
      }
      setIsRunning(false);
    } else {
      // Python: send to AI for simulated execution
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Execute this Python code and show ONLY the output (like a Python interpreter would). Do NOT explain the code. Just show what print() outputs:\n\n\`\`\`python\n${sourceCode}\n\`\`\``,
            stream: false,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const content = data.content || 'No output';
          // Clean markdown formatting
          setOutput(content.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').trim()).trim());
        } else {
          setError('Failed to execute Python. Check your connection.');
        }
      } catch {
        setError('Network error. Please try again.');
      }
      setIsRunning(false);
    }
  }

  async function handleCopy() {
    const text = output || error;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClear() {
    setCode('');
    setOutput('');
    setError('');
  }

  const langConfig = LANG_CONFIG[language];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-jarvis-cyan/20 flex items-center justify-center">
            <Terminal size={20} className="text-jarvis-cyan" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-jarvis-text text-lg">Code Execution</h2>
            <p className="text-xs text-jarvis-muted">Run JavaScript locally • Python via AI</p>
          </div>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-1 bg-jarvis-surface border border-jarvis-border rounded-lg p-1">
          {(Object.keys(LANG_CONFIG) as CodeLang[]).map((lang) => (
            <button
              key={lang}
              onClick={() => { setLanguage(lang); setOutput(''); setError(''); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                language === lang
                  ? 'bg-jarvis-cyan/20 text-jarvis-cyan border border-jarvis-cyan/30'
                  : 'text-jarvis-muted hover:text-jarvis-text border border-transparent'
              }`}
            >
              {LANG_CONFIG[lang].label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col">
            {/* Code area */}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 relative">
                {/* Line numbers */}
                <div className="absolute left-0 top-0 bottom-0 w-10 bg-jarvis-bg border-r border-jarvis-border overflow-hidden pointer-events-none">
                  <div className="pt-3 px-2 text-right">
                    {Array.from({ length: Math.max(code.split('\n').length, 10) }).map((_, i) => (
                      <div key={i} className="text-[10px] text-jarvis-muted/40 leading-[20px] font-mono">{i + 1}</div>
                    ))}
                  </div>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    // Ctrl+Enter to run
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleRun();
                    }
                    // Tab to insert spaces
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const start = e.currentTarget.selectionStart;
                      const end = e.currentTarget.selectionEnd;
                      setCode(code.substring(0, start) + '  ' + code.substring(end));
                      setTimeout(() => {
                        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                      }, 0);
                    }
                  }}
                  placeholder={langConfig.placeholder}
                  spellCheck={false}
                  className="w-full h-full bg-jarvis-bg text-sm text-jarvis-text font-mono pl-12 pr-4 py-3 resize-none focus:outline-none leading-[20px] placeholder:text-jarvis-muted/30"
                />
              </div>
            </div>

            {/* Output area */}
            <AnimatePresence>
              {(output || error) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-jarvis-border overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-2 bg-jarvis-surface/50 border-b border-jarvis-border">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${error ? 'text-red-400' : 'text-jarvis-success'}`}>
                        {error ? '⚠ Error' : '✓ Output'}
                      </span>
                      <span className="text-[10px] text-jarvis-muted">{language}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleCopy} className="text-jarvis-muted hover:text-jarvis-cyan transition-colors" title="Copy output">
                        {copied ? <CheckCircle size={14} className="text-jarvis-success" /> : <Copy size={14} />}
                      </button>
                      <button onClick={() => { setOutput(''); setError(''); }} className="text-jarvis-muted hover:text-jarvis-error transition-colors" title="Clear output">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <pre ref={outputRef} className="bg-jarvis-bg p-4 text-sm font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {error && <span className="text-red-400">{error}</span>}
                    {error && output && '\n'}
                    {output && <span className="text-jarvis-text">{output}</span>}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-jarvis-border bg-jarvis-surface/30">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${langConfig.color}`}>{langConfig.label}</span>
            <span className="text-[10px] text-jarvis-muted">•</span>
            <span className="text-[10px] text-jarvis-muted">{code.split('\n').length} lines</span>
            <span className="text-[10px] text-jarvis-muted">•</span>
            <span className="text-[10px] text-jarvis-muted">Ctrl+Enter to run</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg text-xs text-jarvis-muted hover:text-jarvis-text hover:bg-jarvis-border transition-colors border border-jarvis-border"
            >
              Clear
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRun}
              disabled={!code.trim() || isRunning}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                code.trim() && !isRunning
                  ? 'bg-jarvis-cyan/20 text-jarvis-cyan border border-jarvis-cyan/30 hover:bg-jarvis-cyan/30'
                  : 'bg-jarvis-border text-jarvis-muted border border-jarvis-border cursor-not-allowed'
              }`}
            >
              {isRunning ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Terminal size={14} />
                </motion.div>
              ) : (
                <Play size={14} />
              )}
              {isRunning ? 'Running...' : 'Run'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
