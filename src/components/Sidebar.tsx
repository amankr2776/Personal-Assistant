import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  MessageSquare,
  FolderOpen,
  Brain,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { ActivePanel } from '../types';

const navItems: Array<{ id: ActivePanel; icon: typeof Home; label: string }> = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'vault', icon: FolderOpen, label: 'Vault' },
  { id: 'memory', icon: Brain, label: 'Memory' },
  { id: 'agents', icon: Bot, label: 'Agents' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const {
    activePanel,
    sidebarCollapsed,
    setActivePanel,
    toggleSidebar,
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    deleteSession,
  } = useStore();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full bg-jarvis-surface border-r border-jarvis-border flex flex-col relative z-10"
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-jarvis-border">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-jarvis-cyan/20 flex items-center justify-center">
                <span className="text-jarvis-cyan font-heading font-bold text-sm">J</span>
              </div>
              <span className="font-heading font-bold text-jarvis-text tracking-wider">JARVIS</span>
            </motion.div>
          )}
        </AnimatePresence>
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-jarvis-cyan/20 flex items-center justify-center mx-auto">
            <span className="text-jarvis-cyan font-heading font-bold text-sm">J</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 group
                ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                ${isActive ? 'bg-jarvis-cyan/10 text-jarvis-cyan' : 'text-jarvis-muted hover:bg-jarvis-border hover:text-jarvis-text'}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon size={20} className={isActive ? 'text-jarvis-cyan' : ''} />
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !sidebarCollapsed && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 w-1 h-6 bg-jarvis-cyan rounded-r-full"
                />
              )}
            </button>
          );
        })}

        {/* Chat History (when chat is active) */}
        {activePanel === 'chat' && !sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-4"
          >
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-medium text-jarvis-muted uppercase tracking-wider">History</span>
              <button onClick={createSession} className="btn-icon !w-6 !h-6">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sessions.slice(0, 10).map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session.id);
                    setActivePanel('chat');
                  }}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs
                    ${activeSessionId === session.id ? 'bg-jarvis-cyan/10 text-jarvis-cyan' : 'text-jarvis-muted hover:bg-jarvis-border'}`}
                >
                  <MessageSquare size={12} />
                  <span className="truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="h-10 flex items-center justify-center border-t border-jarvis-border text-jarvis-muted hover:text-jarvis-text hover:bg-jarvis-border transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
