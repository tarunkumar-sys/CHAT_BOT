'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

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
      text: "Hello! How can I help you today?",
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
    <div className="min-h-screen bg-black text-white">
      {/* Header - Fixed at top */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-900 bg-black/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-gray-800 to-black border border-gray-800 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <h1 className="text-sm font-medium text-gray-300">ScribeNova</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Container */}
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-32">
        {/* Messages Area */}
        <div className="space-y-6 py-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-4 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-6 h-6 mt-1 rounded-sm flex items-center justify-center ${
                message.sender === 'user' 
                  ? 'bg-gray-800 text-gray-300' 
                  : 'bg-gray-900 text-gray-400 border border-gray-800'
              }`}>
                {message.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>
              
              {/* Message Bubble */}
              <div className={`max-w-[85%] ${message.sender === 'user' ? 'text-right' : ''}`}>
                <div className={`px-4 py-3 rounded-xl ${
                  message.sender === 'user'
                    ? 'bg-gray-900 text-gray-100 border border-gray-800'
                    : 'bg-gray-950 text-gray-300 border border-gray-900'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                </div>
                <span className="text-xs text-gray-600 mt-1.5 block px-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-4 animate-in fade-in duration-500">
              <div className="w-6 h-6 mt-1 rounded-sm flex items-center justify-center bg-gray-900 border border-gray-800 text-gray-400">
                <Bot size={12} />
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-950 border border-gray-900">
                <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-900 bg-black/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto p-4">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
                disabled={isLoading}
                className="w-full bg-gray-950 border border-gray-800 text-gray-100 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-700 focus:border-gray-700 transition-all placeholder:text-gray-600"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            {/* Quick Suggestions */}
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
              {["What's 56 + 4?", "Tell me a joke", "Explain quantum computing", "Today's news"].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-300 hover:border-gray-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>
          
          {/* Footer Note */}
          <p className="text-center text-xs text-gray-700 mt-4">
            AI Assistant v1.0 • Powered by TinyLlama
          </p>
        </div>
      </div>
    </div>
  );
}