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

import { lookupTTPName } from './mitreUtils';
import {
  classifyTtpOperationalRole,
  clusterTTPsIntoCompoundEvents,
  humanizeTechniqueActionName,
  buildCompoundEventTitle
} from './mitreStixCti';

/**
 * Normalizes a raw outcome string (e.g. "Missed ➔ Prevented ✓" or synonyms like "Blocked" / "Bypassed")
 * to its canonical Control Drift outcome value.
 */
export function normalizeOutcomeValue(rawOutcome) {
  if (!rawOutcome || typeof rawOutcome !== 'string') return '';
  let cleaned = rawOutcome;
  if (cleaned.includes(' ➔ ')) {
    cleaned = cleaned.split(' ➔ ').pop();
  }
  cleaned = cleaned.replace(/✓/g, '').trim();
  if (!cleaned || /^(n\/a|error|unknown)$/i.test(cleaned)) return '';

  const lower = cleaned.toLowerCase();
  if (lower === 'prevented & alerted' || lower === 'blocked & alerted') return 'Prevented & Alerted';
  if (lower === 'prevented' || lower === 'blocked') return 'Prevented';
  if (lower === 'alerted' || lower === 'detected') return 'Alerted';
  if (lower === 'logged' || lower === 'telemetry only') return 'Logged';
  if (lower === 'missed' || lower === 'not detected' || lower === 'bypassed' || lower === 'unblocked') {
    return 'Missed';
  }
  return cleaned;
}

/**
 * Given an outcome value, returns the default Coverage Rating, status, and Gap Severity.
 */
export function getOutcomeCascadedFields(outcome, currentSeverity = 'Auto-Calculate') {
  const clean = normalizeOutcomeValue(outcome);
  if (clean === 'Prevented & Alerted' || clean === 'Prevented' || clean === 'Alerted') {
    return { coverageRating: 'Optimal', status: 'high', severity: 'N/A' };
  }
  if (clean === 'Logged') {
    const sev =
      currentSeverity &&
      currentSeverity !== 'N/A' &&
      currentSeverity !== 'Auto-Calculate' &&
      currentSeverity !== 'Low' &&
      currentSeverity !== 'Informational'
        ? currentSeverity
        : 'Medium';
    return { coverageRating: 'Partial', status: 'medium', severity: sev };
  }
  if (clean === 'Missed') {
    const sev = currentSeverity === 'Critical' ? 'Critical' : 'High';
    return { coverageRating: 'None', status: 'minimal', severity: sev };
  }
  return { coverageRating: 'N/A', status: 'unknown', severity: 'N/A' };
}

/**
 * Helper to extract TTP IDs array from a procedure or event object (supports both `ttps` and `mappedTTPs`).
 */
function extractProcTtps(proc) {
  if (!proc || typeof proc !== 'object') return [];
  const raw = Array.isArray(proc.ttps)
    ? proc.ttps
    : Array.isArray(proc.mappedTTPs)
    ? proc.mappedTTPs
    : proc.ttp
    ? (Array.isArray(proc.ttp) ? proc.ttp : String(proc.ttp).split(','))
    : [];
  return raw.map((id) => String(typeof id === 'object' ? id.id : id).trim().toUpperCase()).filter(Boolean);
}

/**
 * Helper to normalize `selectedTTPs` items which may be `{ id, name }` objects or string IDs.
 */
