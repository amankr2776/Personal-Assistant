import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, Trash2, CheckCircle, Clock, BellOff } from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { Reminder } from '../types';

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff < 0) return 'Overdue';
  if (diff < 60000) return '<1 min';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  return `${Math.floor(diff / 86400000)}d`;
}

export default function RemindersPanel() {
  const { reminders, addReminder, deleteReminder, markReminderDone } = useStore();
  const [input, setInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [firingIds, setFiringIds] = useState<Set<string>>(new Set());
  const checkRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const state = useStore.getState();
      for (const r of state.reminders) {
        if (r.isDone || firingIds.has(r.id)) continue;
        if (r.time <= now) {
          setFiringIds(prev => new Set(prev).add(r.id));
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏰ AIRA Reminder', { body: r.text });
          }
          setTimeout(() => {
            useStore.getState().markReminderDone(r.id);
            setFiringIds(prev => { const s = new Set(prev); s.delete(r.id); return s; });
          }, 8000);
        }
      }
    };
    check();
    checkRef.current = setInterval(check, 15000);
    return () => { if (checkRef.current) clearInterval(checkRef.current); };
  }, [firingIds]);

  function requestNotif() {
    if ('Notification' in window) Notification.requestPermission().then(p => setNotifPerm(p));
  }

  function parseTimeInput(timeStr: string): number | null {
    if (!timeStr) return null;
    const now = new Date();
    const lower = timeStr.toLowerCase().trim();

    const inMatch = lower.match(/^in\s+(\d+)\s*(min|minute|hr|hour)/i);
    if (inMatch) {
      const num = parseInt(inMatch[1]);
      const ms = inMatch[2].startsWith('hr') ? num * 3600000 : num * 60000;
      return Date.now() + ms;
    }

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const mins = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      const target = new Date(now);
      target.setHours(hours, mins, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      return target.getTime();
    }

    const parsed = Date.parse(timeStr);
    return isNaN(parsed) ? null : parsed;
  }

  function handleAdd() {
    if (!input.trim()) return;
    const time = parseTimeInput(timeInput);
    addReminder({
      id: generateId(),
      text: input.trim(),
      time: time || Date.now() + 3600000,
      isRepeating: false,
      isDone: false,
      createdAt: Date.now(),
    });
    setInput('');
    setTimeInput('');
  }

  const pending = reminders.filter(r => !r.isDone).sort((a, b) => a.time - b.time);
  const done = reminders.filter(r => r.isDone).slice(0, 10);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-jarvis-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-jarvis-violet/20 flex items-center justify-center">
              <Bell size={16} className="text-jarvis-violet" />
            </div>
            <h2 className="font-heading font-semibold text-jarvis-text">Reminders</h2>
            {pending.length > 0 && (
              <span className="text-[10px] bg-jarvis-violet/20 text-jarvis-violet px-2 py-0.5 rounded-full">{pending.length}</span>
            )}
          </div>
          {notifPerm !== 'granted' && (
            <button onClick={requestNotif} className="text-[10px] text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-1">
              <BellOff size={12} /> Enable notifications
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="What to remind?" className="flex-1 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-violet/40" />
          <input value={timeInput} onChange={e => setTimeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="5pm / in 30min" className="w-32 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-violet/40" />
          <button onClick={handleAdd} disabled={!input.trim()} className="btn-icon text-jarvis-violet hover:bg-jarvis-violet/10 disabled:opacity-30">
            <Plus size={18} />
          </button>
        </div>
        <p className="text-[10px] text-jarvis-muted/50 mt-1">Time: "5pm", "17:30", "in 30min", "in 2hr", "9am"</p>
      </div>

      <AnimatePresence>
        {reminders.filter(r => firingIds.has(r.id)).map(r => (
          <motion.div key={r.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-2 bg-jarvis-violet/10 border border-jarvis-violet/30 rounded-xl px-4 py-3 flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
              <Bell size={20} className="text-jarvis-violet" />
            </motion.div>
            <div className="flex-1"><p className="text-sm text-jarvis-text font-medium">⏰ {r.text}</p></div>
            <button onClick={() => { markReminderDone(r.id); setFiringIds(prev => { const s = new Set(prev); s.delete(r.id); return s; }); }} className="btn-icon text-jarvis-success"><CheckCircle size={16} /></button>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {pending.length === 0 && done.length === 0 && (
          <div className="text-center py-12">
            <Bell size={40} className="text-jarvis-violet/20 mx-auto mb-3" />
            <p className="text-sm text-jarvis-muted">No reminders yet</p>
            <p className="text-xs text-jarvis-muted/60 mt-1">"remind me at 5pm to call home"</p>
          </div>
        )}
        {pending.map(r => (
          <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="surface-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-jarvis-violet/10 flex items-center justify-center flex-shrink-0">
              <Clock size={14} className="text-jarvis-violet" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-jarvis-text truncate">{r.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-jarvis-cyan">{formatTime(r.time)}</span>
                <span className="text-[10px] text-jarvis-muted">• {timeUntil(r.time)}</span>
              </div>
            </div>
            <button onClick={() => markReminderDone(r.id)} className="btn-icon text-jarvis-success/50 hover:text-jarvis-success"><CheckCircle size={14} /></button>
            <button onClick={() => deleteReminder(r.id)} className="btn-icon text-jarvis-muted hover:text-jarvis-error"><Trash2 size={14} /></button>
          </motion.div>
        ))}
        {done.length > 0 && (
          <div className="pt-4 mt-4 border-t border-jarvis-border/50">
            <p className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-2">Completed</p>
            {done.map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 opacity-50">
                <CheckCircle size={12} className="text-jarvis-success flex-shrink-0" />
                <span className="text-xs text-jarvis-text line-through truncate">{r.text}</span>
                <button onClick={() => deleteReminder(r.id)} className="ml-auto text-jarvis-muted hover:text-jarvis-error"><Trash2 size={10} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
