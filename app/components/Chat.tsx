'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI assistant. I can help you with searches, calculations, and remember personal information. How can I help you today?",
      sender: 'assistant',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || "I couldn't process that request.",
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'assistant',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#09090b] text-zinc-200 selection:bg-zinc-700">
      {/* Main Centered Card Container */}
      <div className="flex flex-col w-full max-w-4xl h-[92vh] bg-[#000000] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden m-4">
        
        {/* Header - Minimalist */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0c0c0e]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-zinc-800 rounded-md border border-zinc-700">
              <Sparkles className="w-4 h-4 text-zinc-100" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">TinyLlama Agent</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">LangChain v0.2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-500 font-medium">Ready</span>
          </div>
        </header>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] gap-4 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm ${
                    message.sender === 'user' 
                      ? 'bg-zinc-100 border-zinc-200 text-black' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}>
                    {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  
                  <div className={`relative px-1 py-1`}>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      message.sender === 'user' ? 'text-zinc-100 font-medium' : 'text-zinc-300'
                    }`}>
                      {message.text}
                    </p>
                    <span className="text-[10px] text-zinc-600 mt-2 block font-mono">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 animate-in fade-in duration-500">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400">
                  <Bot size={16} />
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                  <span className="text-sm text-zinc-500 italic">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Form - Fixed at bottom of card */}
        <div className="p-6 border-t border-zinc-800 bg-[#0c0c0e]">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative flex items-center group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your agent anything..."
                disabled={isLoading}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl pl-4 pr-14 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-all placeholder:text-zinc-600 shadow-inner"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 p-2 rounded-lg bg-zinc-100 text-black hover:bg-zinc-300 disabled:opacity-30 disabled:hover:bg-zinc-100 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            {/* Quick Suggestions */}
            <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
              {["What's 56 + 4?", "Today's news", "Clear memory"].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="whitespace-nowrap text-[11px] font-medium px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>
          <p className="text-[10px] text-center mt-4 text-zinc-700 font-mono tracking-tighter">
            PROMPT: TINYLLAMA-1.1B-CHAT-V1.0 • SYSTEM-ROLE: HELPFUL-AGENT
          </p>
        </div>
      </div>
    </div>
  );
}