import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  Search,
  Tag,
  Calendar,
  Hash,
  ChevronRight,
  X,
  File,
  AlertCircle,
  CheckCircle,
  Image,
  Eye,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { api } from '../services/api';
import type { VaultDocument } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const fileTypeColors: Record<string, string> = {
  pdf: 'text-red-400',
  docx: 'text-blue-400',
  txt: 'text-jarvis-cyan',
  png: 'text-green-400',
  jpg: 'text-green-400',
  jpeg: 'text-green-400',
  py: 'text-yellow-400',
  js: 'text-yellow-400',
  ts: 'text-blue-400',
  json: 'text-jarvis-cyan',
  csv: 'text-green-400',
  md: 'text-jarvis-cyan',
};

export default function VaultPanel() {
  const { documents, addDocument, deleteDocument } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<VaultDocument | null>(null);
  const [vaultQuery, setVaultQuery] = useState('');
  const [vaultAnswer, setVaultAnswer] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    setUploadStatus('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatus(`Processing ${file.name}...`);

      try {
        const result = await api.uploadDocument(file);
        const doc: VaultDocument = {
          id: result.id,
          filename: file.name,
          fileType: file.name.split('.').pop() || 'unknown',
          size: file.size,
          tags: [file.name.split('.').pop() || 'document'],
          chunkCount: result.chunks,
          uploadedAt: Date.now(),
          summary: result.summary,
          content: result.content,
          imageData: result.imageData,
        };
        addDocument(doc);
        setUploadStatus(`✅ ${file.name} uploaded successfully`);
      } catch (err) {
        // Upload failed — error handled by UI state
        setUploadStatus(`❌ Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    setTimeout(() => setUploadStatus(''), 3000);
    e.target.value = '';
  }

  async function handleVaultQuery() {
    if (!vaultQuery.trim() || documents.length === 0) return;
    setIsQuerying(true);
    setVaultAnswer('');

    // Pass all documents to the API for context-aware querying
    const docData = documents.map(d => ({
      filename: d.filename,
      content: d.content,
      imageData: d.imageData,
      summary: d.summary,
    }));

    const result = await api.queryVault(vaultQuery, docData);
    setVaultAnswer(result.answer);
    setIsQuerying(false);
  }

  return (
    <div className="flex-1 flex h-full">
      {/* Document list */}
      <div className="w-80 border-r border-jarvis-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-jarvis-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="text-jarvis-cyan" />
              <h2 className="font-heading font-semibold text-jarvis-text">Knowledge Vault</h2>
            </div>
            <span className="text-xs text-jarvis-muted bg-jarvis-bg px-2 py-0.5 rounded-full">
              {documents.length} docs
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full bg-jarvis-bg border border-jarvis-border rounded-lg pl-9 pr-3 py-2 text-sm
                text-jarvis-text placeholder:text-jarvis-muted/50
                focus:outline-none focus:border-jarvis-cyan/40 transition-colors"
            />
          </div>
        </div>

        {/* Upload button */}
        <div className="p-4 border-b border-jarvis-border">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {isUploading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Upload size={16} />
              </motion.div>
            ) : (
              <Upload size={16} />
            )}
            {isUploading ? 'Processing...' : 'Upload Document'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.py,.js,.ts,.json,.csv,.md,.html,.css,.xml,.yaml,.yml"
          />
          <p className="text-[10px] text-jarvis-muted mt-2 text-center">
            Text, Code, Images, PDF, DOCX
          </p>
          {/* Upload status */}
          <AnimatePresence>
            {uploadStatus && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-2 text-[10px] px-2 py-1 rounded ${
                  uploadStatus.startsWith('✅') ? 'text-jarvis-success bg-jarvis-success/10' :
                  uploadStatus.startsWith('❌') ? 'text-red-400 bg-red-400/10' :
                  'text-jarvis-muted bg-jarvis-bg'
                }`}
              >
                {uploadStatus}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-10">
              <FileText size={32} className="text-jarvis-muted/30 mx-auto mb-3" />
              <p className="text-sm text-jarvis-muted">No documents yet</p>
              <p className="text-xs text-jarvis-muted/60 mt-1">Upload files to build your knowledge base</p>
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const ext = doc.fileType.toLowerCase();
              const isSelected = selectedDoc?.id === doc.id;
              const hasContent = !!(doc.content || doc.imageData);
              return (
                <motion.button
                  key={doc.id}
                  whileHover={{ x: 2 }}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left p-3 rounded-lg transition-colors group
                    ${isSelected ? 'bg-jarvis-cyan/10 border border-jarvis-cyan/20' : 'hover:bg-jarvis-border border border-transparent'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <FileText size={16} className={fileTypeColors[ext] || 'text-jarvis-muted'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-jarvis-text truncate font-medium">{doc.filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-jarvis-muted">{formatFileSize(doc.size)}</span>
                        <span className="text-[10px] text-jarvis-muted">•</span>
                        <span className="text-[10px] text-jarvis-muted">{doc.chunkCount} chunks</span>
                        {hasContent && (
                          <>
                            <span className="text-[10px] text-jarvis-muted">•</span>
                            <span className="text-[10px] text-jarvis-success">✓ indexed</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDocument(doc.id);
                        if (selectedDoc?.id === doc.id) setSelectedDoc(null);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-jarvis-muted hover:text-jarvis-error transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail / Query panel */}
      <div className="flex-1 flex flex-col p-6">
        {selectedDoc ? (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading font-semibold text-xl text-jarvis-text">{selectedDoc.filename}</h3>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs text-jarvis-muted">
                    <Tag size={12} />
                    {selectedDoc.tags.join(', ')}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-jarvis-muted">
                    <Calendar size={12} />
                    {formatDate(selectedDoc.uploadedAt)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-jarvis-muted">
                    <Hash size={12} />
                    {selectedDoc.chunkCount} chunks
                  </div>
                  {(selectedDoc.content || selectedDoc.imageData) && (
                    <div className="flex items-center gap-1 text-xs text-jarvis-success">
                      <CheckCircle size={12} />
                      Indexed
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            {selectedDoc.summary && (
              <div className="surface-card p-4">
                <h4 className="text-xs font-medium text-jarvis-muted uppercase tracking-wider mb-2">AI Summary</h4>
                <p className="text-sm text-jarvis-text">{selectedDoc.summary}</p>
              </div>
            )}

            {/* Image preview */}
            {selectedDoc.imageData && (
              <div className="surface-card p-4">
                <h4 className="text-xs font-medium text-jarvis-muted uppercase tracking-wider mb-2">Image Preview</h4>
                <img src={selectedDoc.imageData} alt={selectedDoc.filename} className="max-w-full max-h-64 rounded-lg border border-jarvis-border" />
              </div>
            )}

            {/* Document content */}
            {selectedDoc.content && (
              <div className="surface-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-jarvis-muted uppercase tracking-wider">Content</h4>
                  <button onClick={() => setShowContent(!showContent)} className="text-xs text-jarvis-cyan hover:text-jarvis-cyan/80 flex items-center gap-1">
                    <Eye size={12} />
                    {showContent ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showContent && (
                  <pre className="text-xs text-jarvis-text bg-jarvis-bg rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                    {selectedDoc.content.slice(0, 5000)}
                    {selectedDoc.content.length > 5000 && '\n\n... (truncated)'}
                  </pre>
                )}
                {!showContent && (
                  <p className="text-xs text-jarvis-muted">
                    {selectedDoc.content.split('\n').length} lines, {selectedDoc.content.split(/\s+/).length} words
                  </p>
                )}
              </div>
            )}

            {/* Ask about this document */}
            <div className="surface-card p-4">
              <h4 className="text-xs font-medium text-jarvis-muted uppercase tracking-wider mb-3">Ask about this document</h4>
              <div className="flex gap-2">
                <input
                  value={vaultQuery}
                  onChange={(e) => setVaultQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVaultQuery()}
                  placeholder="What is this document about?"
                  className="flex-1 bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-2 text-sm
                    text-jarvis-text placeholder:text-jarvis-muted/50
                    focus:outline-none focus:border-jarvis-cyan/40 transition-colors"
                />
                <button
                  onClick={handleVaultQuery}
                  disabled={!vaultQuery.trim() || isQuerying}
                  className="btn-primary text-xs px-4"
                >
                  {isQuerying ? '...' : 'Ask'}
                </button>
              </div>
              {isQuerying && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-2">
                  <motion.div className="w-2 h-2 rounded-full bg-jarvis-cyan" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  <span className="text-xs text-jarvis-muted">Searching document...</span>
                </motion.div>
              )}
              {vaultAnswer && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 bg-jarvis-bg border border-jarvis-cyan/20 rounded-lg p-3">
                  <p className="text-sm text-jarvis-text">{vaultAnswer}</p>
                </motion.div>
              )}
            </div>

            <div className="surface-card p-4">
              <h4 className="text-xs font-medium text-jarvis-muted uppercase tracking-wider mb-2">Metadata</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-jarvis-muted">File Type</span>
                  <p className="text-sm text-jarvis-text font-mono">{selectedDoc.fileType.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-xs text-jarvis-muted">File Size</span>
                  <p className="text-sm text-jarvis-text font-mono">{formatFileSize(selectedDoc.size)}</p>
                </div>
                <div>
                  <span className="text-xs text-jarvis-muted">Chunks</span>
                  <p className="text-sm text-jarvis-text font-mono">{selectedDoc.chunkCount}</p>
                </div>
                <div>
                  <span className="text-xs text-jarvis-muted">Uploaded</span>
                  <p className="text-sm text-jarvis-text font-mono">{formatDate(selectedDoc.uploadedAt)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-lg">
              <div className="text-center mb-8">
                <FolderOpen size={40} className="text-jarvis-cyan/30 mx-auto mb-3" />
                <h3 className="font-heading font-semibold text-lg text-jarvis-text">Knowledge Vault</h3>
                <p className="text-sm text-jarvis-muted mt-1">Upload PDFs, DOCX, images, or text files. Ask questions about your documents.</p>
                <p className="text-xs text-jarvis-muted/60 mt-2">Upload a file → JARVIS reads it → Ask any question about it</p>
              </div>

              {/* Query all documents */}
              {documents.length > 0 && (
                <div className="mb-6">
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-jarvis-muted" />
                    <input
                      value={vaultQuery}
                      onChange={(e) => setVaultQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVaultQuery()}
                      placeholder="Ask about your documents..."
                      className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl pl-11 pr-4 py-3 text-sm
                        text-jarvis-text placeholder:text-jarvis-muted/50
                        focus:outline-none focus:border-jarvis-cyan/40 transition-colors"
                    />
                  </div>

                  {isQuerying && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2">
                      <motion.div className="w-2 h-2 rounded-full bg-jarvis-cyan" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                      <span className="text-sm text-jarvis-muted">Searching vault...</span>
                    </motion.div>
                  )}

                  {vaultAnswer && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 surface-card p-4">
                      <p className="text-sm text-jarvis-text">{vaultAnswer}</p>
                    </motion.div>
                  )}
                </div>
              )}

              {documents.length === 0 && (
                <div className="mt-6 flex items-center gap-2 bg-jarvis-warning/10 border border-jarvis-warning/20 rounded-lg px-4 py-3">
                  <AlertCircle size={16} className="text-jarvis-warning" />
                  <p className="text-xs text-jarvis-warning">Upload documents first to enable semantic search</p>
                </div>
              )}

              {/* Supported formats */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="bg-jarvis-bg border border-jarvis-border rounded-lg p-3 text-center">
                  <FileText size={20} className="text-jarvis-cyan mx-auto mb-1" />
                  <p className="text-[10px] text-jarvis-muted">Text & Code</p>
                </div>
                <div className="bg-jarvis-bg border border-jarvis-border rounded-lg p-3 text-center">
                  <Image size={20} className="text-green-400 mx-auto mb-1" />
                  <p className="text-[10px] text-jarvis-muted">Images</p>
                </div>
                <div className="bg-jarvis-bg border border-jarvis-border rounded-lg p-3 text-center">
                  <File size={20} className="text-red-400 mx-auto mb-1" />
                  <p className="text-[10px] text-jarvis-muted">PDF & DOCX</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
