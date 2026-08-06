import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  Paperclip,
  Bot,
  User,
  Globe,
  FileText,
  X,
  Volume2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../stores/useStore';
import { api } from '../services/api';
import type { Message, Source, AttachedFile } from '../types';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${isUser ? 'bg-jarvis-violet/20' : 'bg-jarvis-cyan/20'}`}
      >
        {isUser ? (
          <User size={16} className="text-jarvis-violet" />
        ) : (
          <Bot size={16} className="text-jarvis-cyan" />
        )}
      </div>

      {/* Content */}
      <div
        className={`max-w-[75%] ${isUser ? 'text-right' : 'text-left'}`}
      >
        <div
          className={`rounded-xl px-4 py-3 ${
            isUser
              ? 'bg-jarvis-violet/10 border border-jarvis-violet/20'
              : 'bg-jarvis-surface border border-jarvis-border'
          }`}
        >
          {isUser ? (
            <p className="text-sm text-jarvis-text whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown-content text-sm">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    return !isInline ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="!bg-jarvis-bg !border-jarvis-border !rounded-lg !text-xs"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.sources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2
                  hover:border-jarvis-cyan/30 transition-colors group"
              >
                <Globe size={12} className="text-jarvis-cyan" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-jarvis-text truncate group-hover:text-jarvis-cyan transition-colors">
                    {source.title}
                  </p>
                  <p className="text-[10px] text-jarvis-muted truncate">{source.snippet}</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Timestamp + Speak button */}
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <p className="text-[10px] text-jarvis-muted">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {!isUser && message.content && (
            <button
              onClick={() => api.speak(message.content)}
              className="text-[10px] text-jarvis-muted hover:text-jarvis-cyan flex items-center gap-0.5 transition-colors"
            >
              <Volume2 size={10} />
              Speak
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    sessions,
    activeSessionId,
    createSession,
    addMessage,
    isStreaming,
    streamingContent,
    setStreaming,
    setStreamingContent,
    updateLastAssistantMessage,
    aiMode,
    activeModel,
    networkStatus,
    memories,
  } = useStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
    };

    addMessage(sessionId, userMessage);
    setInput('');
    setAttachedFiles([]);

    // Assistant message placeholder
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(sessionId, assistantMessage);

    // All local — always use Ollama
    const useCloud = false;
    const model = activeModel || 'tinyllama';

    // Stream response
    setStreaming(true);
    setStreamingContent('');
    let fullContent = '';

    // Always inject all memories so AI knows the user personally
    const memoryContext = memories.map((m) => `${m.category}: ${m.content}`);

    try {
      for await (const chunk of api.streamChat({
        message: text,
        model,
        mode: useCloud ? 'cloud' : 'local',
        memories: memoryContext,
        temperature: 0.7,
        max_tokens: 4096,
      })) {
        fullContent += chunk;
        setStreamingContent(fullContent);
        updateLastAssistantMessage(sessionId, fullContent);
      }
    } catch (error) {
      fullContent += '\n\n⚠️ Connection error. Please check your backend or try again.';
      updateLastAssistantMessage(sessionId, fullContent);
    }

    setStreaming(false);
    setStreamingContent('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = Array.from(files).map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
    }));

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  }

  // Voice input — real browser SpeechRecognition
  function toggleMic() {
    if (micActive) {
      setMicActive(false);
      return;
    }

    setMicActive(true);

    const stop = api.startListening(
      (text, isFinal) => {
        setInput(text);
        if (isFinal) {
          setMicActive(false);
        }
      },
      (error) => {
        setMicActive(false);
        // Fallback: just set a placeholder
        setInput((prev) => prev || 'Voice input — type your message instead');
      },
    );

    if (!stop) {
      // SpeechRecognition not available
      setMicActive(false);
      setTimeout(() => {
        setInput((prev) => prev || 'Voice requires Chrome/Edge. Type your message instead.');
      }, 100);
    } else {
      // Auto-stop after 10s
      setTimeout(() => {
        stop();
        setMicActive(false);
      }, 10000);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Empty state */}
      {!activeSession && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <Bot size={48} className="text-jarvis-cyan/30 mx-auto mb-4" />
            <p className="text-jarvis-text text-lg font-heading font-semibold">Start a conversation</p>
            <p className="text-jarvis-muted text-sm mt-1 mb-4">Type a message or use voice input</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => { setInput('What can you do?'); }} className="text-xs bg-jarvis-cyan/10 text-jarvis-cyan border border-jarvis-cyan/20 rounded-lg px-3 py-1.5 hover:bg-jarvis-cyan/20 transition-colors">
                What can you do?
              </button>
              <button onClick={() => { setInput('Write a Python function to sort a list'); }} className="text-xs bg-jarvis-violet/10 text-jarvis-violet border border-jarvis-violet/20 rounded-lg px-3 py-1.5 hover:bg-jarvis-violet/20 transition-colors">
                Write code
              </button>
              <button onClick={() => { setInput('Explain how transformers work in AI'); }} className="text-xs bg-jarvis-success/10 text-jarvis-success border border-jarvis-success/20 rounded-lg px-3 py-1.5 hover:bg-jarvis-success/20 transition-colors">
                Explain AI
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Messages */}
      {activeSession && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex items-center gap-2 px-4">
              <motion.div
                className="w-2 h-2 rounded-full bg-jarvis-cyan"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-xs text-jarvis-muted">Generating...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-jarvis-border p-4">
        {/* Attached files preview */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {attachedFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5"
                >
                  <FileText size={14} className="text-jarvis-cyan" />
                  <span className="text-xs text-jarvis-text">{file.name}</span>
                  <button
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-jarvis-muted hover:text-jarvis-error transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          {/* File attach */}
          <button onClick={() => fileInputRef.current?.click()} className="btn-icon">
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileAttach}
            className="hidden"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask JARVIS anything..."
              rows={1}
              className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl px-4 py-3 pr-12
                text-sm text-jarvis-text placeholder:text-jarvis-muted/50
                focus:outline-none focus:border-jarvis-cyan/40 focus:ring-1 focus:ring-jarvis-cyan/20
                resize-none max-h-32 transition-colors"
              style={{ minHeight: '44px' }}
            />
          </div>

          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            className={`btn-icon ${micActive ? 'text-jarvis-cyan bg-jarvis-cyan/10' : ''}`}
          >
            {micActive ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={`btn-icon ${input.trim() && !isStreaming ? 'text-jarvis-cyan hover:bg-jarvis-cyan/10' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
