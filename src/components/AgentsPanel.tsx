import { motion } from 'framer-motion';
import { Bot, Plus, Zap, FileText, Search, Brain, Globe, Code } from 'lucide-react';

const agents = [
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Deep web research with source synthesis and citation',
    icon: Search,
    color: 'text-jarvis-cyan',
    bg: 'bg-jarvis-cyan/10',
    border: 'border-jarvis-cyan/20',
    capabilities: ['Web Search', 'Source Analysis', 'Summary Generation'],
  },
  {
    id: 'coder',
    name: 'Code Agent',
    description: 'Write, review, and debug code in any language',
    icon: Code,
    color: 'text-jarvis-violet',
    bg: 'bg-jarvis-violet/10',
    border: 'border-jarvis-violet/20',
    capabilities: ['Code Generation', 'Debugging', 'Code Review'],
  },
  {
    id: 'analyst',
    name: 'Document Analyst',
    description: 'Extract insights from documents and data files',
    icon: FileText,
    color: 'text-jarvis-success',
    bg: 'bg-jarvis-success/10',
    border: 'border-jarvis-success/20',
    capabilities: ['PDF Parsing', 'Data Extraction', 'Insight Summary'],
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    description: 'Manage and retrieve your long-term knowledge',
    icon: Brain,
    color: 'text-jarvis-warning',
    bg: 'bg-jarvis-warning/10',
    border: 'border-jarvis-warning/20',
    capabilities: ['Memory Storage', 'Context Retrieval', 'Fact Checking'],
  },
];

export default function AgentsPanel() {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-jarvis-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-jarvis-cyan" />
            <h2 className="font-heading font-semibold text-jarvis-text">AI Agents</h2>
          </div>
          <span className="text-xs text-jarvis-muted bg-jarvis-bg px-2 py-0.5 rounded-full">
            {agents.length} available
          </span>
        </div>
        <p className="text-sm text-jarvis-muted mt-2">
          Specialized AI agents for different tasks. Each agent has tailored capabilities and tools.
        </p>
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          {agents.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -2 }}
                className={`${agent.bg} border ${agent.border} rounded-xl p-5 cursor-pointer transition-all group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg ${agent.bg} flex items-center justify-center`}>
                    <Icon size={20} className={agent.color} />
                  </div>
                  <Zap size={14} className={`${agent.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
                <h3 className="font-heading font-semibold text-jarvis-text mb-1">{agent.name}</h3>
                <p className="text-xs text-jarvis-muted mb-3">{agent.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="text-[10px] bg-jarvis-bg/50 text-jarvis-muted px-2 py-0.5 rounded-md">
                      {cap}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Custom agent placeholder */}
        <motion.button
          whileHover={{ y: -2 }}
          className="w-full mt-4 border border-dashed border-jarvis-border rounded-xl p-6
            flex flex-col items-center justify-center gap-2 text-jarvis-muted hover:text-jarvis-text hover:border-jarvis-cyan/30 transition-colors cursor-pointer"
        >
          <Plus size={24} />
          <span className="text-sm font-medium">Create Custom Agent</span>
          <span className="text-xs opacity-60">Define tools, prompts, and capabilities</span>
        </motion.button>
      </div>
    </div>
  );
}
