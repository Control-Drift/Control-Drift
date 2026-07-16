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

// src/lib/cryptoUtils.js

const deriveKey = async (password, salt) => {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

export const encryptData = async (dataString, password) => {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    
    const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(dataString)
    );

    const cipherArray = new Uint8Array(cipherBuffer);
    const combined = new Uint8Array(salt.length + iv.length + cipherArray.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(cipherArray, salt.length + iv.length);
    
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i]);
    }
    return window.btoa(binary);
};

export const decryptData = async (encryptedBase64, password) => {
    try {
        const binary = window.atob(encryptedBase64);
        const combined = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            combined[i] = binary.charCodeAt(i);
        }

        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const ciphertext = combined.slice(28);

        const key = await deriveKey(password, salt);
        
        const plainBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        return dec.decode(plainBuffer);
    } catch (e) {
        throw new Error("Decryption failed. Incorrect password or corrupt file.");
    }
};
