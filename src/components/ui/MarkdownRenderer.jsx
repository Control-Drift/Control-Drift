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
import { Code2, Terminal } from 'lucide-react';
import CopyButton from './CopyButton';

function CodeBlock({ code, language, onOpenStudio }) {
  const cleanCode = (code || '').trim();
  const langLabel = (language || 'script').toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        background: '#05070d',
        borderRadius: '8px',
        margin: '12px 0 18px 0',
        fontFamily: 'monospace',
        fontSize: '0.86rem',
        color: '#10b981',
        overflow: 'hidden',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.85)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(16, 185, 129, 0.08)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.6px',
            color: '#34d399'
          }}
        >
          <Terminal size={11} />
          {langLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CopyButton text={cleanCode} />
          {onOpenStudio && (
            <button
              type="button"
              onClick={() => onOpenStudio(cleanCode)}
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--accent-secondary)',
                color: 'var(--accent-secondary)',
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 'bold'
              }}
            >
              <Code2 size={12} /> OPEN IN CODE STUDIO
            </button>
          )}
        </div>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.55
        }}
      >
        {cleanCode}
      </pre>
    </div>
  );
}

export function normalizeStructuredMarkdown(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      const candidateHeading = trimmed
        .replace(/^(?:#{1,6}\s+|\d+\.\s+)/, '')
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/:$/, '')
        .trim();
      if (
        /^(Simulation Overview|Recommended Validation Procedures|Simulation Teardown & Cleanup|Operational Infrastructure & Tooling|Executive Summary|Key Findings|Risk Analysis|Recommendations)$/i.test(
          candidateHeading
        )
      ) {
        return `## ${candidateHeading}`;
      }

      const candidatePhase = trimmed
        .replace(/^(?:#{1,6}\s+|\d+\.\s+|[-*]\s+)/, '')
        .replace(/^\*\*|\*\*$/g, '')
        .trim();
      if (/^Phase\s+\d+\s*:/i.test(candidatePhase)) {
        return `### ${candidatePhase}`;
      }

      return line;
    })
    .join('\n');
}

const inlineCodeStyle = {
  background: 'rgba(168, 85, 247, 0.14)',
  border: '1px solid rgba(168, 85, 247, 0.3)',
  color: '#67e8f9',
  padding: '1px 6px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '0.84em'
};

export default function MarkdownRenderer({ content, style = {}, onOpenStudio }) {
  const renderInline = (str, keyPrefix = 'in') => {
    if (!str) return null;
    const tokenRegex = /(\*\*`[^`\n]+`\*\*|`[^`\n]+`|\*\*[\s\S]+?\*\*|\*[^*\n]+\*)/g;
    const parts = str.split(tokenRegex);

    return parts.map((part, idx) => {
      if (!part) return null;
      const key = `${keyPrefix}-${idx}`;

      if (part.startsWith('**`') && part.endsWith('`**') && part.length > 6) {
        return (
          <code key={key} style={{ ...inlineCodeStyle, fontWeight: 700 }}>
            {part.slice(3, -3)}
          </code>
        );
      }

      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={key} style={inlineCodeStyle}>
            {part.slice(1, -1)}
          </code>
        );
      }

      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const inner = part.slice(2, -2);
        return (
          <strong key={key} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            { inner.includes('`') ? renderInline(inner, `${key}-b`) : inner }
          </strong>
        );
      }

      if (
        part.startsWith('*') &&
        part.endsWith('*') &&
        part.length > 2 &&
        !part.startsWith('* ') &&
        !part.endsWith(' *')
      ) {
        return (
          <em key={key} style={{ color: 'var(--accent-secondary)' }}>
            {part.slice(1, -1)}
          </em>
        );
      }

      return part;
    });
  };

  const formatMarkdown = (text) => {
    if (!text) return null;
    const normalized = normalizeStructuredMarkdown(text);
    const blocks = normalized.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, index) => {
      if (block.startsWith('```') && block.endsWith('```')) {
        const langMatch = block.match(/^```([a-zA-Z0-9_-]*)\n?/);
        const language = langMatch && langMatch[1] ? langMatch[1] : 'script';
        const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '');
        return <CodeBlock key={index} code={code} language={language} onOpenStudio={onOpenStudio} />;
      }

      return (
        <div key={index} style={{ color: 'var(--text-primary)' }}>
          {block.split('\n').map((line, j) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            if (trimmed === '---') {
              return (
                <hr
                  key={`${index}-${j}`}
                  style={{ border: 0, height: '1px', background: 'var(--glass-border)', margin: '16px 0' }}
                />
              );
            }
            if (trimmed.startsWith('#### ')) {
              return (
                <h4
                  key={`${index}-${j}`}
                  style={{
                    color: 'var(--text-primary)',
                    marginTop: '16px',
                    marginBottom: '6px',
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    letterSpacing: '0.2px'
                  }}
                >
                  {renderInline(trimmed.substring(5).replace(/^\*\*|\*\*$/g, ''), `h4-${index}-${j}`)}
                </h4>
              );
            }
            if (trimmed.startsWith('### ')) {
              return (
                <h3
                  key={`${index}-${j}`}
                  style={{
                    color: 'var(--accent-secondary)',
                    marginTop: '18px',
                    marginBottom: '8px',
                    fontSize: '1.06rem',
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}
                >
                  {renderInline(trimmed.substring(4).replace(/^\*\*|\*\*$/g, ''), `h3-${index}-${j}`)}
                </h3>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h2
                  key={`${index}-${j}`}
                  style={{
                    color: '#d8b4fe',
                    marginTop: j === 0 && index === 0 ? '4px' : '22px',
                    marginBottom: '10px',
                    borderBottom: '1px solid rgba(168, 85, 247, 0.28)',
                    paddingBottom: '6px',
                    fontSize: '1.16rem',
                    fontWeight: 800,
                    letterSpacing: '0.3px'
                  }}
                >
                  {renderInline(trimmed.substring(3).replace(/^\*\*|\*\*$/g, ''), `h2-${index}-${j}`)}
                </h2>
              );
            }
            if (trimmed.startsWith('# ')) {
              return (
                <h1
                  key={`${index}-${j}`}
                  style={{
                    color: 'var(--text-primary)',
                    marginTop: '22px',
                    marginBottom: '12px',
                    fontSize: '1.35rem',
                    fontWeight: 800
                  }}
                >
                  {renderInline(trimmed.substring(2).replace(/^\*\*|\*\*$/g, ''), `h1-${index}-${j}`)}
                </h1>
              );
            }
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              return (
                <div
                  key={`${index}-${j}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginLeft: '8px',
                    marginBottom: '6px',
                    lineHeight: '1.55',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 900, lineHeight: '1.55' }}>•</span>
                  <span style={{ flex: 1 }}>{renderInline(trimmed.substring(2), `li-${index}-${j}`)}</span>
                </div>
              );
            }
            if (/^\d+\.\s/.test(trimmed)) {
              const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
              return (
                <div
                  key={`${index}-${j}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginLeft: '8px',
                    marginBottom: '6px',
                    lineHeight: '1.55',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span
                    style={{
                      color: 'var(--accent-secondary)',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      minWidth: '20px'
                    }}
                  >
                    {numMatch ? numMatch[1] : '•'}
                  </span>
                  <span style={{ flex: 1 }}>
                    {renderInline(numMatch ? numMatch[2] : trimmed.replace(/^\d+\.\s/, ''), `ol-${index}-${j}`)}
                  </span>
                </div>
              );
            }
            if (trimmed.startsWith('> ')) {
              return (
                <div
                  key={`${index}-${j}`}
                  style={{
                    borderLeft: '3px solid var(--accent-secondary)',
                    margin: '10px 0',
                    background: 'rgba(192, 132, 252, 0.06)',
                    padding: '10px 14px',
                    borderRadius: '0 6px 6px 0',
                    fontStyle: 'italic',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.55',
                    fontSize: '0.9rem'
                  }}
                >
                  {renderInline(trimmed.substring(2), `bq-${index}-${j}`)}
                </div>
              );
            }

            return (
              <p
                key={`${index}-${j}`}
                style={{
                  margin: '8px 0',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              >
                {renderInline(trimmed, `p-${index}-${j}`)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div style={{ lineHeight: '1.6', fontSize: '0.92rem', wordBreak: 'break-word', ...style }}>
      {formatMarkdown(content)}
    </div>
  );
}
