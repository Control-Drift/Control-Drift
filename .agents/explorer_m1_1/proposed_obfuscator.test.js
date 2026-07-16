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
