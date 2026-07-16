import { z } from 'zod';

const JsonArrayFallback = z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
    }
    return [];
}, z.array(z.any()));

const GapSchema = z.object({
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
    securityControls: JsonArrayFallback.optional(),
    todoList: JsonArrayFallback.optional(),
    riskJustification: z.string().optional().nullable(),
    riskAcceptedBy: z.string().optional().nullable(),
    riskAcceptedDate: z.string().optional().nullable(),
    validationNotes: z.string().optional().nullable()
});

const fakeSupabaseRow = {
  id: 1234,
  displayId: "GAP-1234",
  status: "In Progress",
  priorityScore: 0,
  environment: ["Prod"],
};

const result = GapSchema.safeParse(fakeSupabaseRow);
console.log(result);
