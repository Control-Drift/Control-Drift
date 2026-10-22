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
import {
  calculateAverageStatus,
  calculateConfidenceAndDecay,
  lookupTTPName,
  KILL_CHAIN_ORDER
} from '../lib/mitreUtils';
import {
  normalizeOutcomeValue,
  getOutcomeCascadedFields,
  getHistoricalBaselineForTTP,
  getHistoricalProceduresForTTPs,
  formatHistoricalProceduresForAIPrompt,
  parseDesignCodeBlocks,
  scaffoldEventsFromDesignAndTTPs,
  generateSelfLoggingHarness,
  parseHarnessOutput
} from '../lib/simulationAutomation';

describe('mitreUtils', () => {
  describe('calculateAverageStatus', () => {
    it('returns unknown for empty or untested inputs', () => {
      expect(calculateAverageStatus([])).toBe('unknown');
      expect(calculateAverageStatus(['unknown', 'na'])).toBe('unknown');
    });

    it('returns high only when every valid status is high', () => {
      expect(calculateAverageStatus(['high', 'high', 'high'])).toBe('high');
      expect(calculateAverageStatus(['high', 'high', 'medium'])).toBe('medium');
    });

    it('properly averages mixed statuses', () => {
      expect(calculateAverageStatus(['medium', 'medium'])).toBe('medium');
      expect(calculateAverageStatus(['minimal', 'low'])).toBe('minimal');
      expect(calculateAverageStatus(['low', 'low'])).toBe('low');
    });
  });

  describe('calculateConfidenceAndDecay', () => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    it('returns zeroed baseline for untested techniques', () => {
      const res = calculateConfidenceAndDecay(0, null);
      expect(res.testCount).toBe(0);
      expect(res.densityFactor).toBe(0);
      expect(res.confidenceLabel).toBe('Untested');
      expect(res.driftStatus).toBe('Untested');
      expect(res.visualWeight).toBe(0);
      expect(res.needsRetest).toBe(false);
    });

    it('scales densityFactor and Depth tiers by execution count (1=Low, 2-3=Medium, 4+=High)', () => {
      const now = Date.now();
      const singleRecent = calculateConfidenceAndDecay(
        1,
        new Date(now - 5 * MS_PER_DAY).toISOString()
      );
      expect(singleRecent.densityFactor).toBe(0.4);
      expect(singleRecent.confidenceLabel).toBe('Low');

      const mediumRecent = calculateConfidenceAndDecay(
        2,
        new Date(now - 5 * MS_PER_DAY).toISOString()
      );
      expect(mediumRecent.densityFactor).toBe(0.6);
      expect(mediumRecent.confidenceLabel).toBe('Medium');

      const highRecent = calculateConfidenceAndDecay(
        4,
        new Date(now - 5 * MS_PER_DAY).toISOString()
      );
      expect(highRecent.densityFactor).toBe(1.0);
      expect(highRecent.confidenceLabel).toBe('High');
    });

    it('extends effectiveHalfLifeDays as simulation density increases (90d -> 144d)', () => {
      const now = Date.now();
      const oneTestAt90d = calculateConfidenceAndDecay(
        1,
        new Date(now - 90 * MS_PER_DAY).toISOString(),
        { referenceTime: now }
      );
      const fiveTestsAt90d = calculateConfidenceAndDecay(
        5,
        new Date(now - 90 * MS_PER_DAY).toISOString(),
        { referenceTime: now }
      );

      expect(oneTestAt90d.effectiveHalfLifeDays).toBe(90);
      expect(fiveTestsAt90d.effectiveHalfLifeDays).toBe(144);
      expect(fiveTestsAt90d.decayFactor).toBeGreaterThan(oneTestAt90d.decayFactor);
    });

    it('keeps Fresh within the 30-day grace window with no decay penalty', () => {
      const now = Date.now();
      const res = calculateConfidenceAndDecay(
        5,
        new Date(now - 20 * MS_PER_DAY).toISOString()
      );
      expect(res.daysSinceLastTest).toBe(20);
      expect(res.decayFactor).toBe(1.0);
      expect(res.driftStatus).toBe('Fresh');
      expect(res.needsRetest).toBe(false);
      expect(res.visualWeight).toBe(1.0);
    });

    it('graduates Aging and Decayed lifespan thresholds based on Depth (testCount) and Coverage Status', () => {
      const now = Date.now();
      // Shallow depth (1 test): 45d Aging, 90d Decayed
      const shallowAging = calculateConfidenceAndDecay(
        1,
        new Date(now - 60 * MS_PER_DAY).toISOString()
      );
      expect(shallowAging.effectiveAgingDays).toBe(45);
      expect(shallowAging.effectiveStaleDays).toBe(90);
      expect(shallowAging.driftStatus).toBe('Aging');
      expect(shallowAging.needsRetest).toBe(false);

      // Medium depth (2 tests): 75d Aging, 150d Decayed -> still Fresh at 60d, Aging at 100d
      const medFreshAt60 = calculateConfidenceAndDecay(
        2,
        new Date(now - 60 * MS_PER_DAY).toISOString()
      );
      expect(medFreshAt60.effectiveAgingDays).toBe(75);
      expect(medFreshAt60.effectiveStaleDays).toBe(150);
      expect(medFreshAt60.driftStatus).toBe('Fresh');

      // High depth (5 tests) with Optimal status: 120d Aging, 240d Decayed
      const highOptimalAt130 = calculateConfidenceAndDecay(
        5,
        new Date(now - 130 * MS_PER_DAY).toISOString(),
        { status: 'high' }
      );
      expect(highOptimalAt130.effectiveAgingDays).toBe(120);
      expect(highOptimalAt130.effectiveStaleDays).toBe(240);
      expect(highOptimalAt130.driftStatus).toBe('Aging');
      expect(highOptimalAt130.needsRetest).toBe(false);
    });

    it('flags Decayed and needsRetest once effectiveStaleDays is exceeded and clamps decay at 0.25', () => {
      const now = Date.now();
      const decayedShallow = calculateConfidenceAndDecay(
        1,
        new Date(now - 120 * MS_PER_DAY).toISOString()
      );
      expect(decayedShallow.daysSinceLastTest).toBe(120);
      expect(decayedShallow.driftStatus).toBe('Decayed');
      expect(decayedShallow.needsRetest).toBe(true);

      const maxStale = calculateConfidenceAndDecay(
        5,
        new Date(now - 400 * MS_PER_DAY).toISOString()
      );
      expect(maxStale.decayFactor).toBe(0.25);
      expect(maxStale.driftStatus).toBe('Decayed');
      expect(maxStale.needsRetest).toBe(true);
    });
  });

  describe('lookupTTPName and KILL_CHAIN_ORDER', () => {
    const mockMitreData = {
      Execution: {
        techniques: [
          {
            id: 'T1059',
            name: 'Command and Scripting Interpreter',
            subTechniques: [
              { id: 'T1059.001', name: 'PowerShell' },
              { id: 'T1059.003', name: 'Windows Command Shell' }
            ]
          }
        ]
      }
    };

    it('resolves parent technique and sub-technique names accurately', () => {
      expect(lookupTTPName(mockMitreData, 'T1059')).toBe('Command and Scripting Interpreter');
      expect(lookupTTPName(mockMitreData, 'T1059.001')).toBe('PowerShell');
      expect(lookupTTPName(mockMitreData, 'T9999')).toBe('Unknown Technique');
      expect(lookupTTPName(null, 'T1059')).toBe('Unknown Technique');
    });

    it('exports canonical KILL_CHAIN_ORDER', () => {
      expect(Array.isArray(KILL_CHAIN_ORDER)).toBe(true);
      expect(KILL_CHAIN_ORDER).toContain('Initial Access');
      expect(KILL_CHAIN_ORDER).toContain('Execution');
      expect(KILL_CHAIN_ORDER).toContain('Impact');
    });
  });

  describe('simulationAutomation', () => {
    const mockSimulations = {
      'Q3 Baseline Validation': {
        timestamp: '2026-08-01T12:00:00.000Z',
        testResults: [
          {
            id: 101,
            name: 'PowerShell Encoded Command',
            mappedTTPs: ['T1059.001'],
            outcome: 'Blocked',
            expectedOutcome: 'Blocked',
            securityControls: ['CrowdStrike Falcon', 'Windows Defender'],
            payloadCode: 'powershell.exe -enc UwB0AGEAcgB0AC0AUAByAG8AYwBlAHMAcwA=',
            targetAsset: 'WKSTN-01'
          }
        ]
      }
    };

    it('retrieves historical baseline memory and procedural evolution context for previously tested TTPs', () => {
      const baseline = getHistoricalBaselineForTTP('T1059.001', mockSimulations, []);
      expect(baseline).not.toBeNull();
      expect(baseline.outcome).toBe('Blocked');
      expect(baseline.expectedOutcome).toBe('Prevented');
      expect(baseline.securityControls).toEqual(['CrowdStrike Falcon', 'Windows Defender']);
      expect(baseline.payloadCode).toContain('powershell.exe -enc');
      expect(baseline.sourceSimulation).toBe('Q3 Baseline Validation');

      const mockMitre = {
        Execution: {
          techniques: [
            {
              id: 'T1059',
              name: 'Command and Scripting Interpreter',
              subTechniques: [
                { id: 'T1059.001', name: 'PowerShell' },
                { id: 'T1059.003', name: 'Windows Command Shell' }
              ]
            }
          ]
        }
      };
      const evo = getHistoricalProceduresForTTPs(
        [{ id: 'T1059.001', name: 'PowerShell' }],
        mockSimulations,
        [],
        mockMitre
      );
      expect(evo).toHaveLength(1);
      expect(evo[0].procedures).toHaveLength(1);
      expect(evo[0].procedures[0].name).toBe('PowerShell Encoded Command');
      expect(evo[0].untestedSiblings).toEqual([{ id: 'T1059.003', name: 'Windows Command Shell' }]);

      const aiPrompt = formatHistoricalProceduresForAIPrompt(evo);
      expect(aiPrompt).toContain('PREVIOUSLY VALIDATED PROCEDURES (DO NOT REPEAT');
      expect(aiPrompt).toContain('PowerShell Encoded Command');
      expect(aiPrompt).toContain('T1059.003');
    });

    it('does NOT falsely map parent technique procedures to sub-techniques or vice-versa', () => {
      const mockParentSims = {
        'Parent Only Sim': {
          timestamp: '2026-08-01T12:00:00.000Z',
          testResults: [
            {
              id: 201,
              name: 'Phase 1: Remote Thread Process Injection Simulation (T1055)',
              mappedTTPs: ['T1055'],
              outcome: 'Prevented & Alerted'
            }
          ]
        }
      };
      const mockMitreT1055 = {
        'Defense Evasion': {
          techniques: [
            {
              id: 'T1055',
              name: 'Process Injection',
              subTechniques: [
                { id: 'T1055.004', name: 'Asynchronous Procedure Call' },
                { id: 'T1055.012', name: 'Process Hollowing' }
              ]
            }
          ]
        }
      };
      const history = getHistoricalProceduresForTTPs(
        [
          { id: 'T1055.012', name: 'Process Hollowing' },
          { id: 'T1055', name: 'Process Injection' },
          { id: 'T1055.004', name: 'Asynchronous Procedure Call' }
        ],
        mockParentSims,
        [],
        mockMitreT1055
      );
      
      const sub12 = history.find(h => h.ttpId === 'T1055.012');
      const parent = history.find(h => h.ttpId === 'T1055');
      const sub04 = history.find(h => h.ttpId === 'T1055.004');

      expect(parent.procedures).toHaveLength(1);
      expect(parent.procedures[0].name).toBe('Phase 1: Remote Thread Process Injection Simulation (T1055)');

      // Sub-techniques should NOT inherit the parent technique's procedure
      expect(sub12.procedures).toHaveLength(0);
      expect(sub04.procedures).toHaveLength(0);
    });

    it('parses markdown code blocks and scaffolds Step 3 events with historical baselines', () => {
      const md = [
        '### Phase 1: PowerShell Execution (T1059.001)',
        '```powershell',
        'Get-Process | Select-Object -First 3',
        '```',
        '### Phase 2: OS Credential Dumping (T1003)',
        '```powershell',
        'rundll32.exe C:\\windows\\System32\\comsvcs.dll, MiniDump 624 lsass.dmp full',
        '```'
      ].join('\n');

      const blocks = parseDesignCodeBlocks(md, ['T1059.001', 'T1003']);
      expect(blocks.length).toBe(2);
      expect(blocks[0].mappedTTPs).toContain('T1059.001');
      expect(blocks[1].mappedTTPs).toContain('T1003');

      const events = scaffoldEventsFromDesignAndTTPs({
        simulationPayload: md,
        selectedTTPs: ['T1059.001', 'T1003'],
        simulationSummaries: mockSimulations,
        events: []
      });

      expect(events.length).toBe(2);
      expect(events[0].isBaselinePrefilled).toBe(true);
      expect(events[0].expectedOutcome).toBe('Prevented');
      expect(events[0].securityControls).toContain('CrowdStrike Falcon');
      expect(events[1].mappedTTPs).toEqual(['T1003']);
      expect(events[1].expectedOutcome).toBe(''); // Defaults to 'Select Outcome...' when no baseline exists

      // Verifies dedicated teardown/cleanup blocks are parsed but not scaffolded as test events
      const mdWithCleanup = [
        '### Phase 1: PowerShell Execution (T1059.001)',
        '```powershell',
        'Get-Process | Select-Object -First 3',
        '```',
        '### Phase 2: Simulation Teardown & Cleanup',
        '```powershell',
        'Remove-Item -Path "C:\\Temp\\test.txt" -Force',
        '```'
      ].join('\n');

      const eventsWithCleanup = scaffoldEventsFromDesignAndTTPs({
        simulationPayload: mdWithCleanup,
        selectedTTPs: ['T1059.001'],
        simulationSummaries: {},
        events: []
      });

      expect(eventsWithCleanup.length).toBe(1);
      expect(eventsWithCleanup[0].mappedTTPs).toEqual(['T1059.001']);
      expect(eventsWithCleanup[0].expectedOutcome).toBe(''); // Defaults to 'Select Outcome...'

      // Verifies multi-TTP chained procedure parses multiple techniques and aggregates controls
      const mdChained = [
        '### Phase 1: In-Memory Process Injection via PowerShell (T1059.001, T1055.001)',
        '```powershell',
        '# In-memory injection code',
        '```'
      ].join('\n');

      const chainedBlocks = parseDesignCodeBlocks(mdChained, ['T1059.001', 'T1055.001']);
      expect(chainedBlocks.length).toBe(1);
      expect(chainedBlocks[0].mappedTTPs).toEqual(['T1059.001', 'T1055.001']);

      const chainedEvents = scaffoldEventsFromDesignAndTTPs({
        simulationPayload: mdChained,
        selectedTTPs: ['T1059.001', 'T1055.001'],
        simulationSummaries: mockSimulations,
        events: []
      });
      expect(chainedEvents.length).toBe(1);
      expect(chainedEvents[0].ttps).toEqual(['T1059.001', 'T1055.001']);
      expect(chainedEvents[0].securityControls).toContain('CrowdStrike Falcon');
    });

    it('generates agentless self-logging harness scripts and parses structured output back with confidence tracking', () => {
      const ps1 = generateSelfLoggingHarness({
        format: 'ps1',
        simulationName: 'Automated Harness Check',
        testResults: [
          {
            id: 1,
            name: 'PowerShell Check',
            mappedTTPs: ['T1059.001'],
            expectedOutcome: 'Prevented',
            securityControls: ['CrowdStrike Falcon'],
            payloadCode: 'whoami /all'
          }
        ]
      });

      expect(ps1).toContain('CONTROL_DRIFT_RESULTS_START');
      expect(ps1).toContain('Invoke-IsolatedValidationStep');
      expect(ps1).toContain('T1059.001');

      const sampleTerminalOutput = [
        '=== Control Drift Validation Harness ===',
        '=== CONTROL_DRIFT_RESULTS_START ===',
        JSON.stringify({
          simulationName: 'Automated Harness Check',
          host: 'WORKSTATION-09',
          user: 'CORP\\analyst',
          executedAt: '2026-10-18T15:00:00Z',
          results: [
            {
              stepIndex: 1,
              name: 'PowerShell Check',
              mappedTTPs: ['T1059.001'],
              outcome: 'Prevented',
              expectedOutcome: 'Prevented',
              blocked: true,
              confidence: 'Host-Confirmed',
              exitCode: 1,
              command: 'whoami /all',
              output: 'Access is denied by AMSI / Endpoint Protection',
              timestamp: '2026-10-18T15:00:01Z'
            },
            {
              stepIndex: 2,
              name: 'Unblocked Discovery',
              mappedTTPs: ['T1082'],
              inferredOutcome: 'Logged',
              expectedOutcome: 'Alerted',
              blocked: false,
              confidence: 'Verify-SIEM',
              exitCode: 0,
              command: 'systeminfo',
              output: 'Host Name: WORKSTATION-09',
              timestamp: '2026-10-18T15:00:02Z'
            }
          ]
        }),
        '=== CONTROL_DRIFT_RESULTS_END ==='
      ].join('\n');

      const parsed = parseHarnessOutput(sampleTerminalOutput, [
        {
          id: 99,
          name: 'PowerShell Check',
          mappedTTPs: ['T1059.001'],
          expectedOutcome: 'Prevented',
          securityControls: ['CrowdStrike Falcon'],
          payloadCode: 'whoami /all'
        }
      ]);

      expect(parsed.updatedEvents.length).toBe(2);
      expect(parsed.updatedEvents[0].outcome).toBe('Prevented');
      expect(parsed.updatedEvents[0].harnessConfidence).toBe('Host-Confirmed');
      expect(parsed.updatedEvents[0].status).toBe('high');
      expect(parsed.updatedEvents[0].isBaselineVerified).toBe(true);
      expect(parsed.updatedEvents[0].targetAsset).toBe('WORKSTATION-09');

      expect(parsed.updatedEvents[1].outcome).toBe('Logged');
      expect(parsed.updatedEvents[1].harnessConfidence).toBe('Verify-SIEM');
      expect(parsed.summary.hostConfirmedCount).toBe(1);
      expect(parsed.summary.verifySiemCount).toBe(1);
    });

    it('normalizes outcomes and cascades status/severity accurately', () => {
      expect(normalizeOutcomeValue('prevented')).toBe('Prevented');
      expect(normalizeOutcomeValue('Blocked')).toBe('Prevented');
      expect(normalizeOutcomeValue('bypassed')).toBe('Missed');
      expect(getOutcomeCascadedFields('Prevented', 'Medium').status).toBe('high');
      expect(getOutcomeCascadedFields('Missed', 'Informational').severity).toBe('High');
    });
  });
});

