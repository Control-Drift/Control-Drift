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

// src/lib/ai/core.js

export class AiAdapter {
    constructor(config) {
        this.config = config || {};
    }

    async generateContent(prompt, systemInstruction, maxTokens) {
        throw new Error('Not implemented');
    }

    async ping() {
        // Default fallback ping for backward compatibility if a provider doesn't override it with a lighter endpoint
        await this.generateContent('Say OK', 'You are a system checking connection status', 5);
        return true;
    }

    async generateContentStream(prompt, systemInstruction, onChunk, options) {
        throw new Error('Not implemented');
    }
}

export const aiManager = {
    adapter: null,

    async initialize(config) {
        const { GenericAPIAdapter } = await import('./adapters/GenericAPIAdapter.js');
        this.adapter = new GenericAPIAdapter(config);
        return this.adapter;
    },

    get() {
        if (!this.adapter) {
            throw new Error('AI adapter not initialized.');
        }
        return this.adapter;
    }
};
