/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Maximize, Minimize, Code2, BrainCircuit, Target, Hexagon, Loader2, Image as ImageIcon, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import CodeStudio from '../pages/CodeStudio';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import emblem from '../../assets/drift_emblem.png';

export default function AIAssistant() {
  const { generateAIContentStream, activeAiContext, aiSettings, isAiActive } = useAppContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [studioCode, setStudioCode] = useState(null);
  
  // New States for Advanced AI Features
  const [selectedImage, setSelectedImage] = useState(null);
  const [useSearch, setUseSearch] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [position, setPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 480 : 800, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (isFullScreen) return;
      setPosition(prev => {
        let { x, y } = prev;
        const panelWidth = Math.min(450, window.innerWidth);
        const panelHeight = window.innerHeight * 0.8;
        
        let newX = x;
        let newY = y;
        
        if (newX + panelWidth > window.innerWidth) newX = window.innerWidth - panelWidth;
        if (newX < 0) newX = 0;
        
        if (newY + panelHeight > window.innerHeight) newY = window.innerHeight - panelHeight;
        if (newY < 0) newY = 0;
        
        if (newX !== x || newY !== y) {
          return { x: newX, y: newY };
        }
        return prev;
      });
    };

    window.addEventListener('resize', handleResize);
    // Call once to ensure it starts within bounds if initially mounted on small screen
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullScreen]);

  const handlePointerDown = (e) => {
    if (isFullScreen) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging || isFullScreen) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setPosition(prev => {
        let { x, y } = prev;
        const threshold = 40;
        const panelWidth = 450;
        const panelHeight = window.innerHeight * 0.8;
        
        if (x < threshold) x = 0;
        else if (x + panelWidth > window.innerWidth - threshold) x = window.innerWidth - panelWidth;
        
        if (y < threshold) y = 0;
        else if (y + panelHeight > window.innerHeight - threshold) y = window.innerHeight - panelHeight;
        
        return { x, y };
      });
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragOffset, isFullScreen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isTyping) return;
    
    const userMsg = { role: 'user', content: input, image: selectedImage };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    
    // Store inputs before clearing
    const currentInput = input;
    const currentImg = selectedImage;
    const currentUseSearch = useSearch;
    
    setInput('');
    setSelectedImage(null);
    setIsTyping(true);
    
    try {
      let systemInstruction = `You are an integrated AI assistant for Control Drift, a Purple Team gap analysis and adversary simulation platform. You specialize in cybersecurity, specifically MITRE ATT&CK, adversary simulation, and detection engineering. Your goal is to help the user navigate their security posture, analyze gaps, map TTPs, and provide actionable remediation advice. Be highly conversational, polite, and provide detailed, clear, and context-aware responses tailored to the platform's data.`;
      
      systemInstruction += `\n\nThe current local date and time is: ${new Date().toLocaleString()}`;
      
      if (activeAiContext) {
         systemInstruction += `\n\n<internal_context>\n${JSON.stringify(activeAiContext, null, 2)}\n</internal_context>\n\nCRITICAL RULE: The <internal_context> block above contains background state from the user's application. DO NOT output or regurgitate this raw data to the user. Only use it to inform your answers if the user asks a question related to their current state or environment.`;
      }
      
      const historyText = newHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}${m.image ? '\n[Attached Image]' : ''}`).join('\n\n');
      const promptToSend = `Conversation History:\n${historyText}\n\nPlease respond to the user's latest message:\n${currentInput}`;
      
      const fullResponse = await generateAIContentStream(promptToSend, systemInstruction, () => {}, { useSearch: currentUseSearch, imageData: currentImg });
      
      setIsTyping(false); // Stop the indicator
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      let currentIndex = 0;
      const interval = setInterval(() => {
          currentIndex += 4; // Reveal 4 characters per tick
          if (currentIndex >= fullResponse.length) {
              currentIndex = fullResponse.length;
              clearInterval(interval);
          }
          setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].content = fullResponse.slice(0, currentIndex);
              return newMsgs;
          });
      }, 15);
      
      return; // Return early so we don't set isTyping(false) again below
      
    } catch(err) {
      setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = `**Error:** ${err.message}`;
          return newMsgs;
      });
    }
    
    setIsTyping(false);
  };

  return (
    <>
      {!isOpen && (
        <button 
          className="btn animate-fade-in" 
          onClick={() => setIsOpen(true)}
          style={{ position: 'fixed', right: '30px', bottom: '30px', zIndex: 90, borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 0 20px var(--accent-glow)' }}
        >
           <MessageSquare size={26} />
        </button>
      )}

      <div className="ai-panel" style={{ 
          position: 'fixed', 
          left: isFullScreen ? 0 : position.x,
          top: isFullScreen ? 0 : position.y,
          width: isFullScreen ? '100vw' : '450px',
          maxWidth: '100vw',
          height: isFullScreen ? '100vh' : '80vh',
          maxHeight: '100vh',
          borderRadius: isFullScreen ? 0 : '12px',
          boxShadow: isFullScreen ? 'none' : '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(156, 39, 176, 0.2)',
          border: isFullScreen ? 'none' : '1px solid var(--glass-border)',
          background: isFullScreen ? 'rgba(5, 5, 8, 0.98)' : 'rgba(10, 11, 16, 0.95)',
          transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          zIndex: 100,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          display: 'flex',
          flexDirection: 'column'
      }}>
        <div 
          className="ai-header" 
          onPointerDown={handlePointerDown}
          style={{ 
             display: 'flex', 
             justifyContent: 'space-between', 
             alignItems: 'center', 
             background: 'rgba(156, 39, 176, 0.05)',
             cursor: isFullScreen ? 'default' : (isDragging ? 'grabbing' : 'grab'),
             borderTopLeftRadius: isFullScreen ? 0 : '12px',
             borderTopRightRadius: isFullScreen ? 0 : '12px',
             userSelect: 'none',
             padding: '15px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <BrainCircuit size={24} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '10px' }}>
               {(() => {
                  const p = aiSettings?.provider || 'None';
                  const m = aiSettings?.model || '';
                  
                  return (
                      <>
                         <span style={{ lineHeight: '1', fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AI Assistant</span>
                         {isAiActive ? (
                           <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${p} ${m ? `(${m})` : ''}`}>
                             {m || p}
                           </span>
                         ) : (
                           <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                             Offline
                           </span>
                         )}
                      </>
                  );
               })()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            {activeAiContext && isAiActive && (
                <div style={{ fontSize: '0.7rem', background: 'rgba(192, 132, 252, 0.2)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Target size={10} /> Context: {activeAiContext.id || 'Active'}
                </div>
            )}
            <button onClick={() => setIsFullScreen(!isFullScreen)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}>
              {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <X size={24} />
            </button>
          </div>
        </div>
        
        {!isAiActive ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center', gap: '20px' }}>
                <div style={{ background: 'rgba(156, 39, 176, 0.1)', padding: '16px', borderRadius: '50%', border: '1px solid rgba(156, 39, 176, 0.3)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BrainCircuit size={40} />
                </div>
                <div>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>AI Integration Offline</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        To activate AI-powered features, please configure an AI integration in the settings.
                    </p>
                </div>
                <button className="btn" style={{ fontSize: '0.9rem', padding: '10px 20px' }} onClick={() => { setIsOpen(false); navigate('/settings'); }}>
                    Configure in Settings
                </button>
            </div>
        ) : (
            <>
                <div className="ai-messages" style={{ alignItems: isFullScreen ? 'center' : 'stretch' }}>
                  <div style={{ width: '100%', maxWidth: isFullScreen ? '1400px' : '100%', display: 'flex', flexDirection: 'column', gap: '16px', margin: '0 auto' }}>
                    {messages.map((msg, i) => {
                      if (msg.role === 'assistant' && !msg.content) return null;
                      return (
                      <div key={i} className={`ai-message ${msg.role}`} style={{ maxWidth: isFullScreen ? '80%' : '85%' }}>
                        {msg.role === 'assistant' ? (
                          <div style={{ display: 'flex', gap: '12px' }}>
                              <div style={{ width: '28px', height: '28px', flexShrink: 0, marginTop: '2px', background: 'rgba(5, 5, 10, 0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(126,34,206,0.3)', boxShadow: '0 0 10px rgba(156, 39, 176, 0.2)', overflow: 'hidden' }}>
                                  <img src={emblem} alt="AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </div>
                              <div style={{ flex: 1, overflowX: 'auto' }}>
                                 <MarkdownRenderer content={msg.content} onOpenStudio={setStudioCode} />
                              </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {msg.content && <MarkdownRenderer content={msg.content} onOpenStudio={setStudioCode} />}
                              {msg.image && (
                                  <img 
                                      src={msg.image} 
                                      alt="Attached" 
                                      style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--glass-border)', marginTop: msg.content ? '5px' : '0' }} 
                                  />
                              )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                    {isTyping && (
                      <div className="ai-message assistant" style={{ background: 'transparent', border: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '5px 0', color: 'var(--accent-secondary)' }}>
                          <div className="ai-think-spin" style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, rgba(29,78,216,0.4), rgba(126,34,206,0.4))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(126,34,206,0.6)', boxShadow: '0 0 15px rgba(156, 39, 176, 0.6)' }}>
                              <BrainCircuit size={16} color="var(--accent-secondary)" />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.8, color: 'var(--text-secondary)' }} className="animate-pulse">Thinking...</span>
                        </div>
                      </div>
                    )}
                    
                    {messages.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)', marginTop: '20px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Example Prompts:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[
                                    "Summarize all unresolved security gaps and their severity",
                                    "Draft a Splunk SPL query to detect Kerberoasting",
                                    "Generate an executive summary of the latest simulation results",
                                    "Help me translate a Sigma rule into Azure KQL"
                                ].map((suggestion, idx) => (
                                    <button 
                                        key={idx} 
                                        className="btn animate-fade-in" 
                                        style={{ 
                                            textAlign: 'left', 
                                            padding: '10px 15px', 
                                            fontSize: '0.85rem', 
                                            background: 'rgba(255,255,255,0.02)', 
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: 'none'
                                        }}
                                        onClick={() => {
                                            setInput(suggestion);
                                        }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                
                <div className="ai-input-area" style={{ background: 'rgba(0,0,0,0.2)', justifyContent: 'center', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  <div style={{ width: '100%', maxWidth: isFullScreen ? '1400px' : '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedImage && (
                          <div style={{ position: 'relative', width: 'fit-content', marginBottom: '5px' }}>
                              <img src={selectedImage} alt="Upload preview" style={{ height: '60px', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
                              <button 
                                  onClick={() => setSelectedImage(null)}
                                  style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      )}
                      <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '5px' }}>

                        <button 
                            className="btn" 
                            style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
                            title="Upload Image"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <ImageIcon size={18} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                        />
                    </div>
                    <input 
                      type="text" 
                      className="ai-input" 
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}
                      placeholder="Message AI Assistant..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button className="btn" style={{ padding: '10px 14px' }} onClick={sendMessage} disabled={isTyping || (!input.trim() && !selectedImage)}>
                        {isTyping ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
                </div>
            </>
        )}
      </div>
      
      {studioCode && (
        <CodeStudio 
          initialCode={studioCode} 
          onClose={() => setStudioCode(null)} 
        />
      )}
    </>
  );
}
