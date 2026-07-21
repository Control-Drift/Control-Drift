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

import { z } from 'zod';

// Utility for fallback to empty array if parsing JSON fails or it's not an array
const JsonArrayFallback = z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
    }
    return [];
}, z.array(z.any()));

export const GapSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    displayId: z.string().optional().nullable(),
    ttp: z.string().optional().nullable(),
    simulation: z.string().optional().nullable(),
    finding: z.string().optional().nullable(),
    outcome: z.string().optional().nullable(),
    coverageRating: z.string().optional().nullable(),
    details: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    severity: z.string().optional().nullable(),
    priorityScore: z.union([z.string(), z.number()]).transform(v => Number(v) || 0).optional(),
    createdDate: z.string().optional().nullable(),
    resolvedDate: z.string().optional().nullable(),
    resolutionNotes: z.string().optional().nullable(),
    environment: z.union([z.string(), JsonArrayFallback]).transform(v => {
        if (typeof v === 'string') return [v];
        if (Array.isArray(v)) return v;
        return [];
    }).optional(),
    actionItems: z.string().optional().nullable(),
    stakeholders: JsonArrayFallback.optional(),
    tags: JsonArrayFallback.optional(),
    ticketLink: z.string().optional().nullable(),
    aiRemediation: z.string().optional().nullable(),
    todoList: JsonArrayFallback.optional(),
    riskJustification: z.string().optional().nullable(),
    riskAcceptedBy: z.string().optional().nullable(),
    riskAcceptedDate: z.string().optional().nullable(),
    validationNotes: z.string().optional().nullable(),
    remediationCode: z.string().optional().nullable()
});

export const ExerciseSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    ttp: z.string().optional().nullable(),
    simulation: z.string().optional().nullable(),
    finding: z.string().optional().nullable(),
    outcome: z.string().optional().nullable(),
    coverageRating: z.string().optional().nullable(),
    remediation: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    environment: z.union([z.string(), JsonArrayFallback]).transform(v => {
        if (typeof v === 'string') return [v];
        if (Array.isArray(v)) return v;
        return [];
    }).optional(),
    date: z.string().optional().nullable(),
    tags: JsonArrayFallback.optional(),
    securityControls: JsonArrayFallback.optional()
});

const EvidenceArrayFallback = z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
    }
    return [];
}, z.array(z.string().startsWith("data:image/", { message: "Evidence must be a base64 data URI (data:image/...) to prevent CORS poisoning." })));

export const SimulationSummarySchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    summary: z.any().optional(), // Can be string or JSON object
    evidence: EvidenceArrayFallback.optional()
});

// A helper function to safely validate arrays of data and drop invalid rows silently
export const validateBulkData = (schema, dataArray, entityName = "Entity") => {
    if (!Array.isArray(dataArray)) {
        throw new Error(`Expected an array for ${entityName} data, received ${typeof dataArray}`);
    }
    
    return dataArray.map((item, index) => {
        const result = schema.safeParse(item);
        if (result.success) {
            return result.data;
        } else {
            const errorDetails = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Validation failed for ${entityName} at index ${index}: ${errorDetails}`);
        }
    });
};
