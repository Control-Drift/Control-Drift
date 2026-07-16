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

// Hardcoded rotating byte array ("salt") to disrupt regex scrapers
const SALT = [0x5A, 0x3F, 0x8C, 0x11, 0x7E, 0x2B, 0x9D, 0x44];

/**
 * Encodes a string to Base64 in a Unicode-safe way.
 */
function toBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
    }));
}

/**
 * Decodes a Base64 string to a Unicode string.
 */
function fromBase64(str) {
    return decodeURIComponent(atob(str).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

/**
 * Applies a robust multi-pass obfuscation to a string.
 * Step 1: Base64 encode
 * Step 2: Bitwise XOR against hardcoded salt
 * Step 3: Reverse the string
 * Step 4: Base64 encode the result again
 */
export function obfuscate(text) {
    if (!text) return text;
    try {
        // Pass 1: Base64
        const b64 = toBase64(text);
        
        // Pass 2: XOR with salt
        let xored = '';
        for (let i = 0; i < b64.length; i++) {
            xored += String.fromCharCode(b64.charCodeAt(i) ^ SALT[i % SALT.length]);
        }
        
        // Pass 3: Reverse
        const reversed = xored.split('').reverse().join('');
        
        // Pass 4: Base64 again
        return btoa(reversed);
    } catch (e) {
        console.error("Obfuscation failed:", e);
        return text;
    }
}

/**
 * Reverses the obfuscation applied by `obfuscate`.
 */
export function deobfuscate(cipherText) {
    if (!cipherText) return cipherText;
    try {
        // The first check is to ensure we don't accidentally scramble an already plaintext key 
        // that was saved prior to this update.
        // Base64 regex check
        const isBase64 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/.test(cipherText);
        if (!isBase64 && cipherText.length > 0 && !cipherText.startsWith('ey')) {
             // Heuristic: If it has spaces, it's not base64. If it starts with typical API key prefixes (sk-), it's plain text.
             if (cipherText.startsWith('sk-') || cipherText.startsWith('AIza')) {
                 return cipherText;
             }
        }

        // Pass 4: Reverse Base64
        const reversed = atob(cipherText);
        
        // Pass 3: Reverse string
        const xored = reversed.split('').reverse().join('');
        
        // Pass 2: Reverse XOR
        let b64 = '';
        for (let i = 0; i < xored.length; i++) {
            b64 += String.fromCharCode(xored.charCodeAt(i) ^ SALT[i % SALT.length]);
        }
        
        // Pass 1: Reverse Base64
        return fromBase64(b64);
    } catch (e) {
        // If it fails to deobfuscate, it might be an old plaintext key. Return as-is.
        return cipherText;
    }
}
