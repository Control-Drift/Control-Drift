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

import { renderHook, act } from '@testing-library/react';
import { useAiData } from '../hooks/useAiData';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the obfuscator to avoid actual obfuscation logic during tests
vi.mock('../lib/obfuscator', () => ({
    obfuscate: (val) => val,
    deobfuscate: (val) => val
}));

// Mock the Google Generative AI to simulate API failures
vi.mock('@google/generative-ai', () => {
    class MockGoogleGenerativeAI {
        getGenerativeModel() {
            return {
                generateContent: vi.fn().mockRejectedValue(new Error('Mocked API Failure')),
                generateContentStream: vi.fn().mockRejectedValue(new Error('Mocked API Failure'))
            };
        }
    }
    return {
        GoogleGenerativeAI: MockGoogleGenerativeAI
    };
});

describe('useAiData Error Handling', () => {
    let mockAddToast;

    beforeEach(() => {
        mockAddToast = vi.fn();
        localStorage.clear();
        // Setup default config so the AI calls attempt to run rather than failing on missing keys
        localStorage.setItem('ai_settings', JSON.stringify({ 
            provider: 'Gemini', 
            apiKey: 'fake-key-for-testing', 
            model: 'gemini-3.5-flash' 
        }));
    });

    it('should call addToast with error details when generateAIContent fails', async () => {
        const { result } = renderHook(() => useAiData(mockAddToast));

        await expect(result.current.generateAIContent('Hello')).rejects.toThrow('Mocked API Failure');

        expect(mockAddToast).toHaveBeenCalledTimes(1);
        expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringContaining('AI Generation Failed: Mocked API Failure'));
    });

    it('should call addToast with error details when generateAIContentStream fails', async () => {
        const { result } = renderHook(() => useAiData(mockAddToast));

        await expect(result.current.generateAIContentStream('Hello', 'system', () => {})).rejects.toThrow('Mocked API Failure');

        expect(mockAddToast).toHaveBeenCalledTimes(1);
        expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringContaining('AI Stream Generation Failed: Mocked API Failure'));
    });
});
