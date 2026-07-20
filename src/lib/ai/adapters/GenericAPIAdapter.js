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

// src/lib/ai/adapters/GenericAPIAdapter.js
import { AiAdapter } from '../core.js';

export class GenericAPIAdapter extends AiAdapter {
    async generateContent(prompt, systemInstruction, maxTokens, options = {}) {
        const { endpointUrl, apiKey, model, customHeaders } = this.config;
        
        const url = endpointUrl;
        const targetModel = model || 'gpt-4o';

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        if (customHeaders) {
            try {
                const parsedHeaders = JSON.parse(customHeaders);
                Object.assign(headers, parsedHeaders);
            } catch (e) {
                console.warn('Failed to parse custom AI headers as JSON:', e);
            }
        }
        
        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
        messages.push({ role: 'user', content: prompt });
        
        const apiOptions = { ...options };
        delete apiOptions.imageData;
        delete apiOptions.maxTokens;

        const bodyParams = { model: targetModel, messages, ...apiOptions };
        if (maxTokens) bodyParams.max_tokens = maxTokens;

        const fetchPromise = fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyParams),
            credentials: 'same-origin'
        });
        
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("API Timeout (180s)")), 180000));
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API Error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async generateContentStream(prompt, systemInstruction, onChunk, options = {}) {
        const { maxTokens, imageData } = options;
        const { endpointUrl, apiKey, model, customHeaders } = this.config;
        
        const url = endpointUrl;
        const targetModel = model || 'gpt-4o';

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        if (customHeaders) {
            try {
                const parsedHeaders = JSON.parse(customHeaders);
                Object.assign(headers, parsedHeaders);
            } catch (e) {
                console.warn('Failed to parse custom AI headers as JSON:', e);
            }
        }
        
        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
        
        if (imageData) {
            messages.push({
                role: 'user',
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: imageData } }
                ]
            });
        } else {
            messages.push({ role: 'user', content: prompt });
        }
        
        const apiOptions = { ...options };
        delete apiOptions.imageData;
        delete apiOptions.maxTokens;

        const bodyParams = {
            model: targetModel,
            messages,
            stream: true,
            ...apiOptions
        };
        if (maxTokens) bodyParams.max_tokens = maxTokens;

        const fetchPromise = fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyParams),
            credentials: 'same-origin'
        });
        
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("API Timeout (180s)")), 180000));
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API Error (${response.status}): ${errorText}`);
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            let content = '';
            if (data.choices && data.choices.length > 0) {
                content = data.choices[0].message?.content || data.choices[0].delta?.content || data.choices[0].text || '';
            }
            if (content) {
                onChunk(content);
            }
            return content;
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = '';
        let buffer = '';
        
        const processBuffer = (force = false) => {
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1 || (force && buffer.length > 0)) {
                let line;
                if (newlineIndex !== -1) {
                    line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                } else {
                    line = buffer.trim();
                    buffer = '';
                }
                
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') return true;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.choices && parsed.choices.length > 0) {
                            const choice = parsed.choices[0];
                            const deltaContent = choice.delta?.content || choice.message?.content || choice.text || '';
                            if (deltaContent) {
                                fullText += deltaContent;
                                onChunk(fullText);
                            }
                            if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
                                return true;
                            }
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
            return false;
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                processBuffer(true);
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            if (processBuffer(false)) {
                break;
            }
        }
        return fullText;
    }
}
