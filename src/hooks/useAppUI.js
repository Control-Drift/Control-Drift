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

import { useState, useCallback, useRef } from 'react';
import { useToast } from '../components/ui/Toast';

export function useAppUI() {
    const { addToast } = useToast();
    
    // Confirm Modal Context
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

    const confirmAction = useCallback((message, onConfirm) => {
        setConfirmConfig({ isOpen: true, message, onConfirm });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
    }, []);

    // Sync Queue & Offline Toast Context
    const isOfflineRef = useRef(false);
    const queuedSuccessToast = useRef(null);

    const requestSuccessToast = useCallback((message) => {
        queuedSuccessToast.current = message;
    }, []);

    const checkSyncQueue = useCallback(async (dbAdapter, isAuthenticated) => {
        if (!dbAdapter || !isAuthenticated || navigator.onLine === false) return;
        const queueStr = localStorage.getItem('syncQueue');
        if (!queueStr) return;
        
        const queue = JSON.parse(queueStr);
        const keys = Object.keys(queue);
        if (keys.length > 0) {
            let successCount = 0;
            for (const key of keys) {
                try {
                    await dbAdapter.saveData(key, queue[key]);
                    delete queue[key];
                    successCount++;
                } catch (e) {
                    break; 
                }
            }
            localStorage.setItem('syncQueue', JSON.stringify(queue));
            if (successCount > 0 && Object.keys(queue).length === 0) {
                isOfflineRef.current = false;
                addToast("Connection restored. Synchronized pending changes to database.", "success");
            }
        }
    }, [addToast]);

    return {
        confirmConfig, confirmAction, closeConfirm,
        requestSuccessToast, checkSyncQueue, addToast
    };
}
