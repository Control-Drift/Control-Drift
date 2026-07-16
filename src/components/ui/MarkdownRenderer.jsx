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

import React from 'react';
import { Code2, BrainCircuit } from 'lucide-react';

export default function MarkdownRenderer({ content, style = {}, onOpenStudio }) {
  const renderBold = (str) => {
     const parts = str.split(/(\*\*.*?\*\*)/g);
     return parts.map((bp, i) => {
       if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={i} style={{ color: 'var(--text-primary)' }}>{bp.slice(2, -2)}</strong>;
       }
       
       const italicParts = bp.split(/(\*[^*]+\*)/g);
       return italicParts.map((ip, j) => {
           if (ip.startsWith('*') && ip.endsWith('*') && ip.length > 2 && !ip.startsWith('* ') && !ip.endsWith(' *')) {
               return <em key={`${i}-${j}`} style={{ color: 'var(--accent-secondary)' }}>{ip.slice(1, -1)}</em>;
           }
           return ip;
       });
     });
  };

  const formatMarkdown = (text) => {
    if (!text) return null;
    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, index) => {

      if (block.startsWith('```') && block.endsWith('```')) {
        const code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
        return (
          <div key={index} style={{ position: 'relative', background: '#000', padding: '16px', borderRadius: '8px', margin: '16px 0', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.8)' }}>
            {onOpenStudio && (
              <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <button 
                    onClick={() => onOpenStudio(code)}
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', zIndex: 10 }}
                  >
                    <Code2 size={12} /> OPEN IN CODE STUDIO
                  </button>
              </div>
            )}
            <pre style={{ margin: 0, paddingTop: onOpenStudio ? '20px' : '0' }}>{code}</pre>
          </div>
        );
      }
      
      return (
        <div key={index} style={{ color: 'var(--text-primary)' }}>
          {block.split('\n').map((line, j) => {
            if (!line.trim()) return <br key={`${index}-${j}`} />;
            const trimmed = line.trim();
            if (trimmed === '---') return <hr key={`${index}-${j}`} style={{ border: 0, height: '1px', background: 'var(--glass-border)', margin: '20px 0' }} />;
            if (trimmed.startsWith('#### ')) return <h4 key={`${index}-${j}`} style={{ color: 'var(--text-primary)', marginTop: '20px', marginBottom: '8px', fontSize: '1.05rem', letterSpacing: '0.2px' }}>{renderBold(trimmed.substring(5))}</h4>;
            if (trimmed.startsWith('### ')) return <h3 key={`${index}-${j}`} style={{ color: 'var(--accent-secondary)', marginTop: '25px', marginBottom: '10px', fontSize: '1.2rem', letterSpacing: '0.5px' }}>{renderBold(trimmed.substring(4))}</h3>;
            if (trimmed.startsWith('## ')) return <h2 key={`${index}-${j}`} style={{ color: 'var(--text-primary)', marginTop: '30px', marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', fontSize: '1.4rem' }}>{renderBold(trimmed.substring(3))}</h2>;
            if (trimmed.startsWith('# ')) return <h1 key={`${index}-${j}`} style={{ color: 'var(--text-primary)', marginTop: '35px', marginBottom: '15px', fontSize: '1.8rem' }}>{renderBold(trimmed.substring(2))}</h1>;
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return <li key={`${index}-${j}`} style={{ marginLeft: '25px', marginBottom: '8px', lineHeight: '1.6', color: 'var(--text-primary)' }}>{renderBold(trimmed.substring(2))}</li>;
            if (/^\d+\.\s/.test(trimmed)) return <li key={`${index}-${j}`} style={{ marginLeft: '25px', marginBottom: '8px', lineHeight: '1.6', listStyleType: 'decimal', color: 'var(--text-primary)', paddingLeft: '5px' }}>{renderBold(trimmed.replace(/^\d+\.\s/, ''))}</li>;
            if (trimmed.startsWith('> ')) {
              return (
                <div key={`${index}-${j}`} style={{ borderLeft: '4px solid var(--accent-secondary)', margin: '20px 0', background: 'rgba(192, 132, 252, 0.05)', padding: '15px 20px', borderRadius: '0 8px 8px 0', fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {renderBold(trimmed.substring(2))}
                </div>
              );
            }
            
            return <p key={`${index}-${j}`} style={{ margin: '12px 0', lineHeight: '1.7', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{renderBold(trimmed)}</p>;
          })}
        </div>
      );
    });
  };

  return (
    <div style={{ ...style, overflowY: 'auto' }}>
      {formatMarkdown(content)}
    </div>
  );
}
