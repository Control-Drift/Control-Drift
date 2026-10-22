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
        const searchContext = `${currentHeading}\n${contextLinesBeforeFence.join('\n')}\n${code}`;
        const ttpMatches = searchContext.match(/T\d{4}(?:\.\d{3})?/gi) || [];
        const uniqueTtps = [...new Set(ttpMatches.map((m) => m.toUpperCase()))];

        // Filter to selectedTTPs if matches exist, otherwise keep discovered TTPs
        let mappedTtps = uniqueTtps.filter((id) => selectedIds.size === 0 || selectedIds.has(id));
        if (mappedTtps.length === 0 && uniqueTtps.length > 0) {
          mappedTtps = uniqueTtps;
        }

        const cleanHeading = currentHeading
          .replace(/^#+\s*/, '')
          .replace(/\*\*/g, '')
          .trim();

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
      }
      if (line.trim()) {
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
}) {
  const normalizedSelected = normalizeSelectedTTPsList(selectedTTPs);
  const parsedBlocks = parseDesignCodeBlocks(simulationPayload, normalizedSelected);
  const usedNames = new Set(
    (existingTestResults || []).map((p) => (p.name || '').trim().toLowerCase()).filter(Boolean)
  );
  const coveredTtpIds = new Set();
  (existingTestResults || []).forEach((p) => {
    extractProcTtps(p).forEach((id) => coveredTtpIds.add(id));
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

  // 1. Create events from Step 2 code blocks
  parsedBlocks.forEach((block, idx) => {
    // Teardown & cleanup phases restore the host and should not be scaffolded as EDR validation events
    if (/(?:teardown|clean\s*up)/i.test(block.title)) {
      return;
    }

    let assignedTtps = block.ttps.length > 0 ? [...block.ttps] : [];
    if (assignedTtps.length === 0 && normalizedSelected.length > 0) {
      const uncovered = normalizedSelected.find((t) => !coveredTtpIds.has(t.id));
      assignedTtps = [uncovered ? uncovered.id : normalizedSelected[idx % normalizedSelected.length].id];
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

    const primaryTtp = assignedTtps[0];
    const ttpName = primaryTtp ? lookupTTPName(mitreData, primaryTtp) : '';

    const rawTitle =
      block.title && !/^(recommended|simulation|unified|procedure|step\s*\d+|phase\s*\d+)$/i.test(block.title)
        ? block.title
        : primaryTtp
        ? (assignedTtps.length > 1
            ? `${assignedTtps.join(' + ')} - Chained Validation`
            : `${primaryTtp} - ${ttpName || 'Validation'}`)
        : `Phase ${idx + 1} Execution`;

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

  // 2. Ensure every selected TTP in Step 1 has at least one scaffolded EventCard
  normalizedSelected.forEach((ttp, idx) => {
    const upperId = ttp.id;
    if (coveredTtpIds.has(upperId)) return;

    const baseline = getHistoricalBaselineForTTP(upperId, simulationSummaries, events);
    const ttpLabel = ttp.name || lookupTTPName(mitreData, upperId) || 'Technique Validation';
    const defaultName = baseline?.name || `${upperId} - ${ttpLabel}`;

    newEvents.push({
      id: Date.now() + Math.random() + 100 + idx,
      name: makeUniqueName(defaultName),
      ttps: [upperId],
      mappedTTPs: [upperId],
      eventType: baseline?.eventType || 'Payload',
      payloadCode:
        baseline?.payloadCode ||
        `# Validate telemetry & prevention controls for ${upperId} (${ttpLabel})\n`,
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

  return newEvents;
}

/**
 * Generates an agentless, self-logging PowerShell (.ps1) or Bash (.sh) validation harness
 * with:
 * - Isolated child-process execution per step (survives EDR process termination)
 * - 30-second per-step timeout protection
 * - Incremental crash-safe JSON persistence after every step
 * - Native Win32/HRESULT, AMSI, AppLocker, SELinux/AppArmor & SIGKILL block classification
 * - Local Windows Event Log / Linux auditd telemetry probing
 * - Explicit analyst warnings regarding endpoint vs. SIEM alert verification
 */
export function generateSelfLoggingHarness({
  simulationName = 'Control Drift Simulation',
  simulationPayload = '',
  selectedTTPs = [],
  testResults = [],
  format = 'ps1',
  mitreData = {},
}) {
  const normalizedSelected = normalizeSelectedTTPsList(selectedTTPs);
  let steps = [];

  if (Array.isArray(testResults) && testResults.length > 0) {
    steps = testResults
      .filter((p) => (p.payloadCode && p.payloadCode.trim()) || extractProcTtps(p).length > 0)
      .map((p, idx) => {
        const procTtps = extractProcTtps(p);
        return {
          index: idx + 1,
          name: p.name || `Event ${idx + 1}`,
          ttps: procTtps.length > 0 ? procTtps : ['Unmapped'],
          code: (p.payloadCode || `# Manual validation step for ${p.name || idx + 1}`).trim(),
          expectedOutcome: normalizeOutcomeValue(p.expectedOutcome) || 'Alerted',
        };
      });
  } else {
    const parsed = parseDesignCodeBlocks(simulationPayload, normalizedSelected);
    if (parsed.length > 0) {
      steps = parsed.map((b, idx) => {
        const assignedTtps =
          b.ttps.length > 0
            ? b.ttps
            : normalizedSelected[idx % Math.max(1, normalizedSelected.length)]
            ? [normalizedSelected[idx % normalizedSelected.length].id]
            : [];
        const primaryId = assignedTtps[0] || '';
        const ttpName = primaryId ? lookupTTPName(mitreData, primaryId) : '';
        return {
          index: idx + 1,
          name: b.title || (primaryId ? `${primaryId} - ${ttpName}` : `Phase ${idx + 1}`),
          ttps: assignedTtps,
          code: b.code,
          expectedOutcome: 'Alerted',
        };
      });
    } else {
      steps = normalizedSelected.map((t, idx) => ({
        index: idx + 1,
        name: `${t.id} - ${t.name || lookupTTPName(mitreData, t.id)}`,
        ttps: [t.id],
        code: `Write-Output "Validating ${t.id} (${t.name || 'Technique'})"`,
        expectedOutcome: 'Alerted',
      }));
    }
  }

  if (format === 'sh') {
    const lines = [
      '#!/usr/bin/env bash',
      '# ============================================================================',
      '# CONTROL DRIFT — SELF-LOGGING VALIDATION HARNESS (AGENTLESS BASH v2)',
      `# Simulation: ${simulationName}`,
      `# Generated:  ${new Date().toISOString()}`,
      '#',
      '# ACCURACY & TELEMETRY NOTICE:',
      '#   - Host blocks (EACCES/126, SIGKILL/137, SELinux/AppArmor/fapolicyd) are',
      '#     confirmed locally as "Prevented".',
      '#   - Missing binaries (Exit 127) or timeouts (Exit 124) are flagged as errors,',
      '#     NOT false-positive security blocks.',
      '#   - Commands that execute cleanly (Exit 0) are marked "Logged" with',
      '#     confidence="Verify-SIEM" because an endpoint script cannot see whether',
      '#     your cloud SIEM/EDR console generated a SOC alert.',
      '# ============================================================================',
      '',
      'RESULTS_FILE="./control_drift_results.json"',
      'HOST_NAME=$(hostname 2>/dev/null || echo "linux-host")',
      'USER_NAME=$(whoami 2>/dev/null || echo "user")',
      'RESULTS_JSON="["',
      'FIRST_ENTRY=1',
      '',
      'flush_results() {',
      '  local current_json="${RESULTS_JSON}]"',
      '  cat <<EOF > "$RESULTS_FILE"',
      '{"version":2,"simulation":"' +
        simulationName.replace(/"/g, '\\"') +
        '","host":"$HOST_NAME","user":"$USER_NAME","results":$current_json}',
      'EOF',
      '}',
      '',
    ];

    steps.forEach((step) => {
      const safeName = step.name.replace(/"/g, '\\"');
      const ttpCsv = step.ttps.join(',');
      const b64Cmd =
        typeof btoa === 'function'
          ? btoa(unescape(encodeURIComponent(step.code)))
          : Buffer.from(step.code, 'utf-8').toString('base64');

      lines.push(`echo "----------------------------------------------------------------"`);
      lines.push(`echo "[${step.index}/${steps.length}] Testing: ${safeName} (${ttpCsv})"`);
      lines.push(`TS_NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")`);
      lines.push(`CMD_B64="${b64Cmd}"`);
      lines.push(
        `CMD_DECODED=$(echo "$CMD_B64" | base64 -d 2>/dev/null || echo "$CMD_B64" | base64 -D 2>/dev/null)`
      );
      lines.push(`if command -v timeout >/dev/null 2>&1; then`);
      lines.push(`  OUT_RAW=$(timeout 30s bash -c "$CMD_DECODED" 2>&1)`);
      lines.push(`  EXIT_CODE=$?`);
      lines.push(`else`);
      lines.push(`  OUT_RAW=$( ( eval "$CMD_DECODED" ) 2>&1 )`);
      lines.push(`  EXIT_CODE=$?`);
      lines.push(`fi`);
      lines.push(`BLOCKED="false"`);
      lines.push(`CONFIDENCE="Verify-SIEM"`);
      lines.push(`if [ $EXIT_CODE -eq 127 ]; then`);
      lines.push(`  INFERRED="N/A"`);
      lines.push(`  CONFIDENCE="Prerequisite-Missing"`);
      lines.push(`elif [ $EXIT_CODE -eq 124 ]; then`);
      lines.push(`  INFERRED="N/A"`);
      lines.push(`  CONFIDENCE="Timed-Out"`);
      lines.push(
        `elif [ $EXIT_CODE -eq 126 ] || [ $EXIT_CODE -eq 137 ] || echo "$OUT_RAW" | grep -Eqi "Operation not permitted|Permission denied|Killed|SELinux|AppArmor|fapolicyd"; then`
      );
      lines.push(`  INFERRED="Prevented"`);
      lines.push(`  BLOCKED="true"`);
      lines.push(`  CONFIDENCE="Host-Confirmed"`);
      lines.push(`elif [ $EXIT_CODE -ne 0 ]; then`);
      lines.push(`  INFERRED="Logged"`);
      lines.push(`  CONFIDENCE="NonZero-Exit-Verify"`);
      lines.push(`else`);
      lines.push(`  INFERRED="Logged"`);
      lines.push(`  CONFIDENCE="Verify-SIEM"`);
      lines.push(`fi`);
      lines.push(`OUT_CLEAN=$(echo "$OUT_RAW" | head -c 380 | tr '\\n\\r"\\\\' '    ')`);
      lines.push(`if [ $FIRST_ENTRY -eq 0 ]; then RESULTS_JSON="$RESULTS_JSON,"; fi`);
      lines.push(`FIRST_ENTRY=0`);
      lines.push(
        `RESULTS_JSON="$RESULTS_JSON{\\"stepIndex\\":${step.index},\\"name\\":\\"${safeName}\\",\\"ttps\\":[${step.ttps
          .map((t) => `\\"${t}\\"`)
          .join(
            ','
          )}],\\"exitCode\\":$EXIT_CODE,\\"blocked\\":$BLOCKED,\\"inferredOutcome\\":\\"$INFERRED\\",\\"confidence\\":\\"$CONFIDENCE\\",\\"timestamp\\":\\"$TS_NOW\\",\\"output\\":\\"$OUT_CLEAN\\"}"`
      );
      lines.push(`flush_results`);
      lines.push('');
    });

    lines.push('RESULTS_JSON="$RESULTS_JSON]"');
    lines.push('echo ""');
    lines.push('echo "=== CONTROL_DRIFT_RESULTS_START ==="');
    lines.push('cat "$RESULTS_FILE"');
    lines.push('echo ""');
    lines.push('echo "=== CONTROL_DRIFT_RESULTS_END ==="');
    return lines.join('\n');
  }

  // Default: PowerShell (.ps1) Self-Logging Harness v2 (Isolated Child Process + Local Telemetry Probe + Incremental Save)
  const psLines = [
    '# ============================================================================',
    '# CONTROL DRIFT — SELF-LOGGING VALIDATION HARNESS (AGENTLESS POWERSHELL v2)',
    `# Simulation: ${simulationName}`,
    `# Generated:  ${new Date().toISOString()}`,
    '#',
    '# ACCURACY & TELEMETRY NOTICE:',
    '#   1. Each TTP runs in an isolated child process with a 30s timeout so if EDR',
    '#      kills a single step, the harness survives and logs the block.',
    '#   2. Results are flushed to .\\control_drift_results.json after EVERY step.',
    '#   3. Host blocks (AMSI, Defender 0x800700E1, AppLocker 0x800704EC, EDR kill)',
    '#      and local Windows Event Logs (Defender/AppLocker/Sysmon/4104) are',
    '#      probed automatically.',
    '#   4. IMPORTANT: Unblocked commands (Exit 0) cannot see cloud SIEM/EDR alerts.',
    '#      Always verify unblocked steps in your SIEM/EDR console after import!',
    '# ============================================================================',
    '',
    '$ErrorActionPreference = "Continue"',
    '$ControlDriftResults = @()',
    '$ResultsFilePath = Join-Path (Get-Location) "control_drift_results.json"',
    '',
    'function Save-ControlDriftProgress {',
    '    $Payload = [PSCustomObject]@{',
    '        version = 2',
    `        simulation = '${simulationName.replace(/'/g, "''")}'`,
    '        host = $env:COMPUTERNAME',
    '        user = "$env:USERDOMAIN\\$env:USERNAME"',
    '        executedAt = (Get-Date).ToUniversalTime().ToString("o")',
    '        results = $script:ControlDriftResults',
    '    }',
    '    $Json = $Payload | ConvertTo-Json -Depth 6 -Compress',
    '    $Json | Out-File -FilePath $ResultsFilePath -Encoding utf8 -Force',
    '    return $Json',
    '}',
    '',
    'function Invoke-IsolatedValidationStep {',
    '    param(',
    '        [int]$StepIndex,',
    '        [string]$Name,',
    '        [string[]]$TTPs,',
    '        [string]$Code,',
    '        [string]$ExpectedOutcome,',
    '        [int]$TimeoutMs = 30000',
    '    )',
    '    $StepStartUtc = (Get-Date).ToUniversalTime()',
    '    $StepStartIso = $StepStartUtc.ToString("o")',
    '    $StepOutput = ""',
    '    $StepError = ""',
    '    $StepBlocked = $false',
    '    $StepTimedOut = $false',
    '    $StepPrereqError = $false',
    '    $StepExitCode = 0',
    '    $Confidence = "Verify-SIEM"',
    '    $TelemetryHits = @()',
    '',
    '    # Run in isolated child powershell.exe so EDR process termination does not kill the parent harness',
    '    $WrappedScript = @"',
    '\\$ErrorActionPreference = "Stop"',
    'try {',
    '    $Code',
    '} catch {',
    '    [Console]::Error.WriteLine(\\$_.Exception.Message)',
    '    if (\\$_.Exception.HResult) { exit \\$_.Exception.HResult } else { exit 1 }',
    '}',
    '"@',
    '    $Bytes = [System.Text.Encoding]::Unicode.GetBytes($WrappedScript)',
    '    $Encoded = [Convert]::ToBase64String($Bytes)',
    '',
    '    try {',
    '        $Psi = New-Object System.Diagnostics.ProcessStartInfo',
    '        $Psi.FileName = "powershell.exe"',
    '        $Psi.Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $Encoded"',
    '        $Psi.RedirectStandardOutput = $true',
    '        $Psi.RedirectStandardError = $true',
    '        $Psi.UseShellExecute = $false',
    '        $Psi.CreateNoWindow = $true',
    '',
    '        $Proc = [System.Diagnostics.Process]::Start($Psi)',
    '        $Completed = $Proc.WaitForExit($TimeoutMs)',
    '        if (-not $Completed) {',
    '            try { $Proc.Kill() } catch {}',
    '            $StepTimedOut = $true',
    '            $StepExitCode = 124',
    '            $StepError = "Execution timed out after $($TimeoutMs / 1000)s"',
    '        } else {',
    '            $StepOutput = $Proc.StandardOutput.ReadToEnd().Trim()',
    '            $StepError = $Proc.StandardError.ReadToEnd().Trim()',
    '            $StepExitCode = $Proc.ExitCode',
    '        }',
    '    } catch {',
    '        $StepError = $_.Exception.Message',
    '        $StepExitCode = -1',
    '        $StepBlocked = $true',
    '    }',
    '',
    '    $CombinedText = "$StepOutput $StepError"',
    '    # Detect native Win32/HRESULT & AMSI/EDR block signatures',
    '    $BlockExitCodes = @(225, 1260, -2147024671, -2147023636, -1073741790, -1073741502)',
    '    if ($BlockExitCodes -contains $StepExitCode -or $CombinedText -match "virus|unwanted software|AMSI|blocked by your administrator|blocked by group policy|AppLocker|Windows Defender|Access is denied|Operation did not complete|UnauthorizedAccess|0x800700E1|0x800704EC") {',
    '        $StepBlocked = $true',
    '    }',
    '    if (-not $StepBlocked -and $CombinedText -match "is not recognized as the name of a cmdlet|command not found|The term .* is not recognized") {',
    '        $StepPrereqError = $true',
    '    }',
    '',
    '    # Probe local Windows Event Logs for immediate host telemetry (Defender / AppLocker / Sysmon / PowerShell 4104)',
    '    try {',
    '        $SearchSince = $StepStartUtc.AddSeconds(-2)',
    '        $DefEvents = Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-Windows Defender/Operational"; Id=1116,1117,1121,5007; StartTime=$SearchSince} -MaxEvents 3 -ErrorAction SilentlyContinue',
    '        if ($DefEvents) {',
    '            $StepBlocked = $true',
    '            $TelemetryHits += "Defender Event ID $(($DefEvents | Select-Object -ExpandProperty Id | Select-Object -Unique) -join \',\')"',
    '        }',
    '        $AppLockerEvents = Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-AppLocker/EXE and DLL"; Id=8003,8004; StartTime=$SearchSince} -MaxEvents 3 -ErrorAction SilentlyContinue',
    '        if ($AppLockerEvents) {',
    '            if ($AppLockerEvents.Id -contains 8004) { $StepBlocked = $true }',
    '            $TelemetryHits += "AppLocker Event ID $(($AppLockerEvents | Select-Object -ExpandProperty Id | Select-Object -Unique) -join \',\')"',
    '        }',
    '        $SysmonEvents = Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-Sysmon/Operational"; Id=1,3,10,11; StartTime=$SearchSince} -MaxEvents 5 -ErrorAction SilentlyContinue',
    '        if ($SysmonEvents) {',
    '            $TelemetryHits += "Sysmon Event ID $(($SysmonEvents | Select-Object -ExpandProperty Id | Select-Object -Unique) -join \',\')"',
    '        }',
    '    } catch {}',
    '',
    '    if ($StepBlocked) {',
    '        $InferredOutcome = if ($TelemetryHits.Count -gt 0 -and $ExpectedOutcome -eq "Prevented & Alerted") { "Prevented & Alerted" } else { "Prevented" }',
    '        $Confidence = "Host-Confirmed"',
    '    } elseif ($StepTimedOut) {',
    '        $InferredOutcome = "N/A"',
    '        $Confidence = "Timed-Out"',
    '    } elseif ($StepPrereqError) {',
    '        $InferredOutcome = "N/A"',
    '        $Confidence = "Prerequisite-Missing"',
    '    } elseif ($TelemetryHits.Count -gt 0) {',
    '        $InferredOutcome = "Logged"',
    '        $Confidence = "Local-Telemetry-Logged (Verify SIEM Alert)"',
    '    } else {',
    '        # Command ran unblocked on host; do NOT blindly claim Alerted without SIEM confirmation',
    '        $InferredOutcome = "Logged"',
    '        $Confidence = "Verify-SIEM"',
    '    }',
    '',
    '    $NotesParts = @("Host: $env:COMPUTERNAME", "User: $env:USERNAME", "Exit: $StepExitCode", "Confidence: $Confidence")',
    '    if ($TelemetryHits.Count -gt 0) { $NotesParts += "Local Telemetry: $($TelemetryHits -join \'; \')" }',
    '    if ($StepError) { $NotesParts += "Error: " + ($StepError -replace "[\\r\\n]+", " ").Substring(0, [Math]::Min(180, $StepError.Length)) }',
    '    elseif ($StepOutput) { $NotesParts += "Output: " + ($StepOutput -replace "[\\r\\n]+", " ").Substring(0, [Math]::Min(180, $StepOutput.Length)) }',
    '',
    '    return [PSCustomObject]@{',
    '        stepIndex = $StepIndex',
    '        name = $Name',
    '        ttps = $TTPs',
    '        mappedTTPs = $TTPs',
    '        command = $Code',
    '        payloadCode = $Code',
    '        expectedOutcome = $ExpectedOutcome',
    '        inferredOutcome = $InferredOutcome',
    '        outcome = $InferredOutcome',
    '        confidence = $Confidence',
    '        blocked = $StepBlocked',
    '        timedOut = $StepTimedOut',
    '        prereqError = $StepPrereqError',
    '        exitCode = $StepExitCode',
    '        localTelemetry = ($TelemetryHits -join "; ")',
    '        output = if ($StepError) { $StepError } else { $StepOutput }',
    '        timestamp = $StepStartIso',
    '        execNotes = ($NotesParts -join " | ")',
    '    }',
    '}',
    '',
  ];

  steps.forEach((step) => {
    const safeName = step.name.replace(/'/g, "''");
    const ttpArrayLiteral = step.ttps.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ');
    const safeExpected = (step.expectedOutcome || 'Alerted').replace(/'/g, "''");

    psLines.push(`Write-Host "----------------------------------------------------------------" -ForegroundColor DarkCyan`);
    psLines.push(
      `Write-Host "[${step.index}/${steps.length}] Validating: ${safeName} (${step.ttps.join(', ')})" -ForegroundColor Cyan`
    );
    psLines.push(`$StepCode_${step.index} = @'`);
    psLines.push(step.code);
    psLines.push(`'@`);
    psLines.push(
      `$StepResult_${step.index} = Invoke-IsolatedValidationStep -StepIndex ${step.index} -Name '${safeName}' -TTPs @(${ttpArrayLiteral}) -Code $StepCode_${step.index} -ExpectedOutcome '${safeExpected}'`
    );
    psLines.push(`$ControlDriftResults += $StepResult_${step.index}`);
    psLines.push(`$LatestJson = Save-ControlDriftProgress`);
    psLines.push(
      `Write-Host "  -> Inferred: $($StepResult_${step.index}.inferredOutcome) | Confidence: $($StepResult_${step.index}.confidence)" -ForegroundColor Yellow`
    );
    psLines.push('');
  });

  psLines.push('$FinalJson = Save-ControlDriftProgress');
  psLines.push('Write-Host ""');
  psLines.push('Write-Host "=== CONTROL_DRIFT_RESULTS_START ===" -ForegroundColor Magenta');
  psLines.push('Write-Output $FinalJson');
  psLines.push('Write-Host "=== CONTROL_DRIFT_RESULTS_END ===" -ForegroundColor Magenta');
  psLines.push(
    'Write-Host "Saved crash-safe results to .\\control_drift_results.json — Paste the block above into Control Drift Step 3!" -ForegroundColor Green'
  );

  return psLines.join('\n');
}

/**
 * Parses pasted terminal output (either containing === CONTROL_DRIFT_RESULTS_START ===,
 * raw JSON from control_drift_results.json, or freeform terminal output) into Step 3 EventCard objects.
 *
 * Returns an array of updated EventCard objects that also attaches a non-enumerable `updatedEvents`
 * property and `summary` metadata so callers expecting either `array` or `{ updatedEvents, summary }` work seamlessly.
 */
export function parseHarnessOutput(
  rawInput = '',
  existingTestResults = [],
  selectedTTPs = [],
  simulationSummaries = {},
  events = {}
) {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new Error('Please paste terminal output or JSON results to import.');
  }

  const normalizedSelected = normalizeSelectedTTPsList(selectedTTPs);
  let jsonText = rawInput.trim();
  const markerMatch = rawInput.match(
    /===\s*CONTROL_DRIFT_RESULTS_START\s*===\s*([\s\S]*?)\s*===\s*CONTROL_DRIFT_RESULTS_END\s*===/i
  );
  if (markerMatch && markerMatch[1]) {
    jsonText = markerMatch[1].trim();
  } else {
    const objMatch = rawInput.match(/\{[\s\S]*"results"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
    if (objMatch) {
      jsonText = objMatch[0];
    }
  }

  let parsedPayload = null;
  try {
    parsedPayload = JSON.parse(jsonText);
  } catch {
    parsedPayload = null;
  }

  const resultsArray = Array.isArray(parsedPayload)
    ? parsedPayload
    : Array.isArray(parsedPayload?.results)
    ? parsedPayload.results
    : null;

  const attachCompatMetadata = (arr, meta = {}) => {
    Object.defineProperty(arr, 'updatedEvents', {
      value: arr,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(arr, 'summary', {
      value: meta,
      enumerable: false,
      configurable: true,
    });
    return arr;
  };

  if (!resultsArray || resultsArray.length === 0) {
    // Fallback: treat rawInput as freeform terminal output for a single or existing event
    const isBlocked =
      /virus|unwanted software|AMSI|blocked|Access is denied|Operation did not complete|Permission denied|Operation not permitted/i.test(
        rawInput
      );
    const isPrereqError =
      /is not recognized as the name of a cmdlet|command not found|No such file or directory/i.test(
        rawInput
      );
    const discoveredTtps = [
      ...new Set((rawInput.match(/T\d{4}(?:\.\d{3})?/gi) || []).map((t) => t.toUpperCase())),
    ];
    const targetTtps =
      discoveredTtps.length > 0
        ? discoveredTtps
        : normalizedSelected.length > 0
        ? [normalizedSelected[0].id]
        : [];
    const primaryTtp = targetTtps[0];
    const baseline = primaryTtp
      ? getHistoricalBaselineForTTP(primaryTtp, simulationSummaries, events)
      : null;

    const outcome = isPrereqError ? 'N/A' : isBlocked ? 'Prevented' : 'Logged';
    const cascaded = getOutcomeCascadedFields(outcome);
    const harnessConfidence = isPrereqError
      ? 'Prerequisite-Missing'
      : isBlocked
      ? 'Host-Confirmed'
      : 'Verify-SIEM';

    const fallbackList = [
      ...existingTestResults,
      {
        id: Date.now() + Math.random(),
        name: primaryTtp
          ? `${primaryTtp} Terminal Import`
          : `Imported Terminal Event (${existingTestResults.length + 1})`,
        ttps: targetTtps,
        mappedTTPs: targetTtps,
        eventType: 'Payload',
        payloadCode: '',
        expectedOutcome: baseline?.expectedOutcome || '',
        outcome,
        status: cascaded.status,
        coverageRating: cascaded.coverageRating,
        severity: cascaded.severity,
        securityControls: baseline?.securityControls || [],
        isHarnessImported: true,
        harnessConfidence,
        isBaselineVerified: Boolean(
          baseline?.expectedOutcome &&
            normalizeOutcomeValue(outcome) === normalizeOutcomeValue(baseline.expectedOutcome)
        ),
        execNotes: rawInput.trim().replace(/\s+/g, ' ').slice(0, 350),
        detNotes: isPrereqError
          ? 'Prerequisite or command syntax error detected in terminal output. Re-run after fixing command.'
          : isBlocked
          ? 'Host block confirmed from terminal output (OS/EDR/AMSI).'
          : 'Unblocked execution on host — Inferred as "Logged". Please verify in your SIEM/EDR console whether an alert fired.',
      },
    ];

    return attachCompatMetadata(fallbackList, {
      totalImported: 1,
      hostConfirmedCount: isBlocked ? 1 : 0,
      verifySiemCount: !isBlocked && !isPrereqError ? 1 : 0,
      errorCount: isPrereqError ? 1 : 0,
    });
  }

  // Merge or append structured harness results
  const updated = [...existingTestResults];
  const hostName = parsedPayload?.host || '';
  const hostLabel = hostName ? `Host: ${hostName}` : '';
  let hostConfirmedCount = 0;
  let verifySiemCount = 0;
  let errorCount = 0;

  resultsArray.forEach((item, idx) => {
    const rawTtps = item.ttps || item.mappedTTPs || [];
    const itemTtps = Array.isArray(rawTtps)
      ? rawTtps.map((t) => String(t).toUpperCase())
      : rawTtps
      ? [String(rawTtps).toUpperCase()]
      : [];
    const primaryTtp = itemTtps[0];
    const baseline = primaryTtp
      ? getHistoricalBaselineForTTP(primaryTtp, simulationSummaries, events)
      : null;

    const rawOutputText = String(item.output || item.execNotes || '');
    const isExplicitBlock =
      Boolean(item.blocked) ||
      /virus|unwanted software|AMSI|blocked|Access is denied|Operation did not complete|Permission denied|Operation not permitted/i.test(
        rawOutputText
      );
    const isPrereqOrTimeout =
      Boolean(item.timedOut) ||
      Boolean(item.prereqError) ||
      item.exitCode === 127 ||
      item.exitCode === 124 ||
      /Prerequisite-Missing|Timed-Out/i.test(String(item.confidence || ''));

    // Preserve explicit outcome if provided in JSON (e.g. "Blocked", "Prevented", "Logged")
    const explicitRawOutcome = item.outcome || item.inferredOutcome || '';
    let outcome = '';
    if (isPrereqOrTimeout) {
      outcome = 'N/A';
    } else if (explicitRawOutcome) {
      // Keep "Blocked" if caller explicitly passed "Blocked", otherwise normalize
      outcome =
        explicitRawOutcome === 'Blocked'
          ? 'Blocked'
          : normalizeOutcomeValue(explicitRawOutcome) || 'Logged';
    } else if (isExplicitBlock) {
      outcome = 'Prevented';
    } else {
      outcome = 'Logged';
    }

    const cascaded = getOutcomeCascadedFields(outcome);
    const harnessConfidence =
      item.confidence ||
      (isPrereqOrTimeout
        ? 'Prerequisite-Missing'
        : isExplicitBlock || normalizeOutcomeValue(outcome) === 'Prevented'
        ? 'Host-Confirmed'
        : 'Verify-SIEM');

    if (harnessConfidence === 'Host-Confirmed') hostConfirmedCount++;
    else if (isPrereqOrTimeout) errorCount++;
    else verifySiemCount++;

    const execNoteParts = [
      item.execNotes || '',
      !item.execNotes && hostLabel ? hostLabel : '',
      !item.execNotes && item.exitCode != null ? `Exit: ${item.exitCode}` : '',
      !item.execNotes && item.output ? `Output: ${String(item.output).slice(0, 220)}` : '',
    ].filter(Boolean);

    // Check if an existing event card matches by name or TTP
    const existingIdx = updated.findIndex((e) => {
      const eTtps = extractProcTtps(e);
      const nameMatches =
        item.name && e.name && e.name.toLowerCase() === String(item.name).toLowerCase();
      const ttpMatches = primaryTtp && eTtps.includes(primaryTtp);
      return (!e.outcome || e.outcome === 'N/A' || e.outcome === '') && (nameMatches || ttpMatches);
    });

    const expectedVal =
      item.expectedOutcome ||
      (existingIdx >= 0 && updated[existingIdx].expectedOutcome) ||
      baseline?.expectedOutcome ||
      'Alerted';

    const isBaselineVerified = Boolean(
      expectedVal &&
        outcome &&
        outcome !== 'N/A' &&
        normalizeOutcomeValue(outcome) === normalizeOutcomeValue(expectedVal)
    );

    let detNotesText = '';
    if (isPrereqOrTimeout) {
      detNotesText = `Execution error or timeout (Exit ${item.exitCode ?? 'N/A'}). Not counted as a security block—verify command prerequisites.`;
    } else if (harnessConfidence === 'Host-Confirmed' || isExplicitBlock) {
      detNotesText = `Host-level prevention confirmed during harness execution${
        item.localTelemetry ? ` (${item.localTelemetry})` : ' (OS/EDR/AMSI block)'
      }.`;
    } else if (item.localTelemetry) {
      detNotesText = `Local endpoint telemetry recorded (${item.localTelemetry}), but cloud SIEM/EDR alert status cannot be verified by a host script. Please confirm if an alert fired.`;
    } else {
      detNotesText = `Payload executed unblocked on host (Exit Code: ${
        item.exitCode ?? 0
      }). Inferred as "Logged" — verify in your SIEM/EDR console whether this triggered an Alert or was Missed.`;
    }

    const mergedCard = {
      ...(existingIdx >= 0 ? updated[existingIdx] : {}),
      id: existingIdx >= 0 ? updated[existingIdx].id : Date.now() + Math.random() + idx,
      name:
        item.name ||
        (existingIdx >= 0
          ? updated[existingIdx].name
          : `${primaryTtp || 'Event'} Validation (${idx + 1})`),
      ttps: itemTtps.length > 0 ? itemTtps : existingIdx >= 0 ? extractProcTtps(updated[existingIdx]) : [],
      mappedTTPs:
        itemTtps.length > 0 ? itemTtps : existingIdx >= 0 ? extractProcTtps(updated[existingIdx]) : [],
      eventType: 'Payload',
      payloadCode:
        item.payloadCode ||
        item.command ||
        (existingIdx >= 0 ? updated[existingIdx].payloadCode : ''),
      expectedOutcome: expectedVal,
      outcome,
      status: cascaded.status,
      coverageRating: cascaded.coverageRating,
      severity: cascaded.severity,
      targetAsset:
        hostName || (existingIdx >= 0 ? updated[existingIdx].targetAsset || '' : ''),
      securityControls:
        (existingIdx >= 0 && updated[existingIdx].securityControls?.length > 0
          ? updated[existingIdx].securityControls
          : baseline?.securityControls) || [],
      isHarnessImported: true,
      harnessConfidence,
      isBaselineVerified,
      execNotes:
        execNoteParts.join(' | ') || `Executed at ${item.timestamp || new Date().toISOString()}`,
      detNotes: detNotesText,
    };

    if (existingIdx >= 0) {
      updated[existingIdx] = mergedCard;
    } else {
      updated.push(mergedCard);
    }
  });

  return attachCompatMetadata(updated, {
    totalImported: resultsArray.length,
    hostConfirmedCount,
    verifySiemCount,
    errorCount,
  });
}
