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

/**
 * Calculates the average coverage status for a given array of statuses based on strict rules.
 * 
 * Rules:
 * - If the array is completely empty of valid scores, returns 'unknown' or 'na'.
 * - If ALL elements are 'high', returns 'high'.
 * - If there are <= 2 elements, returns the lowest (pessimistic) score.
 * - If there are > 2 elements, calculates a weighted average (high=3, medium=2, minimal=1, low=0).
 * - A high average (>= 2.5) is downgraded to 'medium' if not ALL elements were 'high'.
 * 
 * @param {Array<string>} statuses - Array of string statuses (e.g. 'high', 'medium', 'minimal', 'low', 'na', 'unknown')
 * @returns {string} The resolved status string.
 */
export const calculateAverageStatus = (statuses) => {
    const valid = statuses.filter(s => s === 'high' || s === 'medium' || s === 'minimal' || s === 'low');
    
    if (valid.length === 0) {
        if (statuses.length > 0 && statuses.every(s => s === 'na')) return 'na';
        return 'unknown';
    }
    
    const allOptimal = valid.every(s => s === 'high');
    if (allOptimal) return 'high';

    let totalScore = 0;
    valid.forEach(s => {
        if (s === 'high') totalScore += 3;
        else if (s === 'medium') totalScore += 2;
        else if (s === 'minimal') totalScore += 1;
    });
    const avg = totalScore / valid.length;
    
    let finalStatus = 'low';
    if (avg >= 2.5) finalStatus = 'high';
    else if (avg >= 1.5) finalStatus = 'medium';
    else if (avg >= 0.5) finalStatus = 'minimal';
    
    // Prevent a single non-optimal event from averaging out to 'Optimal' if the rest were 'Optimal'
    if (finalStatus === 'high' && !allOptimal) {
        finalStatus = 'medium';
    }
    
    return finalStatus;
};
