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

import { describe, it, expect } from 'vitest';
import { obfuscate, deobfuscate } from '../lib/obfuscator';

describe('obfuscator utility', () => {
  it('should obfuscate and deobfuscate a simple string', () => {
    const originalText = 'Hello World 123!';
    const obfuscated = obfuscate(originalText);
    expect(obfuscated).not.toBe(originalText);
    
    const deobfuscated = deobfuscate(obfuscated);
    expect(deobfuscated).toBe(originalText);
  });

  it('should handle empty, null, or undefined values gracefully', () => {
    expect(obfuscate('')).toBe('');
    expect(obfuscate(null)).toBe(null);
    expect(obfuscate(undefined)).toBe(undefined);

    expect(deobfuscate('')).toBe('');
    expect(deobfuscate(null)).toBe(null);
    expect(deobfuscate(undefined)).toBe(undefined);
  });

  it('should not alter known plaintext API keys in deobfuscate', () => {
    // If key starts with sk- or AIza, deobfuscate should return it as-is
    const openAiKey = 'sk-proj-1234567890abcdef';
    const googleKey = 'AIzaSyD-abcdefghijklmnopqrst';
    
    expect(deobfuscate(openAiKey)).toBe(openAiKey);
    expect(deobfuscate(googleKey)).toBe(googleKey);
  });
});
