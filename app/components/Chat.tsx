'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, User, Loader2, Settings, Plus, MessageSquare,
  PanelLeft, Trash2, Globe, Brain, X, ChevronRight,
  CheckCircle, AlertCircle, Sparkles, BookOpen, ChevronDown,
  ImageIcon, Download, Film, Blend, ScanSearch, CircleOff,
  Layers, Sunset, PenTool, Wand2, SplitSquareVertical,
  ChevronLast, GripVertical, ThumbsUp, ThumbsDown, Copy, Check
} from 'lucide-react';
import { KiroAvatar, type KiroExpression } from './KiroMascot';
import ReactMarkdown from 'react-markdown';
import { IMAGE_TOOLS, processImage, type ImageToolId, type ImageTool } from '@/lib/imageProcessing';

/* ─── Types ─────────────────────────────────────────────── */
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  imageSrc?: string;
  imageToolId?: ImageToolId;
  /** For chained tools: ordered list of tool IDs to apply sequentially */
  toolChain?: ImageToolId[];
}

interface MemoryFact {
  id: string;
  text: string;
  createdAt: string;
}

interface BotConfig {
  name: string;
  description: string;
}

/* ─── Tool icon map ──────────────────────────────────────── */
const TOOL_ICONS: Record<string, React.ElementType> = {
  Film, Blend, ScanSearch, CircleOff, Sparkles,
  Layers, Sunset, PenTool,
};

const SECTIONS: Array<ImageTool['section']> = ['Basic', 'Filters', 'Detection'];

/* ═══════════════════════════════════════════════════════════
   IMAGE TOOL PICKER  — Claude.ai model-selector style
   ═══════════════════════════════════════════════════════════ */
