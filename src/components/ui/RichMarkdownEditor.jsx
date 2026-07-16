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

import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import TurndownService from 'turndown';
import { marked } from 'marked';

import DOMPurify from 'dompurify';

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
// Disable escaping to prevent mangling of code payloads (e.g., PowerShell brackets and asterisks)
turndownService.escape = function (string) {
    return string;
};

const getSafeMarkdown = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(item => `- ${item}`).join('\n');
    return JSON.stringify(val, null, 2);
};

const convertMarkdownToQuillHtml = (markdown) => {
    const rawHtml = marked.parse(getSafeMarkdown(markdown));
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    // ReactQuill expects code blocks to have the ql-syntax class.
    // marked outputs <pre><code>...</code></pre>.
    // This regex removes the inner <code> tags and injects Quill's required class.
    return cleanHtml.replace(/<pre><code[^>]*>/gi, '<pre class="ql-syntax" spellcheck="false">').replace(/<\/code><\/pre>/gi, '</pre>');
};

export default function RichMarkdownEditor({ value, onChange, placeholder, minHeight = '100px', readOnly = false, style = {} }) {
  const [internalHtml, setInternalHtml] = useState(() => {
      try {
          return convertMarkdownToQuillHtml(value);
      } catch (e) {
          return '';
      }
  });
  const quillRef = useRef(null);
  const lastSentMarkdown = useRef(value);

  useEffect(() => {
    // Only parse and update HTML if the incoming value differs from what the editor just produced.
    // This prevents the editor from stripping empty newlines or interrupting paste events.
    if (value !== lastSentMarkdown.current) {
       try {
           const quillHtml = convertMarkdownToQuillHtml(value);
           setInternalHtml(quillHtml);
           lastSentMarkdown.current = value;
       } catch (err) {
           console.error("Marked Parse Error:", err);
           setInternalHtml('');
       }
    }
  }, [value]);

  const handleChange = (content, delta, source, editor) => {
    setInternalHtml(content);
    if (!readOnly && onChange) {
       // Turndown requires <pre><code> for fenced code blocks, but Quill outputs flat <pre>.
       const turndownFriendlyContent = content.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre><code>$1</code></pre>');
       const markdown = turndownService.turndown(turndownFriendlyContent);
       
       if (markdown !== lastSentMarkdown.current) {
           lastSentMarkdown.current = markdown;
           onChange(markdown);
       }
    }
  };

  const modules = React.useMemo(() => ({
    toolbar: readOnly ? false : [
      ['bold', 'italic', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['blockquote', 'code-block'],
      ['clean']
    ]
  }), [readOnly]);

  if (readOnly) {
      return (
          <div className="rich-markdown-editor read-only" style={{ ...style }}>
              <div className="ql-editor" style={{ minHeight, color: 'var(--text-primary)', padding: '12px 15px' }} dangerouslySetInnerHTML={{ __html: internalHtml }} />
          </div>
      );
  }

  return (
    <div className="rich-markdown-editor" style={{ ...style }} onKeyDown={e => e.stopPropagation()}>
      <ReactQuill 
        ref={quillRef}
        theme="snow"
        value={internalHtml}
        onChange={handleChange}
        readOnly={false}
        modules={modules}
        placeholder={placeholder}
        style={{ minHeight, color: 'var(--text-primary)' }}
      />
    </div>
  );
}
