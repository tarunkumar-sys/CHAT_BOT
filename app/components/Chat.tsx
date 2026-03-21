'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, User, Loader2, Settings, Plus, MessageSquare,
  Archive, PanelLeft, Trash2, Globe, Brain, X, ChevronRight,
  CheckCircle, AlertCircle, Sparkles, BookOpen, Cpu, Sun, Moon
} from 'lucide-react';
import { KiroAvatar, type KiroExpression } from './KiroMascot';
import ReactMarkdown from 'react-markdown';

/* ─── Types ─────────────────────────────────────────────── */
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
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

/* ─── Helpers ────────────────────────────────────────────── */
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

  // Load facts when memory tab opens
  useEffect(() => {
    if (tab === 'memory' && open) fetchFacts();
    if (tab === 'website' && open) fetchSites();
  }, [tab, open]);

  async function fetchFacts() {
    setLoadingFacts(true);
    try {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        setFacts(data.facts || []);
      }
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
        const data = await res.json();
        setFacts(prev => [data.fact, ...prev]);
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
      if (res.ok) {
        const data = await res.json();
        setIndexedSites(data.sites || []);
      }
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
    setWebsiteStatus('loading');
    setWebsiteMsg('Crawling website…');
    try {
      const res = await fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebsiteStatus('success');
        setWebsiteMsg(`Indexed ${data.pages} pages successfully!`);
        fetchSites();
      } else {
        setWebsiteStatus('error');
        setWebsiteMsg(data.error || 'Failed to crawl website');
      }
    } catch {
      setWebsiteStatus('error');
      setWebsiteMsg('Network error. Is the server running?');
    }
  }

  function saveGeneral() {
    setBotConfig({ name: localName || 'ScribeNova', description: localDesc });
    setSaveMsg('Settings saved!');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  if (!open) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: Cpu },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'website', label: 'Website', icon: Globe },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-[#F5F3F0] rounded-2xl shadow-2xl overflow-hidden border border-stone-200/80">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-stone-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center">
              <Settings className="w-4 h-4 text-stone-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900 tracking-tight">Customize Your Bot</h2>
              <p className="text-xs text-stone-500">Personalize how your AI responds</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-stone-200/80 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === id
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[320px]">
          {/* General Tab */}
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">Bot Name</label>
                <input
                  value={localName}
                  onChange={e => setLocalName(e.target.value)}
                  placeholder="e.g. ScribeNova"
                  className="w-full bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wide">Description</label>
                <textarea
                  value={localDesc}
                  onChange={e => setLocalDesc(e.target.value)}
                  placeholder="e.g. A helpful assistant that knows my preferences…"
                  rows={3}
                  className="w-full bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400 resize-none"
                />
              </div>
              <button
                onClick={saveGeneral}
                className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
              >
                Save Settings
              </button>
            </div>
          )}

          {/* Memory Tab */}
          {tab === 'memory' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-stone-500 mb-3">
                  Add personal facts. Your bot will use these to give personalized answers.
                </p>
                <div className="flex gap-2">
                  <input
                    value={newFact}
                    onChange={e => setNewFact(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFact()}
                    placeholder="e.g. My name is Tarun, I live in Delhi…"
                    className="flex-1 bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400"
                  />
                  <button
                    onClick={addFact}
                    disabled={savingFact || !newFact.trim()}
                    className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {savingFact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>
              </div>

              {/* Facts list */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {loadingFacts ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                  </div>
                ) : facts.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-xs text-stone-400">No memories yet. Add your first fact!</p>
                  </div>
                ) : (
                  facts.map(fact => (
                    <div key={fact.id} className="flex items-start gap-2 bg-white border border-stone-200/80 rounded-xl px-3.5 py-2.5 group">
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-stone-700 flex-1 leading-relaxed">{fact.text}</span>
                      <button
                        onClick={() => deleteFact(fact.id)}
                        className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Website Tab */}
          {tab === 'website' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">
                Enter a website URL to crawl and index its content.
              </p>

              {/* Input + crawl button */}
              <div className="space-y-2">
                <input
                  value={websiteUrl}
                  onChange={e => { setWebsiteUrl(e.target.value); setWebsiteStatus('idle'); }}
                  placeholder="https://example.com or just example.com"
                  className="w-full bg-white border border-stone-200 text-stone-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 placeholder:text-stone-400"
                />
                <button
                  onClick={crawlWebsite}
                  disabled={websiteStatus === 'loading' || !websiteUrl.trim()}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {websiteStatus === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Crawling…</>
                  ) : (
                    <><Globe className="w-4 h-4" /> Crawl & Index Website</>
                  )}
                </button>
              </div>

              {/* Status message */}
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

              {/* Indexed websites list */}
              <div>
                <p className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wide">Indexed Websites</p>
                {loadingSites ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                  </div>
                ) : indexedSites.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl">
                    <Globe className="w-6 h-6 text-stone-300 mx-auto mb-1.5" />
                    <p className="text-xs text-stone-400">No websites indexed yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {indexedSites.map(site => (
                      <div
                        key={site.domain}
                        className="flex items-center gap-2 bg-white border border-stone-200/80 rounded-xl px-3.5 py-2.5 group"
                      >
                        <Globe className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-700 truncate font-medium">
                            {site.url || site.domain.replace(/_/g, '.')}
                          </p>
                          <p className="text-[10px] text-stone-400">{site.chunks} chunks indexed</p>
                        </div>
                        <button
                          onClick={() => deleteSite(site.domain)}
                          disabled={deletingDomain === site.domain}
                          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all disabled:opacity-50"
                          title="Remove from index"
                        >
                          {deletingDomain === site.domain
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status message */}
          {saveMsg && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              <CheckCircle className="w-3.5 h-3.5" />
              {saveMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Chat Component ────────────────────────────────── */
export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [kiroExpr, setKiroExpr] = useState<KiroExpression>('idle');
  const [loadingExpr, setLoadingExpr] = useState<KiroExpression>('loading');
  const loadingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [botConfig, setBotConfig] = useState<BotConfig>({
    name: 'ScribeNova',
    description: 'Your intelligent AI assistant',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const themeToggleRef = useRef<HTMLButtonElement>(null);
  const [isDark, setIsDark] = useState(false);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  function toggleTheme() {
    const btn = themeToggleRef.current;
    const overlay = overlayRef.current;
    if (!btn || !overlay) { setIsDark(d => !d); return; }

    const rect = btn.getBoundingClientRect();
    const BX = rect.left + rect.width / 2;
    const BY = rect.top + rect.height / 2;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const MAX = Math.hypot(Math.max(BX, W - BX), Math.max(BY, H - BY)) * 1.05;

    // Remove any leftover listener
    const cleanup = () => {
      overlay.style.display = 'none';
      overlay.removeEventListener('transitionend', cleanup);
    };

    if (!isDark) {
      // Light → Dark: expand dark overlay, then commit
      overlay.style.background = '#18181b';
      overlay.style.clipPath = `circle(0px at ${BX}px ${BY}px)`;
      overlay.style.display = 'block';
      overlay.getBoundingClientRect(); // force reflow
      overlay.style.transition = 'clip-path 0.65s cubic-bezier(0.4, 0, 0.2, 1)';
      overlay.style.clipPath = `circle(${MAX}px at ${BX}px ${BY}px)`;
      overlay.addEventListener('transitionend', () => {
        setIsDark(true);
        cleanup();
      }, { once: true });
    } else {
      // Dark → Light: flip immediately, then shrink light overlay away
      setIsDark(false);
      overlay.style.background = '#EDECEA';
      overlay.style.clipPath = `circle(${MAX}px at ${BX}px ${BY}px)`;
      overlay.style.display = 'block';
      overlay.getBoundingClientRect(); // force reflow
      overlay.style.transition = 'clip-path 0.65s cubic-bezier(0.4, 0, 0.2, 1)';
      overlay.style.clipPath = `circle(0px at ${BX}px ${BY}px)`;
      overlay.addEventListener('transitionend', cleanup, { once: true });
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    return () => { loadingTimersRef.current.forEach(clearTimeout); };
  }, []);

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
        body: JSON.stringify({
          message: msg,
          botName: botConfig.name,
          botDescription: botConfig.description,
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || "I couldn't process that request.",
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      stopLoadingCycle();
      setKiroExpr('happy');
      setTimeout(() => setKiroExpr('idle'), 2000);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'assistant',
        timestamp: new Date(),
      }]);
      stopLoadingCycle();
      setKiroExpr('surprise');
      setTimeout(() => setKiroExpr('idle'), 1500);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const suggestions = [
    "What can you do?",
    "What's the current time?",
    "Search latest AI news",
    "Who is Pikachu?",
  ];

  const hasMessages = messages.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes bounce { 0%,80%,100% { transform:translateY(0); opacity:0.4 } 40% { transform:translateY(-4px); opacity:1 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
        .slide-in { animation: slideIn 0.3s ease forwards; }
        .no-scrollbar::-webkit-scrollbar { display:none }
        .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none }
        * { font-family:'DM Sans', sans-serif; }
      `}</style>

      <div className="flex h-screen bg-[#EDECEA] overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={`flex flex-col border-r border-stone-300/50 bg-[#E6E3DF] transition-all duration-300 ${sidebarOpen ? 'w-[52px]' : 'w-0 overflow-hidden'}`}>
          <div className="flex flex-col items-center py-4 gap-1 h-full">
            {/* Toggle */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="w-6 h-px bg-stone-300/60 my-1" />

            {/* New Chat */}
            <button
              onClick={() => setMessages([])}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Chats */}
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              title="Conversations"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Memory */}
            <button
              onClick={() => { setSettingsOpen(true); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              title="Memory"
            >
              <Brain className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            {/* Settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors mb-2"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* ── Main Area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top Bar */}
          <header className="flex items-center px-4 py-3 gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-300/60 text-stone-500 hover:text-stone-800 transition-colors"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <span className="text-sm font-medium text-stone-600 tracking-tight">
              {botConfig.name}
            </span>

            <div className="flex-1" />

            {/* Settings button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors shadow-sm"
            >
              <Settings className="w-3 h-3" />
              Customize
            </button>

            {/* Avatar */}
            {/* <div className="w-7 h-7 rounded-full bg-gradient-to-br from-stone-400 to-stone-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div> */}
          </header>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-4">
            {!hasMessages ? (
              /* ── Landing State ── */
              <div className="flex flex-col items-center justify-center h-full pb-8">
                <div className="fade-up text-center max-w-md">
                  <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Sparkles className="w-6 h-6 text-stone-200" />
                  </div>
                  <h1 style={{ fontFamily: "'Instrument Serif', serif" }} className="text-[2.4rem] font-normal text-stone-900 leading-tight mb-2">
                    What can I help with?
                  </h1>
                  <p className="text-sm text-stone-500 mb-8">
                    {botConfig.description}
                  </p>
                </div>

                {/* Input box on landing */}
                <div className="fade-up w-full max-w-2xl" style={{ animationDelay: '0.1s', opacity: 0 }}>
                  <LandingInput
                    input={input}
                    setInput={setInput}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    suggestions={suggestions}
                    inputRef={inputRef}
                  />
                </div>
              </div>
            ) : (
              /* ── Messages ── */
              <div className="max-w-2xl mx-auto py-6 space-y-5">
                {messages.map((message, idx) => (
                  <div
                    key={message.id}
                    className={`fade-up flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
                    style={{ animationDelay: `${idx * 0.03}s`, opacity: 0 }}
                  >
                    {/* Avatar */}
                    {message.sender === 'user' ? (
                      <div className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-xl bg-stone-900 flex items-center justify-center shadow-sm">
                        <User size={13} className="text-white" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 mt-0.5" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}>
                        <KiroAvatar
                          expression={
                            messages.filter(m => m.sender === 'assistant').at(-1)?.id === message.id
                              ? 'idle'
                              : 'sleep'
                          }
                          size={52}
                        />
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`max-w-[80%] ${message.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        message.sender === 'user'
                          ? 'bg-stone-900 text-stone-100 rounded-tr-sm'
                          : 'bg-white border border-stone-200/80 text-stone-800 rounded-tl-sm shadow-sm'
                      }`}>
                        {message.sender === 'assistant' ? (
                          <div className="prose prose-sm max-w-none prose-stone">
                            <ReactMarkdown
                              components={{
                                a: ({ node, ...props }) => (
                                  <a {...props} className="text-stone-600 underline decoration-stone-300 hover:text-stone-900 transition-colors" target="_blank" rel="noopener noreferrer" />
                                ),
                                p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                                ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-2 space-y-1" />,
                                ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />,
                                strong: ({ node, ...props }) => <strong {...props} className="font-semibold text-stone-900" />,
                                code: ({ node, ...props }) => <code {...props} className="bg-stone-100 px-1.5 py-0.5 rounded-md text-xs font-mono text-stone-700" />,
                              }}
                            >
                              {message.text}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.text}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 px-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
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

          {/* ── Bottom Input (chat state) ── */}
          {hasMessages && (
            <div className="px-4 pb-4 pt-2">
              <div className="max-w-2xl mx-auto">
                <ChatInput
                  input={input}
                  setInput={setInput}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  inputRef={inputRef}
                />
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

/* ─── Landing Input ──────────────────────────────────────── */
function LandingInput({
  input, setInput, onSubmit, isLoading, suggestions, inputRef
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (t?: string) => void;
  isLoading: boolean;
  suggestions: string[];
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-md overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSubmit()}
            placeholder="Ask anything…"
            disabled={isLoading}
            className="w-full bg-transparent text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none"
          />
        </div>
        <div className="px-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors">
              <Globe className="w-3 h-3" />
              Search
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors">
              <BookOpen className="w-3 h-3" />
              Reason
            </button>
          </div>
          <button
            onClick={() => onSubmit()}
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white hover:bg-stone-700 disabled:opacity-30 transition-colors shadow-sm"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="flex gap-2 mt-3 flex-wrap justify-center">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSubmit(s)}
            className="text-xs px-3.5 py-1.5 rounded-full border border-stone-300/80 bg-white/60 text-stone-600 hover:text-stone-900 hover:border-stone-400 hover:bg-white transition-all shadow-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Chat Input (bottom bar) ────────────────────────────── */
function ChatInput({
  input, setInput, onSubmit, isLoading, inputRef
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (t?: string) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="Send a message…"
          disabled={isLoading}
          className="w-full bg-transparent text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none"
        />
      </div>
      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200 text-xs text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors">
            <Globe className="w-3 h-3" />
            Search
          </button>
        </div>
        <button
          onClick={() => onSubmit()}
          disabled={isLoading || !input.trim()}
          className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white hover:bg-stone-700 disabled:opacity-30 transition-colors"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