function ImageToolPicker({
  selected,
  onSelect,
}: {
  selected: ImageTool | null;
  onSelect: (tool: ImageTool | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const SelIcon = selected ? (TOOL_ICONS[selected.icon] ?? Wand2) : Wand2;

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger pill ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
          transition-all duration-150 select-none
          ${selected
            ? 'bg-stone-900 border-stone-900 text-white shadow-sm'
            : 'bg-white/70 border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 hover:bg-white'
          }
        `}
      >
        <SelIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="max-w-[120px] truncate">{selected?.name ?? 'Vision Tools'}</span>

        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="
            absolute bottom-full mb-2.5 left-0 z-50
            w-[280px] rounded-2xl overflow-hidden
            bg-[#F2F0EC] border border-stone-200/70
            shadow-[0_8px_40px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)]
          "
          style={{ animation: 'dropUp 0.18s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <style>{`
            @keyframes dropUp {
              from { opacity: 0; transform: translateY(6px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0)  scale(1); }
            }
          `}</style>

          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200/60">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-stone-900 flex items-center justify-center">
                <Wand2 className="w-3 h-3 text-white" />
              </div>
              <span className="text-[13px] font-semibold text-stone-800 tracking-tight">Image Tools</span>
            </div>
            <div className="flex items-center gap-2">
              {selected && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(null); setOpen(false); }}
                  className="text-stone-400 hover:text-red-500 transition-colors p-0.5 rounded"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tool list */}
          <div className="max-h-[320px] overflow-y-auto py-1.5 no-scrollbar">
            {SECTIONS.map((section, si) => (
              <div key={section}>
                {si > 0 && <div className="h-px bg-stone-200/70 mx-3.5 my-1" />}
                <p className="px-4 pt-1.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-stone-400">
                  {section}
                </p>
                {IMAGE_TOOLS.filter(t => t.section === section).map(tool => {
                  const Icon = TOOL_ICONS[tool.icon] ?? Wand2;
                  const isActive = selected?.id === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => { onSelect(tool); setOpen(false); }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 mx-1 transition-all duration-100
                        rounded-xl text-left
                        ${isActive
                          ? 'bg-stone-900 text-white'
                          : 'hover:bg-stone-200/50 text-stone-700'}
                      `}
                      style={{ width: 'calc(100% - 8px)' }}
                    >
                      {/* Icon box */}
                      <div className={`
                        w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                        ${isActive ? 'bg-white/15' : 'bg-white border border-stone-200/80 shadow-sm'}
                      `}>
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-600'}`} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12.5px] font-semibold leading-tight ${isActive ? 'text-white' : 'text-stone-800'}`}>
                          {tool.name}
                        </p>
                        <p className={`text-[10.5px] truncate mt-0.5 ${isActive ? 'text-white/55' : 'text-stone-400'}`}>
                          {tool.description}
                        </p>
                      </div>

                      {/* Checkmark */}
                      {isActive && (
                        <CheckCircle className="w-3.5 h-3.5 text-white/75 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-stone-200/60">
            <p className="text-[10px] text-stone-400">
              Select a tool, then upload an image to process it
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BEFORE/AFTER SLIDER
   Drag the divider to reveal original vs processed side-by-side.
   ═══════════════════════════════════════════════════════════ */
function BeforeAfterSlider({ original, processed }: { original: string; processed: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pct, setPct]       = useState(50);   // 0–100
  const [width, setWidth]   = useState(0);
  const dragging            = useRef(false);

  function calcPct(clientX: number) {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const raw = ((clientX - left) / width) * 100;
    setPct(Math.min(98, Math.max(2, raw)));
  }

  const onMouseDown = (e: React.MouseEvent) => { dragging.current = true; e.preventDefault(); };
  useEffect(() => {
    const move = (e: MouseEvent)  => { if (dragging.current) calcPct(e.clientX); };
    const up   = ()               => { dragging.current = false; };
    const tmove = (e: TouchEvent) => { if (dragging.current) calcPct(e.touches[0].clientX); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    window.addEventListener('touchmove', tmove);
    window.addEventListener('touchend',  up);

    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      observer.observe(containerRef.current);
      return () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup',   up);
        window.removeEventListener('touchmove', tmove);
        window.removeEventListener('touchend',  up);
        observer.disconnect();
      };
    }

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup',   up);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend',  up);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl border border-stone-200/80 bg-stone-100 cursor-col-resize"
      style={{ userSelect: 'none' }}
    >
      {/* Processed (bottom layer — full width) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={processed} alt="processed" className="block w-full" draggable={false} />

      {/* Original (top layer — clipped to left side) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={original} alt="original" className="block" draggable={false}
          style={{ width: width || '100%', maxWidth: 'none' }}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      />

      {/* Handle */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={(e) => { dragging.current = true; e.preventDefault(); }}
        className="
          absolute top-1/2 -translate-y-1/2 -translate-x-1/2
          w-8 h-8 rounded-full bg-white shadow-lg border border-stone-200
          flex items-center justify-center cursor-col-resize
          hover:scale-110 transition-transform duration-150
        "
        style={{ left: `${pct}%` }}
      >
        <GripVertical className="w-4 h-4 text-stone-500" />
      </div>

      {/* Labels */}
      <span className="absolute top-2 left-2 text-[10px] font-semibold bg-black/40 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">Before</span>
      <span className="absolute top-2 right-2 text-[10px] font-semibold bg-black/40 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">After</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROCESSED IMAGE BUBBLE — with Before/After slider
   Supports single toolId OR toolChain (sequential processing).
   ═══════════════════════════════════════════════════════════ */
function ProcessedImageBubble({
  message,
  onReuseResult,
}: {
  message: Message;
  onReuseResult?: (dataUrl: string) => void;
}) {
  const [resultUrl, setResultUrl]   = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [error, setError]           = useState('');
  const [progress, setProgress]     = useState<string>('Loading…');
  const [viewMode, setViewMode]     = useState<'slider' | 'result'>('slider');

  // Resolve the chain — either a single tool or multiple
  const chain: ImageToolId[] = message.toolChain
    ? message.toolChain
    : message.imageToolId
      ? [message.imageToolId]
      : [];

  useEffect(() => {
    if (!message.imageSrc || chain.length === 0) return;
    let cancelled = false;
    setProcessing(true);
    setResultUrl(null);
    setError('');

    (async () => {
      let current = message.imageSrc!;
      for (let i = 0; i < chain.length; i++) {
        const tid  = chain[i];
        const tool = IMAGE_TOOLS.find(t => t.id === tid);
        if (!cancelled) setProgress(`Step ${i + 1}/${chain.length}: ${tool?.name ?? tid}…`);
        current = await processImage(tid, current);
        if (cancelled) return;
      }
      setResultUrl(current);
      setProgress('Done');
    })()
      .catch(e  => { if (!cancelled) setError(e?.message ?? String(e)); })
      .finally(() => { if (!cancelled) setProcessing(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  function download() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href     = resultUrl;
    a.download = `${chain.join('_') || 'processed'}.png`;
    a.click();
  }

  const firstTool = IMAGE_TOOLS.find(t => t.id === chain[0]);
  const Icon = firstTool ? (TOOL_ICONS[firstTool.icon] ?? Wand2) : Wand2;
  const label = chain.length > 1
    ? chain.map(id => IMAGE_TOOLS.find(t => t.id === id)?.name ?? id).join(' → ')
    : (firstTool?.name ?? 'Processing');

  return (
    <div className="space-y-2.5 min-w-[260px]">
      {/* Tool label + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium min-w-0">
          <Icon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
          <span className="truncate">{label} applied</span>
        </div>
        {!processing && resultUrl && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('slider')}
              title="Before/After slider"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'slider'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('result')}
              title="Result only"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'result'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <ChevronLast className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Image area */}
      <div className="relative rounded-xl overflow-hidden border border-stone-200/80 bg-stone-100">
        {/* Loading */}
        {processing && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-stone-200" />
              <div className="absolute inset-0 rounded-full border-2 border-stone-800 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="w-4 h-4 text-stone-600" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-stone-700">{progress}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Processing with OpenCV.js</p>
            </div>
            <div className="w-32 h-1 bg-stone-200 rounded-full overflow-hidden">
              <div className="h-full bg-stone-700 rounded-full"
                style={{ animation: 'shimmer 1.5s ease-in-out infinite', width: '60%' }} />
            </div>
          </div>
        )}
        {/* Error */}
        {!processing && error && (
          <div className="p-4 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-600">Processing failed</p>
              <p className="text-[11px] text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}
        {/* Slider view */}
        {!processing && resultUrl && viewMode === 'slider' && (
          <BeforeAfterSlider original={message.imageSrc!} processed={resultUrl} />
        )}
        {/* Result only */}
        {!processing && resultUrl && viewMode === 'result' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resultUrl} alt="processed" className="max-w-full block" />
        )}
      </div>

      {/* Actions */}
      {!processing && resultUrl && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={download}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download PNG
          </button>
          {onReuseResult && (
            <button onClick={() => onReuseResult(resultUrl)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Use as next input
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); width: 40%; }
          50%  { width: 70%; }
          100% { transform: translateX(200%); width: 40%; }
        }
      `}</style>
    </div>
  );
}

/* ─── Typing dots ────────────────────────────────────────── */
function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-stone-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

/* ─── Settings Modal ─────────────────────────────────────── */
function SettingsModal({
  open, onClose, botConfig, setBotConfig
}: {
  open: boolean;
  onClose: () => void;
  botConfig: BotConfig;
  setBotConfig: (c: BotConfig) => void;
}) {
  const [tab, setTab] = useState<'general' | 'memory' | 'website'>('general');
  const [localName, setLocalName] = useState(botConfig.name);
  const [localDesc, setLocalDesc] = useState(botConfig.description);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [newFact, setNewFact] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteStatus, setWebsiteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [websiteMsg, setWebsiteMsg] = useState('');
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [savingFact, setSavingFact] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [indexedSites, setIndexedSites] = useState<Array<{ domain: string; url: string; chunks: number }>>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'memory'  && open) fetchFacts();
    if (tab === 'website' && open) fetchSites();
  }, [tab, open]);

  async function fetchFacts() {
    setLoadingFacts(true);
    try {
      const res = await fetch('/api/memory');
      if (res.ok) { const d = await res.json(); setFacts(d.facts || []); }
    } catch { /* silent */ }
    setLoadingFacts(false);
  }

  async function addFact() {
    if (!newFact.trim()) return;
    setSavingFact(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact: newFact.trim(), userId: 'default-user' }),
      });
      if (res.ok) {
        const d = await res.json();
        setFacts(prev => [d.fact, ...prev]);
        setNewFact('');
        setSaveMsg('Saved to memory!');
        setTimeout(() => setSaveMsg(''), 2000);
      }
    } catch { /* silent */ }
    setSavingFact(false);
  }

  async function deleteFact(id: string) {
    try {
      await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factId: id, userId: 'default-user' }),
      });
      setFacts(prev => prev.filter(f => f.id !== id));
    } catch { /* silent */ }
  }

  async function fetchSites() {
    setLoadingSites(true);
    try {
      const res = await fetch('/api/websites');
      if (res.ok) { const d = await res.json(); setIndexedSites(d.sites || []); }
    } catch { /* silent */ }
    setLoadingSites(false);
  }

  async function deleteSite(domain: string) {
    setDeletingDomain(domain);
    try {
      await fetch('/api/websites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      setIndexedSites(prev => prev.filter(s => s.domain !== domain));
    } catch { /* silent */ }
    setDeletingDomain(null);
  }

  async function crawlWebsite() {
    if (!websiteUrl.trim()) return;
    setWebsiteStatus('loading'); setWebsiteMsg('Crawling website…');
    try {
      const res  = await fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setWebsiteStatus('success'); setWebsiteMsg(`Indexed ${data.pages} pages!`); fetchSites(); }
      else        { setWebsiteStatus('error');   setWebsiteMsg(data.error || 'Failed to crawl'); }
    } catch { setWebsiteStatus('error'); setWebsiteMsg('Network error.'); }
  }

  function saveGeneral() {
    setBotConfig({ name: localName || 'Lumi', description: localDesc });
    setSaveMsg('Settings saved!');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  if (!open) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'memory',  label: 'Memory',  icon: Brain },
    { id: 'website', label: 'Website', icon: Globe },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[calc(100%-32px)] max-w-lg bg-[#F5F3F0] rounded-2xl shadow-2xl border border-stone-200/80 max-h-[90vh] flex flex-col overflow-hidden">

        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-stone-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center">
              <Settings className="w-4 h-4 text-stone-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Customize Your Bot</h2>
              <p className="text-xs text-stone-500">Personalize how your AI responds</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-stone-200/80 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        <div className="px-6 pt-3 flex flex-wrap gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === id ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 min-h-[320px] overflow-y-auto no-scrollbar flex-1">
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">Bot Name</label>
                <input value={localName} onChange={e => setLocalName(e.target.value)} placeholder="e.g. Lumi"
                  className="w-full bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">Description</label>
                <textarea value={localDesc} onChange={e => setLocalDesc(e.target.value)} rows={3}
                  placeholder="e.g. A helpful assistant that knows my preferences…"
                  className="w-full bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400 resize-none" />
              </div>
              <button onClick={saveGeneral} className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">
                Save Settings
              </button>
            </div>
          )}

          {tab === 'memory' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">Add personal facts. Your bot will use these to personalize answers.</p>
              <div className="flex gap-2">
                <input value={newFact} onChange={e => setNewFact(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFact()}
                  placeholder="e.g. My name is Tarun, I live in Delhi…"
                  className="flex-1 bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400" />
                <button onClick={addFact} disabled={savingFact || !newFact.trim()}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                  {savingFact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Add
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {loadingFacts
                  ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-stone-400" /></div>
                  : facts.length === 0
                    ? <div className="text-center py-8"><Brain className="w-8 h-8 text-stone-300 mx-auto mb-2" /><p className="text-xs text-stone-400">No memories yet.</p></div>
                    : facts.map(fact => (
                        <div key={fact.id} className="flex items-start gap-2 bg-white border border-stone-200/80 rounded-xl px-3.5 py-2.5 group">
                          <ChevronRight className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-stone-700 flex-1">{fact.text}</span>
                          <button onClick={() => deleteFact(fact.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                }
              </div>
            </div>
          )}

          {tab === 'website' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">Enter a website URL to crawl and index its content.</p>
              <div className="space-y-2">
                <input value={websiteUrl} onChange={e => { setWebsiteUrl(e.target.value); setWebsiteStatus('idle'); }}
                  placeholder="https://example.com"
                  className="w-full bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400" />
                <button onClick={crawlWebsite} disabled={websiteStatus === 'loading' || !websiteUrl.trim()}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {websiteStatus === 'loading'
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Crawling…</>
                    : <><Globe className="w-4 h-4" />Crawl & Index Website</>}
                </button>
              </div>
              {websiteStatus !== 'idle' && (
                <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium ${
                  websiteStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  websiteStatus === 'error'   ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {websiteStatus === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                  {websiteStatus === 'error'   && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {websiteStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                  {websiteMsg}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wide">Indexed Websites</p>
                {loadingSites
                  ? <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-stone-400" /></div>
                  : indexedSites.length === 0
                    ? <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl"><Globe className="w-6 h-6 text-stone-300 mx-auto mb-1.5" /><p className="text-xs text-stone-400">No websites indexed yet</p></div>
                    : <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {indexedSites.map(site => (
                          <div key={site.domain} className="flex items-center gap-2 bg-white border border-stone-200/80 rounded-xl px-3.5 py-2.5 group">
                            <Globe className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-stone-700 truncate font-medium">{site.url || site.domain.replace(/_/g, '.')}</p>
                              <p className="text-[10px] text-stone-400">{site.chunks} chunks indexed</p>
                            </div>
                            <button onClick={() => deleteSite(site.domain)} disabled={deletingDomain === site.domain}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all disabled:opacity-50" title="Remove">
                              {deletingDomain === site.domain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                }
              </div>
            </div>
          )}

          {saveMsg && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              <CheckCircle className="w-3.5 h-3.5" />{saveMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared input props ─────────────────────────────────── */
interface InputSharedProps {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (t?: string) => void | Promise<void>;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedImageTool: ImageTool | null;
  onToolSelect: (t: ImageTool | null) => void;
  pendingImage: string | null;
  onImageSelect: (src: string | null) => void;
  toolChain: ImageToolId[];
  setToolChain: (c: ImageToolId[]) => void;
}

/* ─── Tool Chain Builder ───────────────────────────────── */
function ToolChainBuilder({
  chain, setChain, selectedTool, onToolSelect,
}: {
  chain: ImageToolId[];
  setChain: (c: ImageToolId[]) => void;
  selectedTool: ImageTool | null;
  onToolSelect: (t: ImageTool | null) => void;
}) {
  function addStep() {
    if (!selectedTool || chain.includes(selectedTool.id)) return;
    setChain([...chain, selectedTool.id]);
    onToolSelect(null);
  }
  function removeStep(id: ImageToolId) {
    setChain(chain.filter(c => c !== id));
  }

  if (chain.length === 0) return null;

  return (
    <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mr-1">Chain:</span>
      {chain.map((id, i) => {
        const tool = IMAGE_TOOLS.find(t => t.id === id);
        const Icon = tool ? (TOOL_ICONS[tool.icon] ?? Wand2) : Wand2;
        return (
          <span key={id} className="flex items-center gap-1 bg-stone-900 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
            {i > 0 && <span className="opacity-50 text-[9px] mr-0.5">→</span>}
            <Icon className="w-3 h-3" />
            {tool?.name ?? id}
            <button onClick={() => removeStep(id)} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        );
      })}
      {selectedTool && !chain.includes(selectedTool.id) && (
        <button onClick={addStep}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-dashed border-stone-400 text-stone-500 hover:border-stone-700 hover:text-stone-800 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Step
        </button>
      )}
    </div>
  );
}

/* ─── Image Upload Button ────────────────────────────────── */
function ImageUploadButton({
  onImageSelect,
  hasPending,
}: {
  onImageSelect: (src: string) => void;
  hasPending: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => onImageSelect(ev.target?.result as string);
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />
      <button type="button" onClick={() => fileRef.current?.click()}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all
          ${hasPending
            ? 'border-stone-800 bg-stone-900 text-white'
            : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 bg-white/70'}
        `}
        title="Upload image"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        <span>{hasPending ? 'Image Ready' : 'Upload'}</span>
      </button>
    </>
  );
}

/* ─── Landing Input ──────────────────────────────────────── */
function LandingInput({
  input, setInput, onSubmit, isLoading, suggestions, inputRef,
  selectedImageTool, onToolSelect, pendingImage, onImageSelect,
  toolChain, setToolChain,
}: InputSharedProps & { suggestions: string[] }) {
  const effectiveChain = toolChain.length > 0 ? toolChain : selectedImageTool ? [selectedImageTool.id] : [];
  const canSend = !isLoading && (!!input.trim() || (effectiveChain.length > 0 && !!pendingImage));

  return (
    <div>
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-md">
        {/* Image preview strip */}
        {pendingImage && (
          <div className="px-4 pt-3 flex items-center gap-3 border-b border-stone-100 pb-3 rounded-t-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-stone-200 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-700">Image selected</p>
              {selectedImageTool && (
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Ready to apply <span className="font-medium text-stone-600">{selectedImageTool.name}</span>
                </p>
              )}
            </div>
            <button onClick={() => onImageSelect(null)} className="text-stone-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="px-4 pt-4 pb-2">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSend && onSubmit()}
            placeholder={
              selectedImageTool && pendingImage
                ? `Press send to apply ${selectedImageTool.name}…`
                : selectedImageTool
                  ? `Upload an image to apply ${selectedImageTool.name}…`
                  : 'Ask anything…'
            }
            disabled={isLoading}
            className="w-full bg-transparent text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none"
          />
        </div>

        <div className="px-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-stone-200 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors bg-white/70">
              <Globe className="w-3.5 h-3.5" />Search
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-stone-200 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors bg-white/70">
              <BookOpen className="w-3.5 h-3.5" />Reason
            </button>
            <ImageToolPicker selected={selectedImageTool} onSelect={t => { onToolSelect(t); if (!t) onImageSelect(null); }} />
            {selectedImageTool && (
              <ImageUploadButton onImageSelect={onImageSelect} hasPending={!!pendingImage} />
            )}
          </div>
          <button onClick={() => onSubmit()} disabled={!canSend}
            className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white hover:bg-stone-700 disabled:opacity-30 transition-colors shadow-sm flex-shrink-0">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        {/* Chain builder strip */}
        <ToolChainBuilder chain={toolChain} setChain={setToolChain} selectedTool={selectedImageTool} onToolSelect={onToolSelect} />
      </div>

      <div className="flex gap-2 mt-3 flex-wrap justify-center">
        {suggestions.map(s => (
          <button key={s} onClick={() => onSubmit(s)}
            className="text-xs px-3.5 py-1.5 rounded-full border border-stone-300/80 bg-white/60 text-stone-600 hover:text-stone-900 hover:border-stone-400 hover:bg-white transition-all shadow-sm">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Chat Input (bottom bar) ────────────────────────────── */
function ChatInput({
  input, setInput, onSubmit, isLoading, inputRef,
  selectedImageTool, onToolSelect, pendingImage, onImageSelect,
  toolChain, setToolChain,
}: InputSharedProps) {
  const effectiveChain = toolChain.length > 0 ? toolChain : selectedImageTool ? [selectedImageTool.id] : [];
  const canSend = !isLoading && (!!input.trim() || (effectiveChain.length > 0 && !!pendingImage));

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
      {pendingImage && (
        <div className="px-4 pt-3 flex items-center gap-3 border-b border-stone-100 pb-3 rounded-t-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pendingImage} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-stone-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-stone-700">Image selected</p>
            {selectedImageTool && (
              <p className="text-[11px] text-stone-400 mt-0.5">
                Will apply <span className="font-medium text-stone-600">{selectedImageTool.name}</span>
              </p>
            )}
          </div>
          <button onClick={() => onImageSelect(null)} className="text-stone-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="px-4 pt-3.5 pb-2">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canSend && onSubmit()}
          placeholder={
            selectedImageTool && pendingImage
              ? `Press send to apply ${selectedImageTool.name}…`
              : 'Send a message…'
          }
          disabled={isLoading}
          className="w-full bg-transparent text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none"
        />
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-stone-200 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors bg-white/70">
            <Globe className="w-3.5 h-3.5" />Search
          </button>
          <ImageToolPicker selected={selectedImageTool} onSelect={t => { onToolSelect(t); if (!t) onImageSelect(null); }} />
          {selectedImageTool && (
            <ImageUploadButton onImageSelect={onImageSelect} hasPending={!!pendingImage} />
          )}
        </div>
        <button onClick={() => onSubmit()} disabled={!canSend}
          className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white hover:bg-stone-700 disabled:opacity-30 transition-colors flex-shrink-0">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
      {/* Chain builder strip */}
      <ToolChainBuilder chain={toolChain} setChain={setToolChain} selectedTool={selectedImageTool} onToolSelect={onToolSelect} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN CHAT COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Chat() {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [kiroExpr, setKiroExpr]       = useState<KiroExpression>('idle');
  const [loadingExpr, setLoadingExpr] = useState<KiroExpression>('loading');
  const loadingTimersRef              = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [botConfig, setBotConfig]     = useState<BotConfig>({
    name: 'Lumi',
    description: 'Your intelligent AI assistant',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  const [selectedImageTool, setSelectedImageTool] = useState<ImageTool | null>(null);
  const [pendingImage,       setPendingImage]       = useState<string | null>(null);
  const [toolChain,          setToolChain]          = useState<ImageToolId[]>([]);
  const [isDragOver,         setIsDragOver]         = useState(false);
  const [reactions, setReactions]     = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(current => current === id ? null : current), 2000);
    });
  }, []);

  const handleReact = useCallback((id: string, type: 'up' | 'down') => {
    setReactions(prev => {
      if (prev[id] === type) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: type };
    });
  }, []);

  // ── Drag-and-drop image handler ──
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPendingImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => () => { loadingTimersRef.current.forEach(clearTimeout); }, []);

  function startLoadingCycle() {
    loadingTimersRef.current.forEach(clearTimeout);
    loadingTimersRef.current = [];
    setLoadingExpr('loading');
    const t1 = setTimeout(() => setLoadingExpr('think'),    4000);
    const t2 = setTimeout(() => setLoadingExpr('surprise'), 8000);
    const t3 = setTimeout(() => setLoadingExpr('loading'),  14000);
    loadingTimersRef.current = [t1, t2, t3];
  }

  function stopLoadingCycle() {
    loadingTimersRef.current.forEach(clearTimeout);
    loadingTimersRef.current = [];
  }

  const handleSubmit = useCallback(async (text?: string) => {
    const msg = (text || input).trim();

    // ── Image tool path (no LLM needed) ──
    const effectiveChain = toolChain.length > 0 ? toolChain
      : selectedImageTool ? [selectedImageTool.id] : [];

    if (effectiveChain.length > 0 && pendingImage) {
      const chainLabel = effectiveChain
        .map(id => IMAGE_TOOLS.find(t => t.id === id)?.name ?? id)
        .join(' → ');
      const userMsg: Message = {
        id: Date.now().toString(),
        text: msg || `Apply ${chainLabel}`,
        sender: 'user',
        timestamp: new Date(),
        imageSrc: pendingImage,
        imageToolId: effectiveChain[0],
        toolChain: effectiveChain,
      };
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: '',
        sender: 'assistant',
        timestamp: new Date(),
        imageSrc: pendingImage,
        imageToolId: effectiveChain[0],
        toolChain: effectiveChain,
      };
      setMessages(prev => [...prev, userMsg, botMsg]);
      setInput('');
      setPendingImage(null);
      setToolChain([]);
      setSelectedImageTool(null);
      return;
    }

    if (!msg || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: msg,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setKiroExpr('loading');
    startLoadingCycle();

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, botName: botConfig.name, botDescription: botConfig.description }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.response || "I couldn't process that request.",
        sender: 'assistant',
        timestamp: new Date(),
      }]);
      stopLoadingCycle();
      setKiroExpr('happy');
      setTimeout(() => setKiroExpr('idle'), 2000);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'assistant',
        timestamp: new Date(),
      }]);
      stopLoadingCycle();
      setKiroExpr('surprise');
      setTimeout(() => setKiroExpr('idle'), 1500);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, selectedImageTool, pendingImage, botConfig, toolChain]);

  const suggestions = [
    "What can you do?",
    "What's the current time?",
    "Search latest AI news",
    "Who is Pikachu?",
  ];

  const hasMessages = messages.length > 0;

  const sharedInputProps: InputSharedProps = {
    input, setInput,
    onSubmit: handleSubmit,
    isLoading,
    inputRef,
    selectedImageTool,
    onToolSelect: setSelectedImageTool,
    pendingImage,
    onImageSelect: setPendingImage,
    toolChain,
    setToolChain,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes bounce   { 0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up  { animation: fadeUp 0.35s ease forwards; }
        .no-scrollbar::-webkit-scrollbar { display:none }
        .no-scrollbar { -ms-overflow-style:none;scrollbar-width:none }
        *{ font-family:'DM Sans',sans-serif; }
      `}</style>

      <div className="flex h-screen bg-[#EDECEA] overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="flex flex-col border-r border-stone-300/50 bg-[#E6E3DF] w-[52px]">
          <div className="flex flex-col items-center py-4 gap-1 h-full">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors cursor-default"
              title="Sidebar"
              aria-label="Sidebar">
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="w-6 h-px bg-stone-300/60 my-1" />
            <button onClick={() => setMessages([])}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              title="New Chat"
              aria-label="New Chat">
              <Plus className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              title="Conversations"
              aria-label="Conversations">
              <MessageSquare className="w-4 h-4" />
            </button>
            <button onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              title="Memory"
              aria-label="Memory">
              <Brain className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors mb-2"
              title="Settings"
              aria-label="Settings">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden"
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-stone-900/20 backdrop-blur-sm pointer-events-none">
              <div className="bg-white rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl border border-stone-200">
                <ImageIcon className="w-10 h-10 text-stone-400" />
                <p className="text-sm font-semibold text-stone-700">Drop image to upload</p>
              </div>
            </div>
          )}

          {/* Top Bar */}
          <header className="flex items-center px-4 py-3 gap-3">
            <div className="flex-1" />
            <button onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors shadow-sm">
              <Settings className="w-3 h-3" />Customize
            </button>
          </header>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-4">
            {!hasMessages ? (
              <div className="flex flex-col items-center justify-center h-full pb-8">
                <div className="fade-up text-center max-w-md">
                  <div className="flex justify-center mb-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}>
                    <KiroAvatar expression="idle" size={56} />
                  </div>
                  <h1 style={{ fontFamily: "'Instrument Serif', serif" }} className="text-[2rem] sm:text-[2.4rem] font-normal text-stone-900 leading-tight mb-2">
                    What can {botConfig.name} help with?
                  </h1>
                  <p className="text-sm text-stone-500 mb-8">{botConfig.description}</p>
                </div>
                <div className="fade-up w-full max-w-2xl" style={{ animationDelay: '0.1s', opacity: 0 }}>
                  <LandingInput {...sharedInputProps} suggestions={suggestions} />
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto py-6 space-y-5">
                {messages.map((message, idx) => (
                  <div key={message.id}
                    className={`fade-up flex gap-3 group ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
                    style={{ animationDelay: `${idx * 0.03}s`, opacity: 0 }}
                  >
                    {message.sender === 'user' ? (
                      <div className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-xl bg-stone-900 flex items-center justify-center shadow-sm">
                        <User size={13} className="text-white" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 mt-0.5" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}>
                        <KiroAvatar
                          expression={
                            messages.filter(m => m.sender === 'assistant').at(-1)?.id === message.id ? 'idle' : 'sleep'
                          }
                          size={52}
                        />
                      </div>
                    )}

                    <div className={`max-w-[80%] ${message.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        message.sender === 'user'
                          ? 'bg-stone-900 text-stone-100 rounded-tr-sm'
                          : 'bg-white border border-stone-200/80 text-stone-800 rounded-tl-sm shadow-sm'
                      }`}>
                        {message.sender === 'assistant' ? (
                          (message.imageToolId || message.toolChain) ? (
                            <ProcessedImageBubble
                              message={message}
                              onReuseResult={(url) => {
                                setPendingImage(url);
                                setToolChain([]);
                                setSelectedImageTool(null);
                              }}
                            />
                          ) : (
                            <div className="prose prose-sm max-w-none prose-stone">
                              <ReactMarkdown
                                components={{
                                  a: ({ node, ...props }) => <a {...props} className="text-stone-600 underline decoration-stone-300 hover:text-stone-900 transition-colors" target="_blank" rel="noopener noreferrer" />,
                                  p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                                  ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-2 space-y-1" />,
                                  ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />,
                                  strong: ({ node, ...props }) => <strong {...props} className="font-semibold text-stone-900" />,
                                  code: ({ node, ...props }) => <code {...props} className="bg-stone-100 px-1.5 py-0.5 rounded-md text-xs font-mono text-stone-700" />,
                                }}
                              >{message.text}</ReactMarkdown>
                            </div>
                          )
                        ) : (
                          <div>
                            {message.imageSrc && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={message.imageSrc} alt="uploaded" className="max-w-[200px] rounded-lg mb-2 border border-stone-700" />
                            )}
                            {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 min-h-[24px]">
                        <span className="text-[10px] text-stone-400 px-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.sender === 'assistant' && !(message.imageToolId || message.toolChain) && (
                          <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-1 items-center">
                            <button
                              onClick={() => handleReact(message.id, 'up')}
                              className={`p-1 rounded hover:bg-stone-200 transition-colors ${
                                reactions[message.id] === 'up' ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
                              }`}
                              title="Thumbs Up"
                              aria-label="Thumbs Up"
                            >
                              <ThumbsUp size={13} className={reactions[message.id] === 'up' ? 'fill-emerald-100' : ''} />
                            </button>
                            <button
                              onClick={() => handleReact(message.id, 'down')}
                              className={`p-1 rounded hover:bg-stone-200 transition-colors ${
                                reactions[message.id] === 'down' ? 'text-rose-600' : 'text-stone-400 hover:text-stone-600'
                              }`}
                              title="Thumbs Down"
                              aria-label="Thumbs Down"
                            >
                              <ThumbsDown size={13} className={reactions[message.id] === 'down' ? 'fill-rose-100' : ''} />
                            </button>
                            <button
                              onClick={() => handleCopy(message.text, message.id)}
                              className="p-1 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
                              title="Copy Message"
                              aria-label="Copy Message"
                            >
                              {copiedId === message.id ? (
                                <Check size={13} className="text-emerald-600" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="fade-up flex gap-3 items-end">
                    <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.20))' }}>
                      <KiroAvatar expression={loadingExpr} size={52} />
                    </div>
                    <div className="bg-white border border-stone-200/80 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm mb-1">
                      <TypingDots />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom input (chat state) */}
          {hasMessages && (
            <div className="px-4 pb-4 pt-2">
              <div className="max-w-2xl mx-auto">
                <ChatInput {...sharedInputProps} />
                <p className="text-center text-[10px] text-stone-400 mt-2.5">
                  {botConfig.name} can make mistakes. Verify important information.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        botConfig={botConfig}
        setBotConfig={setBotConfig}
      />
    </>
  );
}
