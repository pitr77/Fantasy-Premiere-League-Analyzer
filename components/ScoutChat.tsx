import React, { useState, useEffect, useRef } from 'react';
import { FPLPlayer, FPLTeam, FPLEvent, FPLFixture } from '../types';
import { createScoutChatSession } from '../services/geminiService';
import { GenerateContentResponse, Chat } from "@google/genai";
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface ScoutChatProps {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  events: FPLEvent[];
  myTeam: FPLPlayer[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ScoutChat: React.FC<ScoutChatProps> = ({ players, teams, fixtures, events, myTeam }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hello! I'm your AI FPL Scout. I've analyzed the market and your team. Ask me anything about transfers, captaincy picks, or future planning!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chat Session
  useEffect(() => {
    const initChat = async () => {
      try {
        const session = await createScoutChatSession(players, teams, fixtures, events, myTeam);
        setChatSession(session);
      } catch (err) {
        console.error(err);
        setError("Failed to initialize AI Scout. Please check API configuration.");
      }
    };
    initChat();
  }, [players, teams, fixtures, events, myTeam]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;
    
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const resultStream = await chatSession.sendMessageStream({ message: userMsg });
      
      let fullResponse = "";
      // Add a placeholder message for the model that we will update
      setMessages(prev => [...prev, { role: 'model', text: "" }]);

      for await (const chunk of resultStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullResponse += c.text;
          // Update the last message with the growing response
          setMessages(prev => {
            const newArr = [...prev];
            newArr[newArr.length - 1] = { role: 'model', text: fullResponse };
            return newArr;
          });
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error processing that request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    "Who is the best captain for next GW?",
    "Suggest 3 transfer targets for my team",
    "Analyze my defense",
    "Who is a good differential midfielder?"
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      
      {/* Header */}
      <div className="bg-slate-800 p-4 rounded-t-xl border-b border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="bg-purple-600 p-2 rounded-lg">
             <Bot className="text-white w-6 h-6" />
           </div>
           <div>
             <h2 className="text-xl font-bold text-white">AI Scout Chat</h2>
             <div className="text-xs text-green-400 flex items-center gap-1">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               Online • Context Loaded
             </div>
           </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-900 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
               msg.role === 'user' 
                 ? 'bg-purple-600 text-white rounded-br-none' 
                 : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
             }`}>
                {msg.role === 'model' && (
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-purple-400 uppercase">
                    <Sparkles size={12} /> AI Scout
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                  {msg.text}
                </div>
             </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-slate-800 rounded-2xl rounded-bl-none p-4 border border-slate-700">
               <div className="flex gap-1">
                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="bg-slate-800 p-4 rounded-b-xl border-t border-slate-700 shrink-0">
         
         {/* Suggested Chips */}
         {messages.length < 3 && (
           <div className="flex gap-2 overflow-x-auto pb-3 mb-2 custom-scrollbar">
              {suggestedPrompts.map((prompt, i) => (
                <button 
                  key={i}
                  onClick={() => { setInput(prompt); }}
                  className="whitespace-nowrap bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 px-3 py-1.5 rounded-full border border-slate-600 transition-colors"
                >
                  {prompt}
                </button>
              ))}
           </div>
         )}

         <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask for transfer advice..."
              disabled={isLoading || !chatSession}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none h-14 custom-scrollbar"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !chatSession}
              className="absolute right-2 top-2 p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
         </div>
         {error && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </div>
         )}
      </div>
    </div>
  );
};

export default ScoutChat;