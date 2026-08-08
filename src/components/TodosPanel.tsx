import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Square, Plus, Trash2, AlertTriangle, Clock, Tag } from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { TodoItem } from '../types';

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }

const PRIORITIES = ['low', 'medium', 'high'] as const;
const CATEGORIES = ['General', 'Study', 'Project', 'Personal', 'Work', 'Exam', 'Health'];
const PRIORITY_COLORS = { low: 'text-jarvis-success', medium: 'text-jarvis-warning', high: 'text-jarvis-error' };

export default function TodosPanel() {
  const { todos, addTodo, deleteTodo, toggleTodo } = useStore();
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('General');

  function handleAdd() {
    if (!input.trim()) return;
    addTodo({
      id: generateId(),
      text: input.trim(),
      done: false,
      priority,
      category,
      createdAt: Date.now(),
    });
    setInput('');
  }

  const incomplete = todos.filter(t => !t.done).sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });
  const completed = todos.filter(t => t.done).slice(0, 10);
  const progress = todos.length > 0 ? Math.round((completed.length / todos.length) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-jarvis-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-jarvis-success/20 flex items-center justify-center">
              <CheckSquare size={16} className="text-jarvis-success" />
            </div>
            <h2 className="font-heading font-semibold text-jarvis-text">Tasks</h2>
            {incomplete.length > 0 && (
              <span className="text-[10px] bg-jarvis-success/20 text-jarvis-success px-2 py-0.5 rounded-full">{incomplete.length}</span>
            )}
          </div>
          {todos.length > 0 && (
            <span className="text-[10px] text-jarvis-muted">{progress}% done</span>
          )}
        </div>

        {/* Progress bar */}
        {todos.length > 0 && (
          <div className="w-full h-1.5 bg-jarvis-bg rounded-full mb-3 overflow-hidden">
            <motion.div className="h-full bg-jarvis-success rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
        )}

        {/* Add todo */}
        <div className="flex gap-2 mb-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add a task..." className="flex-1 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-success/40" />
          <button onClick={handleAdd} disabled={!input.trim()} className="btn-icon text-jarvis-success hover:bg-jarvis-success/10 disabled:opacity-30"><Plus size={18} /></button>
        </div>
        <div className="flex gap-2">
          <select value={priority} onChange={e => setPriority(e.target.value as any)} className="bg-jarvis-bg border border-jarvis-border rounded-lg px-2 py-1 text-xs text-jarvis-text focus:outline-none">
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢'} {p}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} className="bg-jarvis-bg border border-jarvis-border rounded-lg px-2 py-1 text-xs text-jarvis-text focus:outline-none">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {incomplete.length === 0 && completed.length === 0 && (
          <div className="text-center py-12">
            <CheckSquare size={40} className="text-jarvis-success/20 mx-auto mb-3" />
            <p className="text-sm text-jarvis-muted">No tasks yet</p>
            <p className="text-xs text-jarvis-muted/60 mt-1">"add todo: complete assignment"</p>
          </div>
        )}
        {incomplete.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="surface-card p-3 flex items-center gap-3">
            <button onClick={() => toggleTodo(t.id)} className="flex-shrink-0">
              <Square size={18} className="text-jarvis-muted hover:text-jarvis-success transition-colors" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-jarvis-text truncate">{t.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                <span className="text-[10px] text-jarvis-muted">• {t.category}</span>
              </div>
            </div>
            <button onClick={() => deleteTodo(t.id)} className="btn-icon text-jarvis-muted hover:text-jarvis-error"><Trash2 size={14} /></button>
          </motion.div>
        ))}
        {completed.length > 0 && (
          <div className="pt-4 mt-4 border-t border-jarvis-border/50">
            <p className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-2">Done ({completed.length})</p>
            {completed.map(t => (
              <div key={t.id} className="flex items-center gap-2 py-1.5 opacity-50">
                <button onClick={() => toggleTodo(t.id)} className="flex-shrink-0"><CheckSquare size={14} className="text-jarvis-success" /></button>
                <span className="text-xs text-jarvis-text line-through truncate">{t.text}</span>
                <button onClick={() => deleteTodo(t.id)} className="ml-auto text-jarvis-muted hover:text-jarvis-error"><Trash2 size={10} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
