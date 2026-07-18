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

import { useState, useCallback, useEffect } from 'react';
import { obfuscate, deobfuscate } from '../lib/obfuscator';
import { aiManager } from '../lib/ai/core.js';

export function useAiData(addToast, globalAiConfig) {
    const [activeAiContext, setActiveAiContext] = useState(null);
    const [localAiSettings, setLocalAiSettings] = useState(() => {
        const saved = localStorage.getItem('ai_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Deobfuscate API key if it exists
            if (parsed.apiKey) {
                parsed.apiKey = deobfuscate(parsed.apiKey);
            }
            return parsed;
        }
        return {
           endpointUrl: '',
           model: '',
           apiKey: '',
           customHeaders: '',
           isValidated: false
        };
    });

    // Determine effective AI settings based on global vs local
    const aiSettings = globalAiConfig ? {
        endpointUrl: globalAiConfig.endpointUrl || localAiSettings.endpointUrl,
        model: globalAiConfig.model || localAiSettings.model,
        apiKey: globalAiConfig.apiKey || 'proxy-key', // Dummy key to pass validation if proxy
        customHeaders: localAiSettings.customHeaders,
        isValidated: true, // Always trust global config
        isProxy: !!globalAiConfig.proxy || !!globalAiConfig.enabled
    } : localAiSettings;

    // We only expose setAiSettings to update the LOCAL settings (if allowed)
    const setAiSettings = useCallback((newSettings) => {
        if (typeof newSettings === 'function') {
            setLocalAiSettings(newSettings);
        } else {
            setLocalAiSettings(newSettings);
        }
    }, []);

    useEffect(() => {
        const toSave = { ...localAiSettings };
        if (toSave.apiKey) {
            toSave.apiKey = obfuscate(toSave.apiKey);
        }
        localStorage.setItem('ai_settings', JSON.stringify(toSave));
    }, [localAiSettings]);

    const generateAIContent = useCallback(async (prompt, systemInstruction, maxTokens = null, options = {}) => {
        const { apiKey, endpointUrl } = aiSettings;
        if (!apiKey && (!endpointUrl || endpointUrl.includes('api.openai.com') || endpointUrl === '')) {
            throw new Error(`API Key is missing. Please configure it in Settings.`);
        }
        
        if (prompt && prompt.length > 200000) {
            throw new Error('Input text is too large for the AI to process. Please reduce the size of the input to under 200,000 characters.');
        }

        try {
            const adapter = await aiManager.initialize(aiSettings);
            return await adapter.generateContent(prompt, systemInstruction, maxTokens, options);
        } catch (err) {
            console.error('AI Generation Error:', err);
            let errorMsg = err.message || 'Unknown error occurred';
            if (errorMsg.includes('context_length_exceeded') || errorMsg.includes('maximum context length')) {
                errorMsg = 'Input text exceeds the maximum context length allowed by the AI provider. Please shorten the input data and try again.';
            }
            if (addToast) {
                addToast(`AI Generation Failed: ${errorMsg}`, 'error');
            }
            throw new Error(errorMsg);
        }
    }, [aiSettings, addToast]);

    const generateAIContentStream = useCallback(async (prompt, systemInstruction, onChunk, options = {}) => {
        const { apiKey, endpointUrl } = aiSettings;
        if (!apiKey && (!endpointUrl || endpointUrl.includes('api.openai.com') || endpointUrl === '')) {
            throw new Error(`API Key is missing. Please configure it in Settings.`);
        }
        
        if (prompt && prompt.length > 200000) {
            throw new Error('Input text is too large for the AI to process. Please reduce the size of the input to under 200,000 characters.');
        }

        try {
            const adapter = await aiManager.initialize(aiSettings);
            return await adapter.generateContentStream(prompt, systemInstruction, onChunk, options);
        } catch (err) {
            console.error('AI Stream Generation Error:', err);
            let errorMsg = err.message || 'Unknown error occurred';
            if (errorMsg.includes('context_length_exceeded') || errorMsg.includes('maximum context length')) {
                errorMsg = 'Input text exceeds the maximum context length allowed by the AI provider. Please shorten the input data and try again.';
            }
            if (addToast) {
                addToast(`AI Stream Generation Failed: ${errorMsg}`, 'error');
            }
            throw new Error(errorMsg);
        }
    }, [aiSettings, addToast]);

    const isAiActive = !!aiSettings?.isValidated;

    return {
        aiSettings, setAiSettings,
        activeAiContext, setActiveAiContext,
        generateAIContent, generateAIContentStream,
        isAiActive
    };
}