function normalizeSelectedTTPsList(selectedTTPs = []) {
  if (!Array.isArray(selectedTTPs)) return [];
  return selectedTTPs
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { id: item.trim().toUpperCase(), name: '' };
      }
      if (typeof item === 'object' && item.id) {
        return { id: String(item.id).trim().toUpperCase(), name: item.name || '' };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Looks up the most recent historical baseline for a given MITRE TTP ID across
 * finalized `simulationSummaries` and atomic `events`.
 */
export function getHistoricalBaselineForTTP(ttpId, simulationSummaries = {}, events = {}) {
  if (!ttpId) return null;
  const normalizedId = String(typeof ttpId === 'object' ? ttpId.id : ttpId)
    .trim()
    .toUpperCase();

  // 1. Search simulationSummaries sorted newest-first for rich procedure details
  const summariesList = Object.entries(simulationSummaries || {})
    .map(([simName, data]) => {
      if (!data || typeof data !== 'object') return null;
      const ts = new Date(data.timestamp || data.date || 0).getTime();
      return { simName, data, ts: isNaN(ts) ? 0 : ts };
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts);

  for (const { simName, data } of summariesList) {
    const results = Array.isArray(data.testResults) ? data.testResults : [];
    const matchingProc = results.find((p) => extractProcTtps(p).includes(normalizedId));
    if (matchingProc) {
      const rawOutcome = matchingProc.outcome || matchingProc.expectedOutcome || '';
      const cleanOutcome = normalizeOutcomeValue(rawOutcome) || '';
      return {
        ttpId: normalizedId,
        name: matchingProc.name || `${normalizedId} Validation`,
        eventType: matchingProc.eventType || (matchingProc.procedureSteps ? 'Procedure' : 'Payload'),
        payloadCode: matchingProc.payloadCode || '',
        procedureSteps: matchingProc.procedureSteps || '',
        outcome: rawOutcome.replace(/✓/g, '').trim(),
        expectedOutcome: cleanOutcome,
        normalizedExpectedOutcome: cleanOutcome,
        securityControls: Array.isArray(matchingProc.securityControls)
          ? [...matchingProc.securityControls]
          : [],
        targetAsset: matchingProc.targetAsset || '',
        environmentCategory: Array.isArray(data.details?.environmentCategory)
          ? [...data.details.environmentCategory]
          : [],
        previousCoverageRating: matchingProc.coverageRating || 'N/A',
        previousSimulationName: simName,
        sourceSimulation: simName,
        lastTestedDate: data.timestamp || data.date || null,
      };
    }
  }

  // 2. Fallback to atomic `events` history for this TTP (supports both object map and flat array)
  const ttpEvents = Array.isArray(events)
    ? events.filter((e) => String(e?.ttpId || e?.id || e?.ttp || '').toUpperCase() === normalizedId)
    : Array.isArray(events?.[normalizedId])
    ? events[normalizedId]
    : [];

  if (ttpEvents.length > 0) {
    const sorted = [...ttpEvents].sort(
      (a, b) =>
        new Date(b.validationDate || b.date || 0).getTime() -
        new Date(a.validationDate || a.date || 0).getTime()
    );
    const latest = sorted[0];
    const rawOutcome = latest.outcome || latest.finding || '';
    const cleanOutcome = normalizeOutcomeValue(rawOutcome) || '';
    return {
      ttpId: normalizedId,
      name: `${normalizedId} Validation`,
      eventType: 'Payload',
      payloadCode: '',
      procedureSteps: '',
      outcome: rawOutcome.replace(/✓/g, '').trim(),
      expectedOutcome: cleanOutcome,
      normalizedExpectedOutcome: cleanOutcome,
      securityControls: Array.isArray(latest.securityControls)
        ? [...latest.securityControls]
        : [],
      targetAsset: latest.targetAsset || '',
      environmentCategory: Array.isArray(latest.environment)
        ? [...latest.environment]
        : latest.environment
        ? [latest.environment]
        : [],
      previousCoverageRating: latest.coverageRating || 'N/A',
      previousSimulationName: latest.simulation || '',
      sourceSimulation: latest.simulation || '',
      lastTestedDate: latest.validationDate || latest.date || null,
    };
  }

  return null;
}

/**
 * Collects all historical procedures/payloads previously validated for each selected TTP
 * (including parent/sub-technique family context and untested sibling sub-techniques)
 * so analysts and the AI Co-Pilot can evolve procedural depth instead of repeating identical commands.
 */
export function getHistoricalProceduresForTTPs(
  selectedTTPs = [],
  simulationSummaries = {},
  events = {},
  mitreData = {}
) {
  const normalizedSelected = normalizeSelectedTTPsList(selectedTTPs);
  if (normalizedSelected.length === 0) return [];

  // Sort simulation summaries newest-first
  const summariesList = Object.entries(simulationSummaries || {})
    .map(([simName, data]) => {
      if (!data || typeof data !== 'object') return null;
      const ts = new Date(data.timestamp || data.date || 0).getTime();
      return { simName, data, ts: isNaN(ts) ? 0 : ts };
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts);

  // Collect all tested TTP IDs across summaries and events for sibling comparison
  const allTestedIds = new Set();
  summariesList.forEach(({ data }) => {
    (Array.isArray(data.testResults) ? data.testResults : []).forEach((p) => {
      extractProcTtps(p).forEach((id) => allTestedIds.add(id));
    });
  });
  if (Array.isArray(events)) {
    events.forEach((e) => {
      const id = String(e?.ttpId || e?.id || e?.ttp || '').trim().toUpperCase();
      if (id) allTestedIds.add(id);
    });
  } else if (events && typeof events === 'object') {
    Object.keys(events).forEach((k) => {
      if (Array.isArray(events[k]) && events[k].length > 0) {
        allTestedIds.add(k.trim().toUpperCase());
      }
    });
  }

  return normalizedSelected.map((ttp) => {
    const ttpId = ttp.id;
    const parentId = ttpId.includes('.') ? ttpId.split('.')[0] : ttpId;
    const ttpName = ttp.name || lookupTTPName(mitreData, ttpId) || ttpId;

    const procedures = [];
    const seenKeys = new Set();

    // 1. Gather rich procedure records from simulationSummaries
    for (const { simName, data } of summariesList) {
      const results = Array.isArray(data.testResults) ? data.testResults : [];
      for (const proc of results) {
        const procTtps = extractProcTtps(proc);
        const exactMatch = procTtps.includes(ttpId);
        if (!exactMatch) continue;

        const codeOrSteps = (proc.payloadCode || proc.procedureSteps || '').trim();
        const procName = (proc.name || `${ttpId} Validation`).trim();
        const dedupKey = `${procName.toLowerCase()}::${codeOrSteps.toLowerCase().slice(0, 160)}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        const rawOutcome = proc.outcome || proc.expectedOutcome || 'Alerted';
        const cleanOutcome = normalizeOutcomeValue(rawOutcome) || 'Alerted';

        procedures.push({
          ttpId,
          isExactMatch: true,
          name: procName,
          eventType: proc.eventType || (proc.procedureSteps ? 'Procedure' : 'Payload'),
          payloadCode: proc.payloadCode || '',
          procedureSteps: proc.procedureSteps || '',
          outcome: cleanOutcome,
          securityControls: Array.isArray(proc.securityControls) ? [...proc.securityControls] : [],
          simulationName: simName,
          date: proc.validationDate || data.timestamp || data.date || null,
        });
      }
    }

    // 2. Fallback to atomic events if no rich procedures were found in simulationSummaries
    if (procedures.length === 0) {
      const ttpEvents = Array.isArray(events)
        ? events.filter((e) => {
            const id = String(e?.ttpId || e?.id || e?.ttp || '').trim().toUpperCase();
            return id === ttpId;
          })
        : Array.isArray(events?.[ttpId])
        ? events[ttpId]
        : [];

      ttpEvents.forEach((ev) => {
        if (!ev) return;
        const rawOutcome = ev.outcome || ev.finding || 'Alerted';
        const cleanOutcome = normalizeOutcomeValue(rawOutcome) || 'Alerted';
        const simName = ev.simulation || 'Historical Validation';
        const remText = (ev.remediation || '').trim();
        const dedupKey = `${simName}::${cleanOutcome}::${remText.slice(0, 120)}`;
        if (seenKeys.has(dedupKey)) return;
        seenKeys.add(dedupKey);

        procedures.push({
          ttpId,
          isExactMatch: true,
          name: `${ttpId} (${simName})`,
          eventType: 'Payload',
          payloadCode: '',
          procedureSteps: remText,
          outcome: cleanOutcome,
          securityControls: Array.isArray(ev.securityControls) ? [...ev.securityControls] : [],
          simulationName: simName,
          date: ev.validationDate || ev.date || null,
        });
      });
    }

    // 3. Discover untested sibling sub-techniques under the same parent technique
    const untestedSiblings = [];
    if (mitreData && typeof mitreData === 'object') {
      for (const tacticKey of Object.keys(mitreData)) {
        const techniques = mitreData[tacticKey]?.techniques || [];
        const parentTech = techniques.find((t) => String(t.id).toUpperCase() === parentId);
        if (parentTech && Array.isArray(parentTech.subTechniques)) {
          parentTech.subTechniques.forEach((sub) => {
            const subId = String(sub.id).toUpperCase();
            if (subId !== ttpId && !allTestedIds.has(subId) && sub.status !== 'na') {
              if (!untestedSiblings.some((s) => s.id === subId)) {
                untestedSiblings.push({ id: subId, name: sub.name });
              }
            }
          });
          break;
        }
      }
    }

    return {
      ttpId,
      ttpName,
      parentId,
      procedures,
      untestedSiblings: untestedSiblings.slice(0, 5),
      totalExecutions: procedures.length,
    };
  });
}

/**
 * Formats historical procedure memory into an AI prompt section that instructs the AI Co-Pilot
 * NOT to repeat previously validated payloads and instead evolve procedural depth.
 */
export function formatHistoricalProceduresForAIPrompt(historyByTtp = []) {
  if (!Array.isArray(historyByTtp) || historyByTtp.length === 0) return '';
  const withHistory = historyByTtp.filter(
    (item) => Array.isArray(item.procedures) && item.procedures.length > 0
  );
  if (withHistory.length === 0) return '';

  const lines = [
    '\n\n=== PREVIOUSLY VALIDATED PROCEDURES (DO NOT REPEAT — EVOLVE DEPTH) ===',
    'The following procedures/commands have ALREADY been executed in prior simulations for these TTPs.',
    'CRITICAL REQUIREMENT: Do NOT repeat the exact same commands, flags, or one-liners listed below.',
    'Instead, EVOLVE the validation depth for each technique by designing a NEW procedural variation (e.g., an alternative LOLBin/interpreter, different execution context, obfuscation/encoding variation, WMI/COM/API invocation, or an untested sibling sub-technique) that tests whether security controls still detect the behavior beyond the previously tested signature:',
  ];

  withHistory.forEach((item) => {
    lines.push(`\n- ${item.ttpId} (${item.ttpName}):`);
    item.procedures.slice(0, 4).forEach((proc, idx) => {
      const snippet = (proc.payloadCode || proc.procedureSteps || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);
      const ctrlStr =
        proc.securityControls?.length > 0 ? ` via ${proc.securityControls.join(', ')}` : '';
      lines.push(
        `  [Prior Variation #${idx + 1}] "${proc.name}" -> Outcome: ${proc.outcome}${ctrlStr}${
          snippet ? ` | Command/Steps: \`${snippet}\`` : ''
        }`
      );
    });
    if (item.untestedSiblings?.length > 0) {
      lines.push(
        `  [Untested Sibling Sub-Techniques in ${item.parentId} Family]: ${item.untestedSiblings
          .map((s) => `${s.id} (${s.name})`)
          .join(', ')}`
      );
    }
  });

  return lines.join('\n');
}

/**
 * Converts a raw Markdown heading or legacy event name into a clean, title-worthy
 * operational event title suitable for Step 3 Event Cards and Executive Reports.
 * - Strips redundant "Phase N:", "Step N:", "Event N:", or "TTP T1078:" prefixes
 * - Strips trailing/inline TTP ID parentheticals like "(T1059.001, T1047, T1082)"
 * - Replaces repetitive blueprint boilerplate ("Contextual Recon + Evasive Staging ➔ ...")
 *   or bare sub-technique labels ("DLL") with specific, human-readable operational titles.
 */
export function formatCleanEventTitle(
  rawTitle = '',
  assignedTtps = [],
  mitreData = {},
  code = ''
) {
  let cleaned = String(rawTitle || '')
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();

  // 1. Strip leading "Phase 1:", "Step 2 -", "Event 3:", "Procedure 1:" prefixes
  cleaned = cleaned.replace(
    /^(?:phase|step|event|procedure|stage)\s*\d+\s*[:\-–—.]\s*/i,
    ''
  );

  // 2. Strip trailing or parenthetical TTP ID lists, e.g. "(T1057, T1070.006, T1574.001)" or "[T1049, T1105]"
  cleaned = cleaned
    .replace(
      /\s*[\(\[]\s*(?:ttps?\s*[:\-]?\s*)?T\d{4}(?:\.\d{3})?(?:\s*(?:[,;/|+&]|and)\s*T\d{4}(?:\.\d{3})?)*\s*[\)\]]\s*$/gi,
      ''
    )
    .trim();

  // 3. Strip leading "TTP T1078 - " or "T1059.001 + T1082 - " prefixes
  cleaned = cleaned
    .replace(
      /^(?:ttps?|techniques?)?\s*T\d{4}(?:\.\d{3})?(?:\s*(?:[,+/&]|and)\s*T\d{4}(?:\.\d{3})?)*\s*[:\-–—]\s*/i,
      ''
    )
    .trim();

  // 4. Strip repetitive mechanical blueprint prefixes ("Contextual Recon + Evasive Staging ➔ ...")
  const hadMechanicalPrefix =
    /^(?:contextual\s+recon(?:\s*\+\s*evasive\s+staging)?|evasive\s+staging)\s*(?:➔|->|→|:|-)/i.test(
      cleaned
    );
  cleaned = cleaned
    .replace(
      /^(?:contextual\s+recon(?:\s*\+\s*evasive\s+staging)?|evasive\s+staging)\s*(?:➔|->|→|:|-)\s*/i,
      ''
    )
    .trim();

  // 5. Check if the remaining title is generic, empty, a bare TTP ID list, or an ambiguous short sub-technique name ("DLL")
  const isGenericOrBare =
    !cleaned ||
    hadMechanicalPrefix ||
    /^(?:recommended|simulation|unified|procedure|execution|validation|chained\s+validation|step\s*\d+|phase\s*\d+|event\s*\d+|dll|lsass\s+memory|ntds|valid\s+accounts)$/i.test(
      cleaned
    ) ||
    /^(?:ttps?\s*)?T\d{4}(?:\.\d{3})?(?:\s*[,+/&-]\s*T\d{4}(?:\.\d{3})?)*$/i.test(cleaned);

  if (!isGenericOrBare) {
    return cleaned;
  }

  // 6. Try extracting a descriptive operational title from the code block's header comment if present
  if (code && typeof code === 'string') {
    const firstLines = code.split('\n').slice(0, 4);
    for (const line of firstLines) {
      const commentMatch = line.match(/^\s*(?:#|\/\/|REM\s+)\s*(.+)$/i);
      if (commentMatch) {
        let commentTitle = commentMatch[1]
          .replace(/^(?:phase|step|event)\s*\d+\s*[:\-–—.]\s*/i, '')
          .replace(
            /^(?:contextual\s+recon(?:\s*\+\s*evasive\s+staging)?|evasive\s+staging)\s*(?:➔|->|→|:|-)\s*/i,
            ''
          )
          .replace(
            /\s*[\(\[]\s*T\d{4}(?:\.\d{3})?(?:\s*[,;/|+&]\s*T\d{4}(?:\.\d{3})?)*\s*[\)\]]\s*$/gi,
            ''
          )
          .trim();
        if (
          commentTitle &&
          commentTitle.length >= 10 &&
          commentTitle.length <= 75 &&
          !/^(?:\d+\.|contextual\s+precursor|anchor\s+objective|execution\s+conduit|tradecraft\s+modifier|initiating)/i.test(
            commentTitle
          ) &&
          !/^dll$/i.test(commentTitle)
        ) {
          return commentTitle;
        }
      }
    }
  }

  // 7. Synthesize a crisp operational title from the assigned TTPs using our 4-component humanizer
  const normalizedIds = (assignedTtps || [])
    .map((id) => String(typeof id === 'object' ? id.id : id).trim().toUpperCase())
    .filter(Boolean);

  if (normalizedIds.length > 0) {
    const bucket = { anchors: [], conduits: [], precursors: [], modifiers: [] };
    normalizedIds.forEach((id) => {
      const name = lookupTTPName(mitreData, id) || '';
      const roleInfo = classifyTtpOperationalRole({ id, name });
      const ttpObj = { id, name: humanizeTechniqueActionName({ id, name }) };
      if (roleInfo.role === 'CONDUIT') bucket.conduits.push(ttpObj);
      else if (roleInfo.role === 'PRECURSOR') bucket.precursors.push(ttpObj);
      else if (roleInfo.role === 'MODIFIER') bucket.modifiers.push(ttpObj);
      else bucket.anchors.push(ttpObj);
    });

    if (bucket.anchors.length > 0) {
      return buildCompoundEventTitle(bucket);
    }
    return normalizedIds
      .slice(0, 2)
      .map((id) => humanizeTechniqueActionName(id, lookupTTPName(mitreData, id)))
      .join(' & ');
  }

  return cleaned || 'Adversary Validation Procedure';
}

/**
 * Extracts code blocks and their contextual titles / TTP IDs from Step 2 Markdown design.
 */
export function parseDesignCodeBlocks(simulationPayload = '', selectedTTPs = []) {
  if (!simulationPayload || typeof simulationPayload !== 'string') return [];

  const blocks = [];
  const lines = simulationPayload.split('\n');
  let currentHeading = '';
  let inFence = false;
  let fenceLang = '';
  let fenceLines = [];
  let contextLinesBeforeFence = [];

  const normalizedSelected = normalizeSelectedTTPsList(selectedTTPs);
  const selectedIds = new Set(normalizedSelected.map((t) => t.id));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);

    if (!inFence && fenceMatch) {
      inFence = true;
      fenceLang = (fenceMatch[1] || '').toLowerCase();
      fenceLines = [];
      continue;
    }

    if (inFence && line.trim().startsWith('```')) {
      inFence = false;
      const code = fenceLines.join('\n').trim();
      if (code) {
        const headingMatches = currentHeading.match(/T\d{4}(?:\.\d{3})?/gi) || [];
        const fallbackContext = `${contextLinesBeforeFence.join('\n')}\n${code}`;
        const ttpMatches =
          headingMatches.length > 0
            ? headingMatches
            : fallbackContext.match(/T\d{4}(?:\.\d{3})?/gi) || [];
        const uniqueTtps = [...new Set(ttpMatches.map((m) => m.toUpperCase()))];

        // Strictly filter to selectedTTPs when selectedTTPs are provided
        const mappedTtps =
          selectedIds.size > 0
            ? uniqueTtps.filter((id) => selectedIds.has(id))
            : uniqueTtps;

        const cleanHeading = currentHeading
          .replace(/^#+\s*/, '')
          .replace(/\*\*/g, '')
          .trim();

        const isTeardown = /(?:teardown|clean\s*up)/i.test(cleanHeading);

        // If this block explicitly targeted TTPs that are no longer in selectedTTPs, skip it
        if (selectedIds.size > 0 && uniqueTtps.length > 0 && mappedTtps.length === 0 && !isTeardown) {
          contextLinesBeforeFence = [];
          continue;
        }

        blocks.push({
          title: cleanHeading,
          language: fenceLang || 'shell',
          code,
          ttps: mappedTtps,
          mappedTTPs: mappedTtps,
        });
      }
      contextLinesBeforeFence = [];
      continue;
    }

    if (inFence) {
      fenceLines.push(line);
    } else {
      const headingMatch = line.match(/^(?:#{1,4}\s+(.+)|\*\*(.+?)\*\*)\s*$/);
      if (headingMatch) {
        currentHeading = (headingMatch[1] || headingMatch[2] || '').trim();
        contextLinesBeforeFence = [];
      } else if (line.trim()) {
        contextLinesBeforeFence.push(line.trim());
      }
    }
  }

  return blocks;
}

/**
 * Auto-scaffolds Step 3 EventCards by combining:
 * 1. Code blocks parsed from Step 2 (`simulationPayload`)
 * 2. Selected TTPs from Step 1 (`selectedTTPs`)
 * 3. Historical Baseline Memory (`simulationSummaries` + `events`)
 */
export function scaffoldEventsFromDesignAndTTPs({
  simulationPayload = '',
  selectedTTPs = [],
  existingTestResults = [],
  simulationSummaries = {},
  events = {},
  mitreData = {},
  executionMethodology = 'compound',
}) {
  const isAtomicMode = executionMethodology === 'atomic';
  const normalizedSelected = normalizeSelectedTTPsList(selectedTTPs);
  if (normalizedSelected.length === 0) return [];

  const selectedIds = new Set(normalizedSelected.map((t) => t.id.toUpperCase()));
  const parsedBlocks = parseDesignCodeBlocks(simulationPayload, normalizedSelected);
  const usedNames = new Set(
    (existingTestResults || []).map((p) => (p.name || '').trim().toLowerCase()).filter(Boolean)
  );
  const coveredTtpIds = new Set();
  (existingTestResults || []).forEach((p) => {
    extractProcTtps(p).forEach((id) => {
      const upper = id.toUpperCase();
      if (selectedIds.has(upper)) coveredTtpIds.add(upper);
    });
  });

  const makeUniqueName = (baseName) => {
    let candidate = (baseName || 'Simulated Event').trim().slice(0, 95);
    let counter = 2;
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${baseName.trim().slice(0, 88)} (${counter})`;
      counter++;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
  };

  const newEvents = [];

  // Pre-filter teardown blocks and (when in Compound mode) fuse any standalone Precursor/Conduit/Modifier-only block
  // into its companion Anchor block so Step 3 never gets fragmented enumeration-only cards.
  const actionableBlocks = parsedBlocks.filter(
    (block) => !/(?:teardown|clean\s*up)/i.test(block.title)
  );
  const blockHasAnchor = (blk) =>
    (blk.ttps || []).some((id) => classifyTtpOperationalRole({ id }).role === 'ANCHOR');
  const anyBlockHasAnchor = actionableBlocks.some(blockHasAnchor);

  const mergedBlocks = [];
  if (!isAtomicMode && anyBlockHasAnchor && actionableBlocks.length > 1) {
    let pendingSupportBlocks = [];
    actionableBlocks.forEach((blk) => {
      if (blockHasAnchor(blk)) {
        if (pendingSupportBlocks.length > 0) {
          const combinedTtps = [
            ...new Set([
              ...pendingSupportBlocks.flatMap((b) => b.ttps || []),
              ...(blk.ttps || [])
            ])
          ];
          const combinedCode = [
            ...pendingSupportBlocks.map((b) => b.code),
            blk.code
          ]
            .filter(Boolean)
            .join('\n\n');
          mergedBlocks.push({
            ...blk,
            code: combinedCode,
            ttps: combinedTtps,
            mappedTTPs: combinedTtps
          });
          pendingSupportBlocks = [];
        } else {
          mergedBlocks.push({ ...blk });
        }
      } else {
        pendingSupportBlocks.push(blk);
      }
    });
    // If trailing support blocks remain after the last Anchor block, fuse them into the last Anchor block
    if (pendingSupportBlocks.length > 0 && mergedBlocks.length > 0) {
      const last = mergedBlocks[mergedBlocks.length - 1];
      const combinedTtps = [
        ...new Set([
          ...(last.ttps || []),
          ...pendingSupportBlocks.flatMap((b) => b.ttps || [])
        ])
      ];
      last.code = [last.code, ...pendingSupportBlocks.map((b) => b.code)]
        .filter(Boolean)
        .join('\n\n');
      last.ttps = combinedTtps;
      last.mappedTTPs = combinedTtps;
    }
  } else {
    mergedBlocks.push(...actionableBlocks);
  }

  // 1. Create events from merged Compound Operational Blocks (or 1:1 Atomic Blocks)
  mergedBlocks.forEach((block, idx) => {
    let assignedTtps = (block.ttps || [])
      .map((id) => id.toUpperCase())
      .filter((id) => selectedIds.has(id) && !coveredTtpIds.has(id));

    if (isAtomicMode && assignedTtps.length > 1) {
      assignedTtps = [assignedTtps[0]];
    }

    if (assignedTtps.length === 0 && normalizedSelected.length > 0) {
      const uncovered = normalizedSelected.find((t) => !coveredTtpIds.has(t.id));
      if (!uncovered) return; // All selected TTPs are already covered; do not create extra duplicate cards
      assignedTtps = [uncovered.id];
    }

    assignedTtps.forEach((id) => coveredTtpIds.add(id.toUpperCase()));

    // Aggregate baselines & security controls across all assigned TTPs for chained events
    let baseline = null;
    const aggregatedControls = new Set();
    let expectedOutcome = '';
    let baselineSource = null;
    let targetAsset = '';

    assignedTtps.forEach((tid) => {
      const b = getHistoricalBaselineForTTP(tid, simulationSummaries, events);
      if (b) {
        if (!baseline) {
          baseline = b;
          expectedOutcome = b.expectedOutcome || '';
          baselineSource = b.previousSimulationName || null;
          targetAsset = b.targetAsset || '';
        }
        (b.securityControls || []).forEach((c) => aggregatedControls.add(c));
      }
    });

    const rawTitle = formatCleanEventTitle(
      block.title,
      assignedTtps,
      mitreData,
      block.code
    );

    newEvents.push({
      id: Date.now() + Math.random() + idx,
      name: makeUniqueName(rawTitle),
      ttps: assignedTtps,
      mappedTTPs: assignedTtps,
      eventType: 'Payload',
      payloadCode: block.code,
      expectedOutcome,
      outcome: '',
      coverageRating: 'N/A',
      severity: 'Auto-Calculate',
      securityControls: aggregatedControls.size > 0 ? Array.from(aggregatedControls) : (baseline?.securityControls || []),
      targetAsset,
      execNotes: '',
      detNotes: '',
      isBaselinePrefilled: Boolean(baseline),
      baselineSource,
      timestamp: '',
    });
  });

  // 2. Ensure every selected TTP in Step 1 is accounted for:
  // - In Atomic 1:1 mode: every uncovered TTP gets its own isolated 1:1 Event Card.
  // - In Compound mode: cluster uncovered TTPs into Compound Operational Events or fuse supporters into matching Anchor cards.
  const uncoveredSelected = normalizedSelected.filter((t) => !coveredTtpIds.has(t.id));

  if (uncoveredSelected.length > 0) {
    if (isAtomicMode) {
      uncoveredSelected.forEach((ttp, idx) => {
        const upperId = ttp.id.toUpperCase();
        const baseline = getHistoricalBaselineForTTP(upperId, simulationSummaries, events);
        const ttpLabel = humanizeTechniqueActionName(
          upperId,
          ttp.name || lookupTTPName(mitreData, upperId)
        );
        const defaultName = formatCleanEventTitle(
          baseline?.name || ttpLabel,
          [upperId],
          mitreData,
          baseline?.payloadCode || ''
        );

        newEvents.push({
          id: Date.now() + Math.random() + 100 + idx,
          name: makeUniqueName(defaultName),
          ttps: [upperId],
          mappedTTPs: [upperId],
          eventType: baseline?.eventType || 'Payload',
          payloadCode: baseline?.payloadCode || '',
          procedureSteps: baseline?.procedureSteps || '',
          expectedOutcome: baseline?.expectedOutcome || '',
          outcome: '',
          coverageRating: 'N/A',
          severity: 'Auto-Calculate',
          securityControls: baseline?.securityControls || [],
          targetAsset: baseline?.targetAsset || '',
          execNotes: '',
          detNotes: '',
          isBaselinePrefilled: Boolean(baseline),
          baselineSource: baseline?.previousSimulationName || null,
          timestamp: '',
        });
        coveredTtpIds.add(upperId);
      });
    } else if (newEvents.length === 0) {
      // No Step 2 code blocks exist: cluster all uncovered TTPs into Compound Operational Events
      const clustered = clusterTTPsIntoCompoundEvents(
        uncoveredSelected.map((t) => ({
          ...t,
          name: t.name || lookupTTPName(mitreData, t.id) || t.id
        }))
      );

      clustered.compoundEvents.forEach((compEv, idx) => {
        const assignedIds = compEv.ttpIds;
        assignedIds.forEach((id) => coveredTtpIds.add(id.toUpperCase()));

        let baseline = null;
        const aggregatedControls = new Set();
        let expectedOutcome = '';
        let baselineSource = null;
        let targetAsset = '';

        // Prefer Anchor TTP baseline first
        const anchorFirstIds = [
          ...compEv.anchors.map((a) => a.id),
          ...assignedIds.filter((id) => !compEv.anchors.some((a) => a.id === id))
        ];

        anchorFirstIds.forEach((tid) => {
          const b = getHistoricalBaselineForTTP(tid, simulationSummaries, events);
          if (b) {
            if (!baseline) {
              baseline = b;
              expectedOutcome = b.expectedOutcome || '';
              baselineSource = b.previousSimulationName || null;
              targetAsset = b.targetAsset || '';
            }
            (b.securityControls || []).forEach((c) => aggregatedControls.add(c));
          }
        });

        const defaultName = formatCleanEventTitle(
          assignedIds.length > 1
            ? compEv.title
            : baseline?.name || humanizeTechniqueActionName(assignedIds[0], lookupTTPName(mitreData, assignedIds[0])),
          assignedIds,
          mitreData,
          baseline?.payloadCode || ''
        );

        newEvents.push({
          id: Date.now() + Math.random() + 100 + idx,
          name: makeUniqueName(defaultName),
          ttps: assignedIds,
          mappedTTPs: assignedIds,
          eventType: baseline?.eventType || 'Payload',
          payloadCode: baseline?.payloadCode || '',
          procedureSteps: baseline?.procedureSteps || '',
          expectedOutcome: expectedOutcome || baseline?.expectedOutcome || '',
          outcome: '',
          coverageRating: 'N/A',
          severity: 'Auto-Calculate',
          securityControls:
            aggregatedControls.size > 0
              ? Array.from(aggregatedControls)
              : baseline?.securityControls || [],
          targetAsset: targetAsset || baseline?.targetAsset || '',
          execNotes: '',
          detNotes: '',
          isBaselinePrefilled: Boolean(baseline),
          baselineSource,
          timestamp: '',
        });
      });
    } else {
      // Step 2 code blocks already produced Event Cards:
      // Any uncovered Precursor/Conduit/Modifier TTPs fuse into the best-matching existing Event Card,
      // while uncovered Anchor TTPs either form a compound card or attach appropriately.
      const uncoveredAnchors = [];
      const uncoveredSupporters = [];

      uncoveredSelected.forEach((ttp) => {
        const roleInfo = classifyTtpOperationalRole(ttp);
        if (roleInfo.role === 'ANCHOR') {
          uncoveredAnchors.push({ ...ttp, operationalRole: roleInfo });
        } else {
          uncoveredSupporters.push({ ...ttp, operationalRole: roleInfo });
        }
      });

      // Create cards for any uncovered Anchor TTPs first
      uncoveredAnchors.forEach((ttp, idx) => {
        const upperId = ttp.id;
        const baseline = getHistoricalBaselineForTTP(upperId, simulationSummaries, events);
        const ttpLabel = humanizeTechniqueActionName(upperId, ttp.name || lookupTTPName(mitreData, upperId));
        const defaultName = formatCleanEventTitle(
          baseline?.name || ttpLabel,
          [upperId],
          mitreData,
          baseline?.payloadCode || ''
        );

        newEvents.push({
          id: Date.now() + Math.random() + 100 + idx,
          name: makeUniqueName(defaultName),
          ttps: [upperId],
          mappedTTPs: [upperId],
          eventType: baseline?.eventType || 'Payload',
          payloadCode: baseline?.payloadCode || '',
          procedureSteps: baseline?.procedureSteps || '',
          expectedOutcome: baseline?.expectedOutcome || '',
          outcome: '',
          coverageRating: 'N/A',
          severity: 'Auto-Calculate',
          securityControls: baseline?.securityControls || [],
          targetAsset: baseline?.targetAsset || '',
          execNotes: '',
          detNotes: '',
          isBaselinePrefilled: Boolean(baseline),
          baselineSource: baseline?.previousSimulationName || null,
          timestamp: '',
        });
        coveredTtpIds.add(upperId);
      });

      // Fuse any uncovered Supporter (Precursor/Conduit/Modifier) into the best-matching Event Card
      uncoveredSupporters.forEach((sup, idx) => {
        const supDomain = sup.operationalRole?.affinityDomain;
        let targetCard =
          newEvents.find((ev) =>
            (ev.ttps || []).some(
              (id) => classifyTtpOperationalRole({ id }).affinityDomain === supDomain
            )
          ) || newEvents[0];

        if (targetCard && !targetCard.ttps.includes(sup.id)) {
          targetCard.ttps = [...targetCard.ttps, sup.id];
          targetCard.mappedTTPs = [...targetCard.ttps];
          coveredTtpIds.add(sup.id);
        } else if (!targetCard) {
          const upperId = sup.id;
          const baseline = getHistoricalBaselineForTTP(upperId, simulationSummaries, events);
          const ttpLabel = humanizeTechniqueActionName(upperId, sup.name || lookupTTPName(mitreData, upperId));
          const defaultName = formatCleanEventTitle(
            baseline?.name || ttpLabel,
            [upperId],
            mitreData,
            baseline?.payloadCode || ''
          );
          newEvents.push({
            id: Date.now() + Math.random() + 200 + idx,
            name: makeUniqueName(defaultName),
            ttps: [upperId],
            mappedTTPs: [upperId],
            eventType: baseline?.eventType || 'Payload',
            payloadCode: baseline?.payloadCode || '',
            procedureSteps: baseline?.procedureSteps || '',
            expectedOutcome: baseline?.expectedOutcome || '',
            outcome: '',
            coverageRating: 'N/A',
            severity: 'Auto-Calculate',
            securityControls: baseline?.securityControls || [],
            targetAsset: baseline?.targetAsset || '',
            execNotes: '',
            detNotes: '',
            isBaselinePrefilled: Boolean(baseline),
            baselineSource: baseline?.previousSimulationName || null,
            timestamp: '',
          });
          coveredTtpIds.add(upperId);
        }
      });
    }
  }

  return newEvents;
}

/**
 * Pure helper that aggregates finalized event procedure outcomes and coverage ratings
 * for a given MITRE ATT&CK TTP ID.
 *
 * @param {string} ttpId
 * @param {Array} finalizedTestResults
 * @param {{ outcome: string, coverageRating: string }} [emptyFallback]
 * @returns {{ outcome: string, coverageRating: string }}
 */
export function computeFinalTtpAggregation(
  ttpId,
  finalizedTestResults = [],
  emptyFallback = { outcome: 'N/A', coverageRating: 'N/A' }
) {
  const procs = (finalizedTestResults || []).filter(p => (p.ttps || []).includes(ttpId));
  if (procs.length === 0) return emptyFallback;

  let explicitScoreTotal = 0;
  let explicitScoreCount = 0;
  let b = 0, a = 0, l = 0, m = 0;

  procs.forEach(p => {
    const out = p.outcome || '';
    if (out.includes('Prevented')) b++;
    else if (out.includes('Alerted')) a++;
    else if (out.includes('Logged')) l++;
    else if (out.includes('Missed')) m++;

    if (p.coverageRating && p.coverageRating !== 'Auto-Calculate' && p.coverageRating !== 'N/A') {
      const cr = String(p.coverageRating).toLowerCase();
      if (cr.includes('optimal')) explicitScoreTotal += 100;
      else if (cr.includes('partial') || cr.includes('medium')) explicitScoreTotal += 50;
      else if (cr.includes('minimal')) explicitScoreTotal += 25;
      else if (cr.includes('none') || cr.includes('no coverage')) explicitScoreTotal += 0;
      explicitScoreCount++;
    }
  });

  const total = b + a + l + m;
  if (total === 0) return { outcome: 'Missed', coverageRating: 'None' };

  const overallOutcome = b > 0 ? 'Prevented' : a > 0 ? 'Alerted' : l > 0 ? 'Logged' : 'Missed';

  if (explicitScoreCount > 0) {
    const avgExplicit = explicitScoreTotal / explicitScoreCount;
    let explicitCov = 'None';
    if (avgExplicit === 100) explicitCov = 'Optimal';
    else if (avgExplicit >= 50) explicitCov = 'Partial';
    else if (avgExplicit > 0) explicitCov = 'Minimal';
    return { outcome: overallOutcome, coverageRating: explicitCov };
  }

  const totalScore = (b * 100) + (a * 100) + (l * 50) + (m * 0);
  const avg = totalScore / total;
  if (avg === 100) return { outcome: b > 0 ? 'Prevented' : 'Alerted', coverageRating: 'Optimal' };
  if (avg >= 50) return { outcome: l > 0 ? 'Logged' : (b > 0 ? 'Prevented' : 'Alerted'), coverageRating: 'Partial' };
  if (avg > 0) return { outcome: m > 0 ? 'Missed' : 'Logged', coverageRating: 'Minimal' };
  return { outcome: 'Missed', coverageRating: 'None' };
}


