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
import { calculateAverageStatus } from './mitreUtils';

describe('MITRE Coverage Aggregation Logic (calculateAverageStatus)', () => {

    it('should return "unknown" when there are no valid statuses', () => {
        expect(calculateAverageStatus([])).toBe('unknown');
        expect(calculateAverageStatus(['unknown', 'unknown'])).toBe('unknown');
    });

    it('should return "na" when only "na" statuses are provided', () => {
        expect(calculateAverageStatus(['na'])).toBe('na');
        expect(calculateAverageStatus(['na', 'na'])).toBe('na');
    });
    
    it('should return "unknown" if there are mixed "unknown" and "na", leaning towards unknown', () => {
        expect(calculateAverageStatus(['na', 'unknown'])).toBe('unknown');
    });

    it('should perfectly return "high" if ALL elements are "high", regardless of array size', () => {
        expect(calculateAverageStatus(['high'])).toBe('high');
        expect(calculateAverageStatus(['high', 'high'])).toBe('high');
        expect(calculateAverageStatus(['high', 'high', 'high', 'high'])).toBe('high');
    });

    describe('Pessimistic fallback (<= 2 elements)', () => {
        it('should return the lowest score if there are exactly 2 elements', () => {
            expect(calculateAverageStatus(['high', 'low'])).toBe('low');
            expect(calculateAverageStatus(['medium', 'low'])).toBe('low');
            expect(calculateAverageStatus(['high', 'minimal'])).toBe('minimal');
            expect(calculateAverageStatus(['medium', 'minimal'])).toBe('minimal');
            expect(calculateAverageStatus(['high', 'medium'])).toBe('medium');
        });

        it('should ignore "unknown" and "na" and evaluate only valid statuses', () => {
            // Valid elements length is 2 ('high', 'low')
            expect(calculateAverageStatus(['high', 'low', 'unknown', 'na'])).toBe('low');
            // Valid elements length is 1 ('medium')
            expect(calculateAverageStatus(['medium', 'unknown', 'na'])).toBe('medium');
        });
    });

    describe('Weighted average (>= 3 elements)', () => {
        it('should return "high" ONLY if average >= 2.5 AND ALL elements are high (which is handled by allOptimal)', () => {
            // Math: 3+3+1 = 7. 7/3 = 2.333. 2.333 -> 'medium'
            expect(calculateAverageStatus(['high', 'high', 'minimal'])).toBe('medium');
        });

        it('should downgrade a mathematically "high" average to "medium" if a non-high exists (False Positive Prevention)', () => {
            // Math: 3+3+3+3+3+1 = 16. 16/6 = 2.666. 2.666 >= 2.5 (High)
            // But because of the 'minimal', it MUST downgrade to 'medium' to prevent false positives.
            expect(calculateAverageStatus(['high', 'high', 'high', 'high', 'high', 'minimal'])).toBe('medium');
        });

        it('should return "medium" for an average between 1.5 and 2.49', () => {
            // Math: 2+2+1 = 5. 5/3 = 1.666 -> 'medium'
            expect(calculateAverageStatus(['medium', 'medium', 'minimal'])).toBe('medium');
            
            // Math: 3+2+0 = 5. 5/3 = 1.666 -> 'medium'
            expect(calculateAverageStatus(['high', 'medium', 'low'])).toBe('medium');
        });

        it('should return "minimal" for an average between 0.5 and 1.49', () => {
            // Math: 1+1+0 = 2. 2/3 = 0.666 -> 'minimal'
            expect(calculateAverageStatus(['minimal', 'minimal', 'low'])).toBe('minimal');
            
            // Math: 3+0+0 = 3. 3/3 = 1.0 -> 'minimal'
            expect(calculateAverageStatus(['high', 'low', 'low'])).toBe('minimal');
        });

        it('should return "low" for an average below 0.5', () => {
            // Math: 1+0+0+0 = 1. 1/4 = 0.25 -> 'low'
            expect(calculateAverageStatus(['minimal', 'low', 'low', 'low'])).toBe('low');
            
            // Math: 0+0+0 = 0 -> 'low'
            expect(calculateAverageStatus(['low', 'low', 'low'])).toBe('low');
        });
    });
});
