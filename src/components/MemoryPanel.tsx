import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  Clock,
  Tag,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { MemoryEntry } from '../types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const categories = ['Personal', 'Work', 'Study', 'Health', 'Finance', 'General'];

export default function MemoryPanel() {
  const { memories, addMemory, updateMemory, deleteMemory } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [editContent, setEditContent] = useState('');

  const filteredMemories = memories.filter(
    (m) =>
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleAdd() {
    if (!newContent.trim()) return;
    const entry: MemoryEntry = {
      id: generateId(),
      content: newContent.trim(),
      category: newCategory,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addMemory(entry);
    setNewContent('');
    setNewCategory('General');
    setIsAdding(false);
  }

  function handleEdit(id: string) {
    if (!editContent.trim()) return;
    updateMemory(id, editContent.trim());
    setEditingId(null);
    setEditContent('');
  }

  const categoryColors: Record<string, string> = {
    Personal: 'bg-jarvis-cyan/10 text-jarvis-cyan border-jarvis-cyan/20',
    Work: 'bg-jarvis-violet/10 text-jarvis-violet border-jarvis-violet/20',
    Study: 'bg-jarvis-success/10 text-jarvis-success border-jarvis-success/20',
    Health: 'bg-green-500/10 text-green-400 border-green-500/20',
    Finance: 'bg-jarvis-warning/10 text-jarvis-warning border-jarvis-warning/20',
    General: 'bg-jarvis-muted/10 text-jarvis-muted border-jarvis-muted/20',
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-jarvis-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-jarvis-violet" />
            <h2 className="font-heading font-semibold text-jarvis-text">Long-Term Memory</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-jarvis-muted bg-jarvis-bg px-2 py-0.5 rounded-full">
              {memories.length} entries
            </span>
            <button onClick={() => setIsAdding(true)} className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5">
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg pl-9 pr-3 py-2 text-sm
              text-jarvis-text placeholder:text-jarvis-muted/50
              focus:outline-none focus:border-jarvis-violet/40 transition-colors"
          />
        </div>
      </div>

      {/* Add new memory form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 border-b border-jarvis-border bg-jarvis-violet/5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-jarvis-text">New Memory</span>
              <button onClick={() => { setIsAdding(false); setNewContent(''); }} className="btn-icon !w-7 !h-7">
                <X size={14} />
              </button>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Remember that I have exams next week..."
              className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm
                text-jarvis-text placeholder:text-jarvis-muted/50 mb-3
                focus:outline-none focus:border-jarvis-violet/40 transition-colors resize-none"
              rows={3}
            />
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} className="text-jarvis-muted" />
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    className={`text-[10px] px-2 py-1 rounded-md border transition-colors
                      ${newCategory === cat
                        ? categoryColors[cat] || categoryColors.General
                        : 'border-jarvis-border text-jarvis-muted hover:text-jarvis-text'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAdd} disabled={!newContent.trim()} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
              <Save size={14} />
              Save to Memory
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredMemories.length === 0 && !isAdding && (
          <div className="text-center py-10">
            <Brain size={40} className="text-jarvis-violet/30 mx-auto mb-3" />
            <p className="text-sm text-jarvis-muted">No memories stored yet</p>
            <p className="text-xs text-jarvis-muted/60 mt-1">
              Say "remember that..." or add memories manually
            </p>
          </div>
        )}

        {filteredMemories.map((memory) => (
          <motion.div
            key={memory.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="surface-card p-4 group"
          >
            {editingId === memory.id ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm
                    text-jarvis-text mb-2 focus:outline-none focus:border-jarvis-violet/40 transition-colors resize-none"
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(memory.id)} className="btn-primary !py-1 !px-3 text-xs">
                    Save
                  </button>
                  <button onClick={() => { setEditingId(null); setEditContent(''); }} className="btn-secondary !py-1 !px-3 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-jarvis-text mb-2">{memory.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md border ${categoryColors[memory.category] || categoryColors.General}`}>
                      {memory.category}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-jarvis-muted">
                      <Clock size={10} />
                      {formatDate(memory.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(memory.id);
                        setEditContent(memory.content);
                      }}
                      className="btn-icon !w-7 !h-7"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => deleteMemory(memory.id)}
                      className="btn-icon !w-7 !h-7 hover:!text-jarvis-error"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
