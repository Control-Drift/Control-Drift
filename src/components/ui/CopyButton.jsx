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

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({
  text,
  label = 'COPY',
  copiedLabel = 'COPIED',
  style = {},
  iconOnly = false,
  className = '',
  iconSize = 12,
  onCopySuccess
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e?.stopPropagation?.();
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      if (onCopySuccess) onCopySuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
      title={copied ? "Copied to clipboard!" : "Copy to clipboard"}
      style={{
        background: copied ? 'rgba(16, 185, 129, 0.2)' : 'var(--glass-bg, rgba(255, 255, 255, 0.05))',
        border: `1px solid ${copied ? '#10b981' : 'rgba(16, 185, 129, 0.4)'}`,
        color: copied ? '#10b981' : '#10b981',
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        transition: 'all 0.15s ease',
        ...style
      }}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      {!iconOnly && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );
}
