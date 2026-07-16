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

export function useTagsData() {
    const [targetTags, setTargetTags] = useState(() => {
        const saved = localStorage.getItem('target_tags');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });
    
    const [activeTagFilter, setActiveTagFilter] = useState('All');

    useEffect(() => {
        localStorage.setItem('target_tags', JSON.stringify(targetTags));
    }, [targetTags]);

    const addTag = useCallback((name) => {
        if (!name) return;
        const cleanName = name.trim();
        setTargetTags(prev => {
            if (prev.some(e => e.toLowerCase() === cleanName.toLowerCase())) return prev;
            return [...prev, cleanName].sort();
        });
    }, []);

    const deleteTag = useCallback((name) => {
        setTargetTags(prev => prev.filter(e => e !== name));
    }, []);

    return {
        targetTags,
        setTargetTags,
        addTag,
        deleteTag,
        activeTagFilter,
        setActiveTagFilter
    };
}
