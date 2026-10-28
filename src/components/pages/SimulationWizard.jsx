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

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../AppContext';
import { useToast } from '../ui/Toast';
import { CheckSquare, Trash2, X, Users, Database, Loader2, Save, Activity } from 'lucide-react';
import { TACTIC_ICONS } from '../ui/CustomIcons';
import { KILL_CHAIN_ORDER, lookupTTPName } from '../../lib/mitreUtils';
import { classifyTtpOperationalRole, clusterTTPsIntoCompoundEvents } from '../../lib/mitreStixCti';
import {
    getHistoricalBaselineForTTP,
    getHistoricalProceduresForTTPs,
    formatHistoricalProceduresForAIPrompt,
    scaffoldEventsFromDesignAndTTPs,
    formatCleanEventTitle,
    computeFinalTtpAggregation
} from '../../lib/simulationAutomation';
import { useNavigate, useLocation } from 'react-router-dom';

import Step1BasicDetails from './SimulationWizard/Step1BasicDetails';
import Step2Design from './SimulationWizard/Step2Design';
import Step3Execute from './SimulationWizard/Step3Execute';
import Step4Report from './SimulationWizard/Step4Report';

/**
 * SimulationWizard Component
 * 
 * A multi-step orchestrator used to scope, design, execute, and report a "Simulation" (Campaign).
 * 
 * CORE WORKFLOW:
 * 1. User selects target TTPs from the MITRE matrix.
 * 2. User defines environments, scope, and metadata.
 * 3. User sequentially executes and records outcomes ("Events") for each TTP.
 * 4. The wizard aggregates all atomic Events into a single cohesive Simulation
 *    via the `completeExercise` and `saveSimulationSummary` context actions.
 * 
 * NOMENCLATURE MAP:
 * - "Event": The individual TTP test recorded in the wizard steps.
 * - "Simulation": The final aggregated campaign submitted at the end of the wizard.
 * 
 * @param {Object} props
 */
export default function SimulationWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedImage, setExpandedImage] = useState(null);
  const { completeExercise, events, mitreData, isMitreLoading, generateAIContent, generateAIContentStream, saveSimulationSummary, addSimulationEvidence, removeSimulationEvidence, simulationEvidence, compressImage, aiSettings, setActiveAiContext, gaps, setGaps, createGap, confirmAction, simulationSummaries, isAiActive, addSecurityControl, dbAdapter } = useAppContext();
  const { addToast } = useToast();
  const [step, setStep] = useState(() => { const s = sessionStorage.getItem('wizard_step'); return s ? parseInt(s, 10) : 1; });
  
  const isMounted = React.useRef(true);
  React.useEffect(() => {
      isMounted.current = true;
      return () => {
          isMounted.current = false;
      };
  }, []);

  const [savedDrafts, setSavedDrafts] = useState(() => {
     try {
         const saved = localStorage.getItem('wizard_drafts');
         return saved ? JSON.parse(saved) : [];
     } catch (e) {
         return [];
     }
  });
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [currentDraftId, setCurrentDraftId] = useState(() => sessionStorage.getItem('wizard_draft_id') || null);

  const refreshDrafts = useCallback(async (silent = true) => {
      if (!dbAdapter || typeof dbAdapter.fetchDrafts !== 'function') return;
      if (!silent) setIsLoadingDrafts(true);
      try {
          const remoteDrafts = await dbAdapter.fetchDrafts();
          if (!isMounted.current) return;
          if (Array.isArray(remoteDrafts)) {
              let localDrafts = [];
              try {
                  const raw = localStorage.getItem('wizard_drafts');
                  if (raw) localDrafts = JSON.parse(raw);
              } catch (e) {
                  localDrafts = [];
              }

              // Merge remote drafts with any newer/unsynced local drafts
              const mergedMap = new Map();
              if (dbAdapter.type !== 'supabase') {
                  localDrafts.forEach(d => { if (d && d.id) mergedMap.set(d.id, d); });
              }
              remoteDrafts.forEach(d => {
                  if (!d || !d.id) return;
                  const existing = mergedMap.get(d.id);
                  if (!existing || new Date(d.timestamp || 0) >= new Date(existing.timestamp || 0)) {
                      mergedMap.set(d.id, d);
                  }
              });
              // If connected to Supabase and there are local-only drafts that haven't been synced yet, keep them visible
              if (dbAdapter.type === 'supabase' && Array.isArray(localDrafts)) {
                  localDrafts.forEach(d => {
                      if (d && d.id && !mergedMap.has(d.id)) {
                          mergedMap.set(d.id, { ...d, isLocalOnly: true });
                      }
                  });
              }

              const sorted = Array.from(mergedMap.values()).sort(
                  (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
              );
              setSavedDrafts(sorted);
              try {
                  localStorage.setItem('wizard_drafts', JSON.stringify(sorted));
              } catch (e) {
                  // Ignore quota errors
              }
          }
      } catch (err) {
          console.warn('Failed to refresh simulation drafts:', err);
      } finally {
          if (isMounted.current && !silent) setIsLoadingDrafts(false);
      }
  }, [dbAdapter]);

  useEffect(() => {
      refreshDrafts(true);
  }, [refreshDrafts]);

  const [simulationDetails, setSimulationDetails] = useState(() => {
     const saved = sessionStorage.getItem('wizard_details');
     return saved ? JSON.parse(saved) : { name: '', environmentCategory: [], environment: '', goals: '', participants: [{ id: 1, name: '', role: 'Purple Team' }] };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMapTactic, setActiveMapTactic] = useState(null);
  const [activeMapTechnique, setActiveMapTechnique] = useState(null);
  const [nameConflict, setNameConflict] = useState(false);
  const [showNameErrors, setShowNameErrors] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState({});
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [selectedTTPs, setSelectedTTPs] = useState(() => {
     const saved = sessionStorage.getItem('wizard_ttps');
     return saved ? JSON.parse(saved) : [];
  });
  const [isMappingTTPs, setIsMappingTTPs] = useState(false);
  const [mappingProcedureId, setMappingProcedureId] = useState(null);
  
  const [simulationPayload, setSimulationPayload] = useState(() => sessionStorage.getItem('wizard_payload') || '');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [coPilotInput, setCoPilotInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [testResults, setTestResults] = useState(() => {
     const saved = sessionStorage.getItem('wizard_results');
     if (!saved) return [];
     try {
         const parsed = JSON.parse(saved);
         if (!Array.isArray(parsed)) return [];
         return parsed.map(p => {
             const currentName = p.name || '';
             if (
                 /^(?:phase|step|event|procedure)\s*\d+/i.test(currentName) ||
                 /\(T\d{4}/i.test(currentName) ||
                 /contextual\s+recon/i.test(currentName) ||
                 /^dll$/i.test(currentName.trim())
             ) {
                 return {
                     ...p,
                     name: formatCleanEventTitle(currentName, p.ttps, null, p.payloadCode)
                 };
             }
             return p;
         });
     } catch (e) {
         return [];
     }
  });
  
  const hasUnsavedChanges = testResults.length > 0 || selectedTTPs.length > 0 || simulationDetails.name.trim() !== '';

  const buildUniqueSimName = useCallback(
      (baseName) => {
          if (!simulationSummaries || !simulationSummaries[baseName]) return baseName;
          const shortDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          let candidate = `${baseName} (${shortDate})`;
          let n = 2;
          while (simulationSummaries[candidate]) {
              candidate = `${baseName} (${shortDate} #${n})`;
              n++;
          }
          return candidate;
      },
      [simulationSummaries]
  );

  useEffect(() => {
      if (location.state?.retestTTP) {
          const retest = location.state.retestTTP;
          const ttpName = retest.name || lookupTTPName(mitreData, retest.id);
          const baseline = getHistoricalBaselineForTTP(retest.id, simulationSummaries, events);
          const targetTtpObj = { id: retest.id, name: ttpName };

          setSelectedTTPs([targetTtpObj]);
          if (retest.tactic) setActiveMapTactic(retest.tactic);
          if (retest.id && retest.id.includes('.')) setActiveMapTechnique(retest.id.split('.')[0]);

          const envCats =
              retest.environment
                  ? [retest.environment]
                  : baseline?.environmentCategory?.length > 0
                  ? baseline.environmentCategory
                  : ['Production'];

          const uniqueName = buildUniqueSimName(`Procedural Evolution: ${retest.id}`);
          setSimulationDetails({
              name: uniqueName,
              environmentCategory: envCats,
              environment: envCats.join(', '),
              goals: `Evolve procedural validation depth and refresh State for ${retest.id} (${ttpName || 'Technique'})${retest.daysSinceLastTest != null ? ` (${retest.daysSinceLastTest}d since last test)` : ''}. Design a new procedural variation, alternative interpreter flag, or evasion angle rather than repeating the exact prior payload.`,
              participants: [{ id: 1, name: '', role: 'Purple Team' }]
          });

          const scaffolded = scaffoldEventsFromDesignAndTTPs({
              simulationPayload: '',
              selectedTTPs: [targetTtpObj],
              existingTestResults: [],
              simulationSummaries,
              events,
              mitreData
          }).map(ev => ({ ...ev, isDecayRetest: true }));
          setTestResults(scaffolded);
          setSimulationPayload('');

          if (retest.quickReplay) {
              setStep(3);
              addToast(
                  `Pre-filled ${retest.id} from historical baseline (${baseline?.expectedOutcome || 'Alerted'}) for quick re-testing.`,
                  'info'
              );
          } else {
              setStep(2);
              addToast(
                  `Loaded ${retest.id} into Step 2 Design with prior variations shown—evolve the procedure or click "Generate Evolved Design"!`,
                  'info'
              );
          }
          navigate(location.pathname, { replace: true, state: {} });
      } else if (location.state?.batchRetestTTPs && Array.isArray(location.state.batchRetestTTPs)) {
          const batch = location.state.batchRetestTTPs;
          const ttpObjs = batch.map(item => ({
              id: item.id,
              name: item.name || lookupTTPName(mitreData, item.id)
          }));
          const envSet = new Set();
          batch.forEach(item => {
              const b = getHistoricalBaselineForTTP(item.id, simulationSummaries, events);
              (b?.environmentCategory || []).forEach(e => envSet.add(e));
          });
          const envCats = envSet.size > 0 ? Array.from(envSet) : ['Production'];
          const uniqueName = buildUniqueSimName(`Chained Evolution Re-Test (${batch.length} TTPs)`);

          setSelectedTTPs(ttpObjs);
          setSimulationDetails({
              name: uniqueName,
              environmentCategory: envCats,
              environment: envCats.join(', '),
              goals: `Multi-TTP Chained Scenario Re-Validation across ${batch.length} aging/decayed techniques (${batch.map(b => b.id).join(', ')}). Combine these techniques into a cohesive multi-phase attack chain using evolved procedural variations to refresh State and increase Depth across all ${batch.length} TTPs in a single campaign.`,
              participants: [{ id: 1, name: '', role: 'Purple Team' }]
          });

          const scaffolded = scaffoldEventsFromDesignAndTTPs({
              simulationPayload: '',
              selectedTTPs: ttpObjs,
              existingTestResults: [],
              simulationSummaries,
              events,
              mitreData
          }).map(ev => ({ ...ev, isDecayRetest: true }));
          setTestResults(scaffolded);
          setSimulationPayload('');
          setStep(2);
          addToast(
              `Bundled ${batch.length} decayed/aging TTPs into a Chained Scenario in Step 2! Click "Generate Evolved Design" to build a unified multi-phase emulation plan.`,
              'success'
          );
          navigate(location.pathname, { replace: true, state: {} });
      } else if (location.state?.emulationPlan) {
          const plan = location.state.emulationPlan;
          const rawTtps = Array.isArray(plan.ttps)
              ? plan.ttps
              : Array.isArray(plan.selectedTTPs)
              ? plan.selectedTTPs
              : [];
          const ttpObjs = rawTtps.map(item => {
              const id = typeof item === 'string' ? item : item.id;
              return {
                  id,
                  name: (typeof item === 'object' && item.name) || lookupTTPName(mitreData, id)
              };
          });

          const envCats =
              Array.isArray(plan.environmentCategory) && plan.environmentCategory.length > 0
                  ? plan.environmentCategory
                  : ['Production'];
          const uniqueName = buildUniqueSimName(plan.name || `Adversary Emulation (${ttpObjs.length} TTPs)`);

          setSelectedTTPs(ttpObjs);
          setSimulationDetails({
              name: uniqueName,
              environmentCategory: envCats,
              environment: envCats.join(', '),
              tags: Array.isArray(plan.tags) ? plan.tags : [],
              goals:
                  plan.goals ||
                  `Execute adversary emulation campaign across ${ttpObjs.length} scoped techniques (${ttpObjs
                      .map(t => t.id)
                      .join(', ')}) to validate detection and prevention posture.`,
              participants: [{ id: 1, name: '', role: 'Purple Team' }],
              operationalBlueprint: {
                  tooling: Array.isArray(plan.suggestedTooling) ? plan.suggestedTooling : [],
                  threatInfra: plan.threatInfra || '',
                  targetAssets: plan.targetAssets || '',
                  testAccounts: plan.testAccounts || '',
                  stagingAndDeconfliction: plan.stagingAndDeconfliction || ''
              }
          });

          setTestResults([]);
          setSimulationPayload('');
          setStep(1);
          addToast(
              `Scoped "${uniqueName}" with ${ttpObjs.length} TTPs in Step 1!`,
              'success'
          );
          navigate(location.pathname, { replace: true, state: {} });
      }
  }, [location, mitreData, simulationSummaries, events, buildUniqueSimName, addToast, navigate]);

  // Dynamically keep testResults synchronized with selectedTTPs whenever TTPs are added/removed in Step 1
  useEffect(() => {
     const selectedIds = new Set(
         (selectedTTPs || [])
             .map(t => (typeof t === 'string' ? t : t?.id || '').trim().toUpperCase())
             .filter(Boolean)
     );
     setTestResults(prev => {
         if (!Array.isArray(prev) || prev.length === 0) return prev;
         let changed = false;
         const next = [];
         for (const p of prev) {
             const origTtps = Array.isArray(p.ttps) ? p.ttps : [];
             const filteredTtps = origTtps
                 .map(id => String(id).trim().toUpperCase())
                 .filter(id => selectedIds.has(id));

             if (origTtps.length > 0 && filteredTtps.length === 0) {
                 // All TTPs mapped to this card were deselected -> drop the card
                 changed = true;
                 continue;
             }

             if (filteredTtps.length !== origTtps.length) {
                 changed = true;
                 const hasUserExecution = Boolean(
                     (p.outcome && p.outcome !== 'N/A') ||
                     p.execNotes?.trim() ||
                     p.detNotes?.trim()
                 );
                 next.push({
                     ...p,
                     ttps: filteredTtps,
                     mappedTTPs: filteredTtps,
                     name: !hasUserExecution
                         ? formatCleanEventTitle('', filteredTtps, mitreData, p.payloadCode)
                         : p.name
                 });
             } else {
                 next.push(p);
             }
         }
         return changed ? next : prev;
     });
  }, [selectedTTPs, mitreData]);

  useEffect(() => {
     sessionStorage.setItem('wizard_step', step);
     sessionStorage.setItem('wizard_details', JSON.stringify(simulationDetails));
     sessionStorage.setItem('wizard_ttps', JSON.stringify(selectedTTPs));
     sessionStorage.setItem('wizard_results', JSON.stringify(testResults));
     sessionStorage.setItem('wizard_payload', simulationPayload);
     if (currentDraftId) sessionStorage.setItem('wizard_draft_id', currentDraftId);
     else sessionStorage.removeItem('wizard_draft_id');
  }, [step, simulationDetails, selectedTTPs, testResults, simulationPayload, currentDraftId]);

  useEffect(() => {
     const clusteredScope = clusterTTPsIntoCompoundEvents(selectedTTPs || [], simulationDetails?.name || 'Adversary');
     setActiveAiContext({
         source: 'SimulationWizard',
         currentPhase: step === 1 ? 'Step 1: Scope' : step === 2 ? 'Step 2: Design' : step === 3 ? 'Step 3: Execute' : 'Step 4: Report',
         simulation: {
             name: simulationDetails?.name || '',
             environment: simulationDetails?.environment || '',
             objectives: simulationDetails?.goals || '',
             participants: (simulationDetails?.participants || []).map(p => p?.name)?.filter(Boolean),
             operationalBlueprint: simulationDetails?.operationalBlueprint || null
         },
         selectedTTPs: (selectedTTPs || []).map(t => {
             const role = classifyTtpOperationalRole(t);
             return `[${role.label}] ${t?.id} - ${t?.name}`;
         }),
         compoundEventBlueprint: clusteredScope.compoundEvents.map(ev => ({
             phase: ev.eventNumber,
             title: ev.title,
             ttps: ev.ttpIds,
             conduits: ev.conduits.map(t => `${t.id} (${t.name})`),
             precursors: ev.precursors.map(t => `${t.id} (${t.name})`),
             modifiers: ev.modifiers.map(t => `${t.id} (${t.name})`),
             anchors: ev.anchors.map(t => `${t.id} (${t.name})`)
         })),
         executionLogs: testResults || [],
         existingCoverageGaps: (gaps || []).map(g => ({ ttp: g?.ttp, status: g?.status, severity: g?.severity })),
         historicalSimulations: Object.values(simulationSummaries || {}).map(s => ({ name: s.name, date: s.date, ttpCount: s.ttps?.length }))
     });
     
     return () => setActiveAiContext(null);
  }, [step, simulationDetails, selectedTTPs, testResults, gaps, simulationSummaries, setActiveAiContext]);
  const getAdversaryControlRatio = () => {
     let totalScore = 0;
     let maxScore = 0;
     testResults.forEach(p => {
        let out = p.outcome;
        if (!out || out === 'N/A' || out === 'Error') return;
        if (out.includes(' ➔ ')) out = out.split(' ➔ ').pop();
        out = out.replace('✓', '').trim();
        maxScore += 1.0;
        
        if (out === 'Missed') totalScore += 1.0;
        else if (out.startsWith('Logged') || out === 'Partial') totalScore += 0.75; // Blue team gets 25% (minor loss)
        else if (out === 'Alerted' || out === 'Prevented') totalScore += 0.25; // Blue team gets 75% (solid win/edge)
        else if (out === 'Prevented & Alerted') totalScore += 0.0; // Blue team gets 100% (max win)
     });
     if (maxScore === 0) return 0.5;
     return totalScore / maxScore;
  };


  const getAggregatedScore = (ttpId) => {
    const procs = (testResults || [])?.filter(p => (p.ttps || []).includes(ttpId));
    if (procs.length === 0) return { score: 0, outcome: 'N/A', coverageRating: 'N/A', count: 0 };
    
    let bestOutcome = 'N/A';
    let bestOutcomeRank = -1;
    const validRatings = [];
    
    procs.forEach(p => {
        if (!p.coverageRating || p.coverageRating === 'N/A') return;
        
        validRatings.push(p.coverageRating);

        let r = -1;
        if (p.outcome === 'Prevented & Alerted') r = 4;
        else if (p.outcome === 'Prevented' || p.outcome === 'Alerted' || p.outcome === 'Detected') r = 3;
        else if (p.outcome === 'Logged' || p.outcome === 'Partial') r = 2;
        else if (p.outcome === 'Missed') r = 1;
        
        if (r > bestOutcomeRank) {
            bestOutcomeRank = r;
            bestOutcome = p.outcome;
        }
    });

    if (validRatings.length === 0) return { score: 0, outcome: 'N/A', coverageRating: 'N/A', count: procs.length };
    
    let aggCoverage = 'None';
    let score = 0;
    
    if (validRatings.includes('None')) {
        aggCoverage = 'None';
        score = 0;
    } else if (validRatings.includes('Minimal')) {
        aggCoverage = 'Minimal';
        score = 25;
    } else if (validRatings.includes('Partial')) {
        aggCoverage = 'Partial';
        score = 50;
    } else if (validRatings.includes('Optimal')) {
        aggCoverage = 'Optimal';
        score = 100;
    }
    
    return { score, outcome: bestOutcome, coverageRating: aggCoverage, count: procs.length };
  };

  const addProcedure = (initialTtpId) => {
     const baseline = initialTtpId
         ? getHistoricalBaselineForTTP(initialTtpId, simulationSummaries, events)
         : null;
     setTestResults(prev => [
         ...prev,
         {
             id: Date.now() + Math.random(),
             name: baseline?.name || '',
             ttps: initialTtpId ? [initialTtpId] : [],
             eventType: baseline?.eventType || 'Payload',
             payloadCode: baseline?.payloadCode || '',
             procedureSteps: baseline?.procedureSteps || '',
             expectedOutcome: baseline?.expectedOutcome || '',
             outcome: '',
             coverageRating: 'N/A',
             securityControls: baseline?.securityControls || [],
             targetAsset: baseline?.targetAsset || simulationDetails?.operationalBlueprint?.targetAssets?.trim() || '',
             execNotes: '',
             detNotes: '',
             severity: 'Auto-Calculate',
             isBaselinePrefilled: Boolean(baseline),
             baselineSource: baseline?.previousSimulationName || null,
              timestamp: new Date().toISOString()
         }
     ]);
  };

  const updateProcedure = (procId, field, value) => {
     if (field === 'name' && value.trim() !== '') {
         const isDuplicate = testResults.some(p => p.id !== procId && p.name.trim().toLowerCase() === value.trim().toLowerCase());
         if (isDuplicate) {
             addToast(`An event named "${value.trim()}" already exists.`, 'error');
             return;
         }
     }

     setTestResults(prev => prev.map(p => {
         if (p.id === procId) {
             let updates = { [field]: value };
             if (field === 'ttps' && Array.isArray(value) && value.length > 0) {
                 // Auto-populate historical baseline memory if Expected Outcome or Security Controls aren't set yet
                 const primaryTtp = value[0];
                 const baseline = getHistoricalBaselineForTTP(primaryTtp, simulationSummaries, events);
                 if (baseline) {
                     if (!p.expectedOutcome) {
                         updates.expectedOutcome = baseline.expectedOutcome;
                         updates.isBaselinePrefilled = true;
                         updates.baselineSource = baseline.previousSimulationName || null;
                     }
                     if ((!p.securityControls || p.securityControls.length === 0) && baseline.securityControls?.length > 0) {
                         updates.securityControls = baseline.securityControls;
                     }
                     if (!p.payloadCode && baseline.payloadCode) {
                         updates.payloadCode = baseline.payloadCode;
                     }
                 }
             }
             if (field === 'outcome') {
                 if (value === 'Missed' && p.severity !== 'Critical') {
                     updates.severity = 'High';
                 } else if (value === 'Logged' && p.severity !== 'Critical') {
                     updates.severity = 'Medium';
                 } else if (value === 'Prevented' && p.severity !== 'Critical') {
                     updates.severity = 'Low';
                 }
             }
             return { ...p, ...updates };
         }
         return p;
     }));
  };

  const removeProcedure = (procId) => {
     confirmAction('Are you sure you want to remove this event?', () => {
         setTestResults(prev => prev?.filter(p => p.id !== procId));
     });
  };
  
  const [reportData, setReportData] = useState({ executiveSummary: '', keyFindings: '', businessImpact: '', recommendations: '' });
  const [activeSections, setActiveSections] = useState({ executiveSummary: true, keyFindings: false, businessImpact: false, recommendations: true });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isAssessing, setIsAssessing] = useState({});

  const handleNext = () => {
    if (step === 1) {
      if (!simulationDetails.name.trim()) {
          addToast("Please provide a Simulation Name before proceeding.", 'warning');
          return;
      }
      if (simulationSummaries && simulationSummaries[simulationDetails.name.trim()]) {
          setNameConflict(true);
          addToast("A simulation with this name already exists. Please choose a unique name.", 'error');
          return;
      }
      if (!simulationDetails.environmentCategory || simulationDetails.environmentCategory.length === 0) {
          addToast("Please select a Target Environment before proceeding.", 'warning');
          return;
      }
      if (selectedTTPs.length === 0) {
          addToast("Please select at least one MITRE TTP to proceed.", 'warning');
          return;
      }
    }
    if (step === 2) {
      const defaultTargetAsset = simulationDetails?.operationalBlueprint?.targetAssets?.trim() || '';
      const executionMethodology = simulationDetails?.executionMethodology || 'compound';
      const selectedIds = new Set(
        (selectedTTPs || [])
          .map(t => (typeof t === 'string' ? t : t?.id || '').trim().toUpperCase())
          .filter(Boolean)
      );

      // Preserve only cards where the user has already recorded execution results AND whose TTPs are still in selectedTTPs
      const preservedUserCards = (testResults || [])
        .map(p => {
          const filteredTtps = (p.ttps || [])
            .map(id => String(id).trim().toUpperCase())
            .filter(id => selectedIds.has(id));
          return {
            ...p,
            ttps: filteredTtps,
            mappedTTPs: filteredTtps,
            targetAsset: p.targetAsset || defaultTargetAsset
          };
        })
        .filter(p => {
          const hasUserExecution = Boolean(
            (p.outcome && p.outcome !== 'N/A') ||
            p.execNotes?.trim() ||
            p.detNotes?.trim()
          );
          return hasUserExecution && p.ttps.length > 0;
        });

      if (selectedTTPs.length > 0) {
        const scaffolded = scaffoldEventsFromDesignAndTTPs({
          simulationPayload,
          selectedTTPs,
          existingTestResults: preservedUserCards,
          simulationSummaries,
          events,
          mitreData,
          executionMethodology
        }).map(ev => ({
          ...ev,
          targetAsset: ev.targetAsset || defaultTargetAsset
        }));

        const nextResults = [...preservedUserCards, ...scaffolded];
        setTestResults(nextResults);

        if (scaffolded.length > 0 && preservedUserCards.length === 0) {
          const prefilledCount = scaffolded.filter(e => e.isBaselinePrefilled).length;
          addToast(
            `Auto-generated ${scaffolded.length} ${executionMethodology === 'atomic' ? 'atomic 1:1' : 'compound'} event card(s) for ${selectedTTPs.length} selected TTP(s)${prefilledCount > 0 ? ` (${prefilledCount} pre-filled from historical baseline)` : ''}!`,
            'success'
          );
        }
      } else {
        setTestResults([]);
      }
    }
    if (step === 3) {
      if (testResults.length === 0) {
          addToast("Please add at least one event to proceed.", 'warning');
          return;
      }
      const hasActualOutcome = testResults.some(p => p.outcome && p.outcome !== 'N/A' && p.outcome !== 'Error');
      if (!hasActualOutcome) {
          addToast("Please document and select an outcome for at least one payload execution to proceed to reporting.", 'warning');
          return;
      }
      if (testResults.some(p => !p.ttps || p.ttps.length === 0)) {
          addToast("Please map at least one TTP to every event.", 'warning');
          return;
      }
      // Auto-assign medium to any unassessed gaps instead of hard-blocking
      setTestResults(prev => prev.map(p => {
          if ((p.coverageRating === 'Partial' || p.coverageRating === 'Minimal' || p.coverageRating === 'None') && (!p.severity || p.severity === 'Auto-Calculate' || p.severity === 'N/A')) {
              return { ...p, severity: 'Medium' };
          }
          return p;
      }));
      if (testResults.some(p => !p.name || p.name.trim() === '' || /^Event \d+$/.test(p.name.trim()))) {
          setShowNameErrors(true);
          addToast("1 or more events are missing a name.", 'warning');
          return;
      }
      setShowNameErrors(false);
    }
    setStep(s => Math.min(s + 1, 4));
  };
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleCancel = () => {
    confirmAction("Are you sure you want to cancel this simulation? All unsaved progress will be lost.", () => {
      sessionStorage.removeItem('wizard_step');
      sessionStorage.removeItem('wizard_details');
      sessionStorage.removeItem('wizard_ttps');
      sessionStorage.removeItem('wizard_results');
      sessionStorage.removeItem('wizard_payload');
      sessionStorage.removeItem('wizard_draft_id');
      navigate('/');
    });
  };

  const generatePayloads = async () => {
    setIsGenerating(true);
    try {
        if (selectedTTPs.length === 0) {
            addToast("Please select at least one TTP in Step 1 before generating an attack chain.", 'warning');
            setIsGenerating(false);
            return;
        }

        const isAtomicMode = simulationDetails?.executionMethodology === 'atomic';

        const systemInstruction = isAtomicMode
            ? `You are an elite Defensive Security Engineer and Detection Validation Lead. The user is running an **Atomic 1:1 Control Validation** batch to unit-test individual EDR/SIEM detection rules one technique at a time.

CRITICAL PARADIGM — ATOMIC 1:1 CONTROL VALIDATION (STRICT ISOLATION):
- The operator has selected **Atomic 1:1 Mode**: You MUST generate **1 dedicated, standalone validation phase per selected MITRE ATT&CK technique** (\`1 TTP = 1 Phase = 1 Code Block\`).
- **DO NOT bundle or fuse multiple TTPs into the same phase**. Each selected TTP must be tested in its own isolated phase so the Blue Team can attribute alerts, logs, and prevention outcomes strictly to that single technique's detection rule.
- Even though each phase tests a single technique in isolation, NEVER generate naive, nerfed, or sterile synthetic one-liners (like popping \`calc.exe\` or echoing dummy strings). Every atomic validation script must still execute realistic operational tradecraft (pre-flight check, realistic interpreter/LOLBin flags, realistic staging path, observable telemetry generation, and safety containment) so it genuinely tests the target detection logic.

STRUCTURED RESPONSE REQUIREMENTS:
1. First, provide a concise \`## Simulation Overview\` section explaining the atomic control validation batch and the telemetry sources being unit-tested (use inline backticks for command names here—do NOT use fenced triple-backtick code blocks in the overview).
2. Second, under a \`## Recommended Validation Procedures\` heading, create **one standalone phase for each selected TTP** in exact order:
   - **Phase Heading Format**:
     \`### Phase N: <Unique Atomic Validation Title> (<Single_TTP_ID>)\`
     (e.g., \`### Phase 1: PowerShell Encoded IEX Cradle Validation (T1059.001)\`, \`### Phase 2: Native WMI Process Enumeration Telemetry Check (T1057)\`)
   - Immediately below each Phase heading, provide a brief 1-2 sentence explanation of the exact telemetry signal (Event ID, Sysmon/EDR sensor hook, command-line/API pattern) this atomic test validates, followed by **exactly one** fenced code block (\`\`\`powershell or \`\`\`bash) containing the self-contained script for that single technique.
3. Third, provide a dedicated final teardown section using the exact heading:
   \`### Phase N: Simulation Teardown & Cleanup\`
   followed by **exactly one** fenced code block (\`\`\`powershell or \`\`\`bash) that cleans up all test artifacts created across the atomic phases.
NEVER write destructive exploits. IMPORTANT: Do NOT use markdown tables under any circumstances. DO NOT introduce yourself. Begin immediately with \`## Simulation Overview\`.`
            : `You are an elite Defensive Security Engineer and Purple Team Lead. The user wants to design realistic adversary simulation procedures for validating EDR/SIEM telemetry and detection engineering coverage.

CRITICAL PARADIGM — RED TEAM EVENTS VS. ATOMIC PAYLOADS IN A VACUUM:
- In Control Drift, each simulation phase represents an authentic **Red Team Event**—a meaningful operational activity with realistic tradecraft, execution context, and behavioral consequence.
- NEVER generate isolated, sterile "atomic one-liners in a vacuum" (e.g., executing \`whoami /priv\`, \`Get-Process\`, or popping \`calc.exe\` directly from an interactive admin prompt). In isolation, such synthetic commands do not perform any realistic adversary activity, yield minimal or suppressed telemetry, and will NOT trip modern EDR behavioral heuristics or SIEM correlation rules.
- Whether a simulation tests a single focused technique or a complex campaign, EVERY procedure must be structured as an operational event:
  1. **Pre-flight & Setup**: Validates required privileges, resolves dynamic targets (e.g. locating legitimate surrogate PIDs, resolving LOLBins, checking environment state).
  2. **Realistic Tradecraft**: Uses realistic operational tradecraft (e.g., staging test artifacts in realistic directories like \`C:\\ProgramData\` or \`AppData\\Local\`, invoking living-off-the-land binaries, using realistic interpreter arguments/flags).
  3. **Behavioral Telemetry & Correlation**: Actively triggers the correlated telemetry signals that detection engineers need to test (e.g., cross-process handle access, parent-child lineage, file creation followed by execution, or network socket attempts) rather than resting inert.
  4. **Observable Operational Outcome**: Verifies execution success or failure status cleanly.
  5. **Safety**: Completely benign, non-destructive, and safely contained.

STRICT ANTI-NERFING DIRECTIVE (NO ARTIFICIAL DEFENSIVE CONCESSIONS):
- Do NOT deliberately "nerf" payloads or design commands that you anticipate the blue team will catch easily. Creating naive payloads relying on obvious static strings or legacy signatures defeats the entire purpose of purple teaming by creating a dangerous false sense of security.
- Emulate genuine adversary tradecraft: prioritize Living-Off-The-Land Binaries (LOLBins / LOLBas), non-standard interpreter arguments, realistic path staging, and genuine behavioral execution (e.g. dynamic process resolution, token privilege checks, API abstraction).
- Payloads must remain non-destructive and safely contained (e.g. no destructive wiping, no real credential theft, no external exfiltration of sensitive data), but the execution tradecraft itself must be authentic and evasively realistic so that Blue Teams test real behavioral heuristics and correlation engines.

OPERATIONAL STRUCTURING & 4-COMPONENT COMPOUND EVENT ARCHITECTURE:
- Control Drift classifies every MITRE ATT&CK technique into one of 4 endpoint behavioral components:
  1. **Execution Conduit (\`CONDUIT\`)**: Command interpreters and invocation mechanisms (e.g. \`T1059.*\` PowerShell/CMD, \`T1047\` WMI, \`T1106\` Native API, \`T1204\` User Execution) that execute the phase.
  2. **Contextual Precursor (\`PRECURSOR\`)**: Host, process, file, or domain discovery techniques (e.g. \`T1082\`, \`T1083\`, \`T1057\`, \`T1049\`, \`T1087\`, \`T1016\`, \`T1033\`) that gather situational awareness and resolve dynamic targets at the start of the script.
  3. **Tradecraft Modifier (\`MODIFIER\`)**: Obfuscation, decoding, masquerading, or LOLBin proxy execution modifiers (e.g. \`T1027\`, \`T1140\`, \`T1036\`, \`T1218.*\`, \`T1564.*\`) applied to the payload or execution flow.
  4. **Anchor Objective (\`ANCHOR\`)**: The culminating operational action (e.g. Persistence \`T1053\`/\`T1547\`/\`T1543\`, Process Injection \`T1055\`, Credential Access \`T1003\`/\`T1558\`, Lateral Movement \`T1021\`, Archive & Exfiltration \`T1560\`/\`T1041\`).
- **NEVER isolate Precursors, Conduits, or Modifiers into standalone phases** when Anchor Objectives are present. Separating them breaks parent-child process lineage on the endpoint and fragments a single compound adversary procedure across disconnected scripts.
- **ALWAYS fuse Conduits, Precursors, and Modifiers into the Anchor Objective Phase they support**: Each Phase must execute as **one continuous script / process tree** where the \`Conduit\` runs the \`Precursor\` discovery commands, captures their output into variables or staging artifacts, applies the \`Modifier\` tradecraft, and immediately executes the \`Anchor Objective\` within the same execution context.
- **Follow the Compound Event Blueprint**: Group the selected TTPs according to the Compound Event Blueprint provided in the prompt, listing all constituent TTP IDs (Conduit + Precursor + Modifier + Anchor) in that Phase's heading.

STRUCTURED RESPONSE REQUIREMENTS:
You must provide a highly structured Markdown response optimized for Control Drift's automated event scaffolding:
1. First, provide a concise \`## Simulation Overview\` section explaining the operational scenario, adversary objective/narrative, and how the 4-component compound behavioral chains (Conduit + Precursor + Modifier + Anchor) validate EDR/SIEM correlation (use inline backticks for command names here—do NOT use fenced triple-backtick code blocks in the overview).
2. Second, under a \`## Recommended Validation Procedures\` heading, structure the simulation into distinct Compound Operational Phases:
   - **Phase Heading Format & Title Quality**:
     Every phase heading MUST use this format:
     \`### Phase N: <Unique Operational Event Name> (<TTP_ID_1>, <TTP_ID_2>, ...)\`
     (e.g., \`### Phase 1: WMI-Brokered Certutil Decode & Security Event Log Tampering (T1059.001, T1047, T1082, T1027.013, T1140, T1078, T1070.001)\` or \`### Phase 2: Timestomped Binary Drop & DLL Search Order Hijack (T1057, T1070.006, T1574.001)\` or \`### Phase 3: Active Socket Recon & Maintenance Dir Tool Staging (T1049, T1105)\`)
   - **CRITICAL NAMING DIRECTIVE — UNIQUE, TITLE-WORTHY EVENT NAMES**:
     * Invent a unique, evocative, title-worthy Red Team operational event name (3 to 7 words) that describes the concrete adversary tradecraft, tooling, and objective for that phase.
     * STRICTLY FORBIDDEN: NEVER use repetitive mechanical boilerplate like "Contextual Recon + Evasive Staging ➔ ...", "Phase N: TTP T1078...", or bare sub-technique strings like "DLL" or "LSASS Memory". Every event title must read like a polished executive report finding!
     * Append the parenthetical list of bundled TTP IDs \`(<TTP_1>, <TTP_2>, ...)\` at the very end of the heading line so the parser can map them.
   - Immediately below each Phase heading, provide a brief 1-2 sentence explanation of how the Execution Conduit, Contextual Precursor, and Tradecraft Modifier chain into the Anchor Objective within the same process tree, and the specific telemetry correlation signals expected (process ancestry, API calls, event IDs), followed by **exactly one** fenced code block (\`\`\`powershell or \`\`\`bash) containing the complete, ready-to-run script implementing that compound event.
3. Third, provide a dedicated final teardown section using the exact heading:
   \`### Phase N: Simulation Teardown & Cleanup\`
   Provide a brief 1-2 sentence explanation of the artifacts being cleaned up, followed by **exactly one** fenced code block (\`\`\`powershell or \`\`\`bash) containing the complete, ready-to-run cleanup and reversal commands (e.g. deleting created test files, removing test scheduled tasks, deleting test registry keys, stopping test services, or terminating test processes) to safely restore the host to its pristine baseline.
NEVER write destructive exploits; only benign commands that safely generate the forensic/EDR footprint. IMPORTANT: Do NOT use markdown tables under any circumstances. DO NOT introduce yourself. Begin immediately with \`## Simulation Overview\`.`;
        
        const ttpList = selectedTTPs.map(t => {
            const role = classifyTtpOperationalRole(t);
            return isAtomicMode ? `${t.id} - ${t.name}` : `[${role.label}] ${t.id} - ${t.name}`;
        }).join(', ');
        const clustered = clusterTTPsIntoCompoundEvents(selectedTTPs, simulationDetails.name || 'Adversary');
        const formatComponentBreakdown = (ev) => {
            const parts = [];
            if (ev.conduits.length > 0) parts.push(`Conduit: ${ev.conduits.map(t => `${t.id} (${t.name})`).join(', ')}`);
            if (ev.precursors.length > 0) parts.push(`Precursor: ${ev.precursors.map(t => `${t.id} (${t.name})`).join(', ')}`);
            if (ev.modifiers.length > 0) parts.push(`Modifier: ${ev.modifiers.map(t => `${t.id} (${t.name})`).join(', ')}`);
            if (ev.anchors.length > 0) parts.push(`Anchor Objective: ${ev.anchors.map(t => `${t.id} (${t.name})`).join(', ')}`);
            return parts.join(' | ');
        };
        const blueprintBlock = isAtomicMode
            ? `\n\n=== ATOMIC 1:1 CONTROL VALIDATION BLUEPRINT (STRICT 1-TTP-PER-PHASE ISOLATION) ===\nGenerate exactly ${selectedTTPs.length} standalone validation phases (1 phase per technique—do NOT combine techniques across phases):\n` +
              selectedTTPs.map((t, i) => `- Phase ${i + 1}: Isolated Atomic Validation for ${t.id} (${t.name}) -> Heading MUST end with (${t.id})`).join('\n')
            : clustered.compoundEvents.length > 0
            ? `\n\n=== COMPOUND OPERATIONAL EVENT BLUEPRINT (4-COMPONENT PHASE BUNDLING) ===\nStructure your Recommended Validation Procedures into these exact Compound Phases. For each phase, invent a unique, title-worthy operational event name reflecting the tradecraft and objective, and include all bundled TTP IDs in parentheses:\n` +
              clustered.compoundEvents.map(ev => `- Phase ${ev.eventNumber} [${ev.title}]: Bundle (${ev.ttpIds.join(', ')})\n  Components -> ${formatComponentBreakdown(ev)}`).join('\n')
            : '';

        const historyByTtp = getHistoricalProceduresForTTPs(selectedTTPs, simulationSummaries, events, mitreData);
        const historyPromptBlock = formatHistoricalProceduresForAIPrompt(historyByTtp);

        const opBp = simulationDetails?.operationalBlueprint || {};
        const opLines = [];
        if (Array.isArray(opBp.tooling) && opBp.tooling.length > 0) {
            opLines.push(`- Designated Offensive Tooling / Binaries / Frameworks: ${opBp.tooling.join(', ')}`);
        }
        if (opBp.threatInfra?.trim()) {
            opLines.push(`- Simulated Threat Infrastructure (Attacker C2 / Redirector / Source IPs): ${opBp.threatInfra.trim()}`);
        }
        if (opBp.targetAssets?.trim()) {
            opLines.push(`- Target Host(s) / Endpoint(s): ${opBp.targetAssets.trim()}`);
        }
        if (opBp.testAccounts?.trim()) {
            opLines.push(`- Compromised / Test Identity & Privilege Context: ${opBp.testAccounts.trim()}`);
        }
        if (opBp.stagingAndDeconfliction?.trim()) {
            opLines.push(`- Staging Paths & Deconfliction Guardrails: ${opBp.stagingAndDeconfliction.trim()}`);
        }
        if (opBp.hostTtpAssignments && typeof opBp.hostTtpAssignments === 'object') {
            const hostEntries = Object.entries(opBp.hostTtpAssignments).filter(
                ([host, ids]) => host && Array.isArray(ids) && ids.length > 0
            );
            if (hostEntries.length > 0) {
                opLines.push(
                    `- Per-Endpoint TTP Assignments: ${hostEntries
                        .map(([host, ids]) => `${host} -> [${ids.join(', ')}]`)
                        .join(' ; ')}`
                );
            }
        }
        const operationalBlueprintPromptBlock =
            opLines.length > 0
                ? `\n\n=== OPERATIONAL INFRASTRUCTURE, TOOLING & DECONFLICTION BLUEPRINT ===\nThe operator has explicitly defined the following operational infrastructure and tooling for this simulation:\n${opLines.join('\n')}\nCRITICAL: Directly weave these exact tools, C2 IPs/domains, target hostnames, per-endpoint TTP assignments, test accounts, and staging paths/headers into your Simulation Overview and the generated phase scripts (and cleanup phase) instead of generic placeholder strings.`
                : '';
        
        let prompt = isAtomicMode
            ? `Target Environment: ${simulationDetails.environment || 'Unknown/Generic'}.\nSimulation Scenario / Goals: ${simulationDetails.goals || 'Atomic 1:1 Control & Rule Validation'}\nSelected Technique(s) for Isolated 1:1 Testing: ${ttpList}.${blueprintBlock}${operationalBlueprintPromptBlock}${historyPromptBlock}\n\nTask: Implement each Phase in the Atomic 1:1 Blueprint above as a standalone, self-contained validation script for that single technique.`
            : `Target Environment: ${simulationDetails.environment || 'Unknown/Generic'}.\nSimulation Scenario / Goals: ${simulationDetails.goals || 'Defensive Telemetry & Detection Validation'}\nSelected Technique(s) by Operational Component: ${ttpList}.${blueprintBlock}${operationalBlueprintPromptBlock}${historyPromptBlock}\n\nTask: Implement each Compound Operational Phase from the blueprint above as a cohesive, realistic Red Team script where the Execution Conduit, Contextual Precursor discovery, and Tradecraft Modifier feed directly into the Anchor Objective within the same execution flow.`;
        
        if (coPilotInput.trim()) {
            prompt += `\n\nAdditionally, incorporate this specific request from the user: "${coPilotInput}"`;
        }
        
        setSimulationPayload('');
        
        await generateAIContentStream(prompt, systemInstruction, (chunk) => {
            if (!isMounted.current) return;
            setSimulationPayload(chunk);
        });
        
        if (coPilotInput.trim()) {
            setCoPilotInput('');
        }
    } catch(err) {
      if (!isMounted.current) return;
      console.error(err);
      addToast('Error generating payload: ' + err.message, 'error');
    }
    if (isMounted.current) setIsGenerating(false);
  };

  const mapObjectivesToTTPs = async () => {
     if (!simulationDetails.goals) {
       return;
     }
      setIsMappingTTPs(true);
      try {
          // Generate the full compressed dictionary, EXCLUDING Recon and Resource Development
          let dictionaryLines = [];
          
          Object.keys(mitreData).forEach(tacticName => {
              if (tacticName.toLowerCase() === 'reconnaissance' || tacticName.toLowerCase() === 'resource development') {
                  return; // Skip these to save massive context tokens
              }
              const tactic = mitreData[tacticName];
              
              tactic.techniques.forEach(tech => {
                  let line = `${tech.id} ${tech.name}`;
                  if (tech.subTechniques && tech.subTechniques.length > 0) {
                      let subs = tech.subTechniques.map(sub => {
                          let dec = sub.id.split('.')[1];
                          return `${dec} ${sub.name}`;
                      });
                      line += ` (${subs.join(', ')})`;
                  }
                  dictionaryLines.push(line);
              });
          });
          const dictionaryString = dictionaryLines.join('\n');

          const sysPrompt = `You are a top-tier Red Teamer and Adversary Emulation Architect. You are given a custom simulation scenario and a complete MITRE ATT&CK dictionary.
Your goal is to map the scenario into a realistic, correlated Compound Operational Chain of T-codes rather than isolated single techniques.

COMPOUND OPERATIONAL CHAIN METHODOLOGY:
Real adversary activity executes within a continuous process lineage composed of up to 4 behavioral roles:
1. Execution Conduit (CONDUIT): The command interpreter or API invoking the chain (e.g., T1059.001 PowerShell, T1059.003 Windows Command Shell, T1047 WMI, T1106 Native API).
2. Contextual Precursor (PRECURSOR): Host, process, or network discovery that gathers immediate situational awareness to feed the objective (e.g., T1057 Process Discovery, T1082 System Information Discovery, T1083 File and Directory Discovery, T1018 Remote System Discovery, T1087 Account Discovery).
3. Tradecraft Modifier (MODIFIER): Evasion, obfuscation, masquerading, token manipulation, or LOLBin proxy execution applied to the payload (e.g., T1027 Obfuscated Files/Info, T1140 Deobfuscate/Decode, T1036 Masquerading, T1218.011 Rundll32, T1134 Access Token Manipulation).
4. Anchor Objective (ANCHOR): The culminating high-signal adversarial objective(s) described in the scenario (e.g., T1003.001 LSASS Memory, T1053.005 Scheduled Task, T1055 Process Injection, T1021.002 SMB/Windows Admin Shares, T1560.001 Archive via Utility, T1041 Exfiltration).

CRITICAL INSTRUCTIONS:
1. FIRST, write a brief analysis breaking down the scenario into its Anchor Objective(s) and the natural Conduit, Precursor, and Modifier techniques that complete the realistic process tree on the target environment.
2. SECOND, select the exact Txxxx or Txxxx.xxx IDs from the provided dictionary so the user gets a cohesive Compound Operational Event chain.
3. Finally, at the very end of your response, you MUST output a single line starting with "MAPPED_IDS:" followed by a comma-separated list of the exact IDs you selected.`;
          
          const prompt = `Target Environment: ${simulationDetails.environmentCategory || simulationDetails.environment || 'None provided'}\nSimulation Scenario: ${simulationDetails.goals || 'None provided'}\n\nMITRE ATT&CK Framework Dictionary:\n${dictionaryString}\n\nTask: Map the scenario into a coherent Compound Operational Chain (Conduit + Precursor + Modifier + Anchor Objective), then list the MAPPED_IDS at the end.`;

          let currentFoundIds = new Set();
          let totalFound = 0;

          await generateAIContentStream(prompt, sysPrompt, (chunk) => {
              if (!isMounted.current) return;
              
              let cleanChunk = chunk.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
              let matches = [];
              const mappedIdsMatch = cleanChunk.match(/MAPPED_IDS:\s*([T0-9.,\s]+)/i);
              
              if (mappedIdsMatch && mappedIdsMatch[1]) {
                  matches = mappedIdsMatch[1].match(/T\d{4}(?:\.\d{3})?/gi) || [];
              } else {
                  matches = cleanChunk.match(/T\d{4}(?:\.\d{3})?/gi) || [];
              }
              
              const uniqueIds = new Set(matches.map(m => m.toUpperCase()));
              let ids = Array.from(uniqueIds);
              let newDiscovered = [];
              
              ids.forEach(id => {
                  if (!currentFoundIds.has(id)) {
                      currentFoundIds.add(id);
                      newDiscovered.push(id);
                  }
              });
              
              if (newDiscovered.length > 0) {
                  let foundItems = [];
                  newDiscovered.forEach(id => {
                      Object.values(mitreData).forEach(tactic => {
                          tactic.techniques.forEach(tech => {
                              if (tech.id === id) foundItems.push({ id: tech.id, name: tech.name, aiMapped: true });
                              if (tech.subTechniques) {
                                  tech.subTechniques.forEach(sub => {
                                      if (sub.id === id) foundItems.push({ id: sub.id, name: sub.name, aiMapped: true });
                                  });
                              }
                          });
                      });
                  });
                  
                  const uniqueFoundItems = foundItems.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

                  if (uniqueFoundItems.length > 0) {
                      setSelectedTTPs(prevSelections => {
                          let newSelections = [...prevSelections];
                          let changed = false;
                          uniqueFoundItems.forEach(item => {
                              if (!newSelections.find(s => s.id === item.id)) {
                                  newSelections.push(item);
                                  changed = true;
                              }
                          });
                          return changed ? newSelections : prevSelections;
                      });
                      totalFound += uniqueFoundItems.length;
                  }
              }
          });
          
          if (totalFound === 0) {
              addToast("AI completed mapping but no valid TTPs were extracted from its response.", "warning");
          } else {
              addToast(`AI successfully mapped ${totalFound} new TTPs!`, 'success');
          }
      } catch (err) {
          if (!isMounted.current) return;
      } finally {
          if (isMounted.current) setIsMappingTTPs(false);
      }
  };

  const generateAIReport = async () => {
    setIsGeneratingReport(true);
    try {
      const requestedKeys = Object.keys(activeSections).filter(k => activeSections[k]);
      if (requestedKeys.length === 0) {
          addToast("Please select at least one section to generate.", 'warning');
          setIsGeneratingReport(false);
          return;
      }
      
      const requestedKeysList = requestedKeys.map(k => `"${k}"`).join(", ");

      const systemInstruction = `You are an elite CISO and Purple Team Lead. Write an Executive Summary for a Purple Team gap analysis report. Emphasize the business value, the risk posture based on the outcomes (Prevented vs Missed), and high-level recommendations. Maintain a highly professional, constructive, and forward-looking tone. If the results are poor or unsatisfactory, frame them objectively as opportunities for maturity rather than harsh failures. You MUST return ONLY a raw JSON object with the following exact keys: ${requestedKeysList}. Do not include markdown wrappers. Each value should be a concise, well-written paragraph or bulleted list as appropriate.`;

      const blocked = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Optimal').length;
      const detected = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Optimal' && getAggregatedScore(t.id).outcome === 'Alerted').length;
      const partial = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Partial').length;
      const minimal = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Minimal').length;
      const missed = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'None').length;

      const detailedLogs = testResults.map((proc, i) => {
          const ttpsStr = (proc.ttps && proc.ttps.length > 0) ? `Mapped TTPs: ${proc.ttps.join(', ')}\n` : '';
          return `Event ${i + 1}: ${proc.name || 'Unnamed'}\n` +
                 ttpsStr +
                 (proc.timestamp ? `Timestamp: ${proc.timestamp}\n` : '') +
                 (proc.payloadCode ? `Execution Details: ${proc.payloadCode}\n` : '') +
                 `Outcome: ${proc.outcome || 'Unknown'}\n` +
                 (proc.finding ? `Analyst Notes: ${proc.finding}\n` : '');
      }).join('\n');

      const opBp = simulationDetails?.operationalBlueprint || {};
      const bpSummaryParts = [];
      if (Array.isArray(opBp.tooling) && opBp.tooling.length > 0) bpSummaryParts.push(`Tooling: ${opBp.tooling.join(', ')}`);
      if (opBp.threatInfra?.trim()) bpSummaryParts.push(`Simulated Threat Infra: ${opBp.threatInfra.trim()}`);
      if (opBp.targetAssets?.trim()) bpSummaryParts.push(`Target Hosts: ${opBp.targetAssets.trim()}`);
      if (opBp.testAccounts?.trim()) bpSummaryParts.push(`Test Accounts: ${opBp.testAccounts.trim()}`);
      const bpReportLine = bpSummaryParts.length > 0 ? `Operational Blueprint: ${bpSummaryParts.join(' | ')}\n` : '';

      const prompt = `Simulation: ${simulationDetails.name || 'Unnamed Simulation'}\nEnvironment: ${simulationDetails.environmentCategory || 'Unknown'}\n${bpReportLine}Results Summary: ${blocked} Optimal (${detected} included Alerts), ${partial} Partial, ${minimal} Minimal, ${missed} No Coverage (Exposed).\n\nDetailed Execution Logs:\n${detailedLogs}\n\nPlease write the requested report sections analyzing these results.`;
      
      const rawResult = await generateAIContent(prompt, systemInstruction);
      const withoutThink = rawResult.replace(/<think>[\s\S]*?<\/think>/gi, '');
      const cleanJson = withoutThink.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed;
      try {
          parsed = JSON.parse(cleanJson);
      } catch (e) {
          throw new Error("AI returned malformed JSON response.");
      }
      
      const extractKey = (obj, key) => {
          const lowerKey = key.toLowerCase();
          const foundKey = Object.keys(obj).find(k => k.toLowerCase().replace(/[^a-z]/g, '') === lowerKey.replace(/[^a-z]/g, ''));
          return foundKey ? obj[foundKey] : undefined;
      };
      
      const newData = {};
      let generatedAtLeastOne = false;
      for (const key of requestedKeys) {
          const val = extractKey(parsed, key);
          if (val) {
              newData[key] = val;
              generatedAtLeastOne = true;
          }
      }
      
      if (!generatedAtLeastOne) {
          throw new Error("AI failed to generate the required report fields.");
      }
      
      setReportData(prev => ({
         ...prev,
         ...newData
      }));
    } catch(err) {
      console.error(err);
      addToast("Error generating report: " + err.message, 'error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const autoMapProcedureTTPs = async (proc) => {
      if (!isAiActive) {
          addToast("AI API key is required to auto-map TTPs.", 'warning');
          return;
      }
      if (!proc.name && !proc.payloadCode) {
          addToast("Please provide a Payload Name or Code first.", 'warning');
          return;
      }
      setMappingProcedureId(proc.id);
      try {
          const sysPrompt = `You are an expert Red Teamer mapping procedures to the MITRE ATT&CK framework.
You MUST output your response as a valid JSON object with exactly two keys:
1. "reasoning": A string where you analyze the procedure step-by-step.
2. "technique_ids": An array of strings containing the final MITRE ATT&CK Technique IDs (e.g., ["T1055", "T1059.001"]).
Output ONLY the JSON object. Do not wrap it in markdown blocks.`;
          
          let procCode = proc.payloadCode || '';

          const prompt = `Procedure Details:\nName/Description: ${proc.name || 'None provided'}\nPayload Code: ${procCode || 'None provided'}\n\nTask: Analyze the procedure and map it to the most relevant MITRE ATT&CK technique IDs. Return your analysis and final IDs in the requested JSON format.`;
          
          const result = await generateAIContent(prompt, sysPrompt, null, { temperature: 0, response_format: { type: "json_object" } });
          
          let mappedIds = [];
          try {
              // Aggressively extract the JSON object to bypass any conversational preamble/postamble
              const jsonMatch = result.match(/\{[\s\S]*\}/);
              if (!jsonMatch) {
                  throw new Error("No JSON object found in response");
              }
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.technique_ids && Array.isArray(parsed.technique_ids)) {
                  mappedIds = parsed.technique_ids;
              }
          } catch (e) {
              console.warn("Failed to parse JSON from AI, falling back to regex.", e);
              // Fallback regex if the model absolutely refused to output JSON
              const cleanChunk = result.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
              mappedIds = cleanChunk.match(/T\d{4}(?:\.\d{3})?/gi) || [];
          }
          
          // Validate against our MITRE dataset to prevent hallucinated IDs from breaking the UI
          const allValidMitreIds = new Set();
          if (mitreData) {
              Object.values(mitreData).forEach(tactic => {
                  tactic.techniques?.forEach(tech => {
                      allValidMitreIds.add(tech.id);
                      tech.subTechniques?.forEach(sub => allValidMitreIds.add(sub.id));
                  });
              });
          }
          
          const validIds = [...new Set(mappedIds.map(m => m.toUpperCase()))].filter(id => allValidMitreIds.size === 0 || allValidMitreIds.has(id));
          
          if (validIds.length > 0) {
              updateProcedure(proc.id, 'ttps', validIds);
              addToast(`Successfully mapped ${validIds.length} TTP(s).`, 'success');
          } else {
              addToast("AI couldn't map any relevant TTPs.", 'info');
          }
      } catch (err) {
          console.error(err);
          addToast("Error auto-mapping TTPs: " + err.message, 'error');
      }
      setMappingProcedureId(null);
  };

  const autoAssessSeverity = async (proc) => {
      setIsAssessing(prev => ({...prev, [proc.id]: true}));
      try {
          const sysPrompt = "You are a Purple Team Risk Analyst. Determine the severity of a coverage gap for the provided MITRE ATT&CK techniques in a generic corporate environment. You must reply ONLY with exactly one of these words: Critical, High, Medium, or Low.";
          const prompt = `Techniques involved: ${proc.ttps.join(', ')}. Procedure: ${proc.name}`;
          
          const result = await generateAIContent(prompt, sysPrompt);
          let cleanResult = result.trim().replace(/[^a-zA-Z]/g, '');
          
          if (!['Critical', 'High', 'Medium', 'Low'].includes(cleanResult)) {
              cleanResult = 'High'; 
          }
          
          updateProcedure(proc.id, 'severity', cleanResult);
      } catch (err) {
          console.error(err);
          addToast("Error assessing severity: " + err.message, 'error');
      } finally {
          setIsAssessing(prev => ({...prev, [proc.id]: false}));
      }
  };

  const finishExercise = async () => {
     console.log('--- STARTING FINISH EXERCISE ---');
     if (isSaving) {
         console.log('--- finishExercise: isSaving is true, aborting ---');
         return;
     }
     
     console.log('--- finishExercise: setting isSaving to true ---');
     setIsSaving(true);
     try {
         const hasSummary = Object.values(reportData).some(val => val.trim() !== '');

         const finalSimulationName = simulationDetails.name || 'Ad-hoc Simulation';

         const allMappedTTPs = new Map();
     
     // 1. Always include TTPs strictly selected in step 1
     selectedTTPs.forEach(t => allMappedTTPs.set(t.id, t));
     
     // 2. Include any TTPs that were mapped during Step 3 (Execution)
     testResults.forEach(proc => {
         if (proc.ttps && Array.isArray(proc.ttps)) {
             proc.ttps.forEach(ttpId => {
                 if (!allMappedTTPs.has(ttpId)) {
                     const ttpName = lookupTTPName(mitreData, ttpId);
                     allMappedTTPs.set(ttpId, { id: ttpId, name: ttpName });
                 }
             });
         }
     });

     const finalizedTestResults = testResults.map(p => {
           let calcSeverity = p.severity;
           let out = p.outcome || '';
           if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];

           if (!calcSeverity || calcSeverity === 'Auto-Calculate') {
               if (p.coverageRating === 'Optimal') {
                   calcSeverity = 'N/A';
               } else if (out.startsWith('Prevented') || out.startsWith('Alerted')) {
                   calcSeverity = 'Low';
               } else if (out === 'N/A' || out === 'Error') {
                   calcSeverity = 'N/A';
               } else {
                   calcSeverity = 'Medium';
               }
           } else {
               if (p.coverageRating === 'Optimal' || out === 'N/A' || out === 'Error') calcSeverity = 'N/A';
           }
           
            let finalCoverage = p.coverageRating;
            if (!finalCoverage || finalCoverage === 'Auto-Calculate' || finalCoverage === 'N/A') {
                if (out === 'Missed') finalCoverage = 'None';
                else if (out === 'Logged') finalCoverage = 'Partial';
                else if (out.startsWith('Prevented') || out.startsWith('Alerted')) finalCoverage = 'Optimal';
                else finalCoverage = 'None';
            } else {
                const covStr = String(finalCoverage).toLowerCase();
                if (covStr.includes('optimal')) finalCoverage = 'Optimal';
                else if (covStr.includes('partial') || covStr.includes('medium')) finalCoverage = 'Partial';
                else if (covStr.includes('minimal')) finalCoverage = 'Minimal';
                else if (covStr.includes('none') || covStr.includes('no coverage')) finalCoverage = 'None';
            }
            
            return { ...p, severity: calcSeverity, coverageRating: finalCoverage };
      });

     const simulationTimestamp = new Date().toISOString();

     for (const [ttpId, ttp] of allMappedTTPs.entries()) {
         const procedures = finalizedTestResults?.filter(p => (p.ttps || []).includes(ttp.id));
         
         if (!procedures || procedures.length === 0) {
             continue; // Do not record a phantom event if the technique was never actually tested
         }

         const agg = computeFinalTtpAggregation(ttp.id, finalizedTestResults);
         let outcomeStatus = 'low'; 
         if (agg.coverageRating === 'Optimal') outcomeStatus = 'high';
         else if (agg.coverageRating === 'Partial') outcomeStatus = 'medium';
         else if (agg.coverageRating === 'Minimal') outcomeStatus = 'minimal';
         else if (agg.outcome === 'N/A') outcomeStatus = 'na';
         
         const worstSeverity = procedures.some(p => p.severity === 'Critical') ? 'Critical' : 
                               procedures.some(p => p.severity === 'High') ? 'High' : 
                               procedures.some(p => p.severity === 'Medium') ? 'Medium' : 
                               procedures.some(p => p.severity === 'Low') ? 'Low' : 'Medium';
                               
                   const remediationNotes = procedures.map(p => {
              let note = `Event: ${p.name || 'Unnamed Event'} [${p.outcome || 'N/A'}]`;
              if (p.timestamp) {
                  const timeFormatted = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                  note += `\nTimestamp: ${timeFormatted} (${new Date(p.timestamp).toLocaleDateString()})`;
              }
              if (p.expectedOutcome) note += `\nExpected: ${p.expectedOutcome}`;
             if (p.execNotes) note += `\nExecution: ${p.execNotes}`;
             if (p.detNotes) note += `\nDetection: ${p.detNotes}`;
             return note;
         }).join('\n\n') || 'No specific execution or detection notes were recorded for this technique.';
         
         const richFinding = `${agg.outcome}`;

         const aggregatedControls = [];
         procedures.forEach(p => {
             if (Array.isArray(p.securityControls)) {
                 p.securityControls.forEach(sc => {
                     if (!aggregatedControls.includes(sc)) aggregatedControls.push(sc);
                 });
             }
         });

         await completeExercise(ttp.id, richFinding, remediationNotes, outcomeStatus, finalSimulationName, worstSeverity, simulationDetails.environmentCategory, agg.coverageRating, agg.outcome, simulationDetails.tags, aggregatedControls, true, simulationTimestamp);
      }
      
     let compiledSummary = '';
     if (activeSections.executiveSummary && reportData.executiveSummary) compiledSummary += `## Executive Summary\n${reportData.executiveSummary}\n\n`;
     if (activeSections.keyFindings && reportData.keyFindings) compiledSummary += `## Key Findings\n${reportData.keyFindings}\n\n`;
     if (activeSections.businessImpact && reportData.businessImpact) compiledSummary += `## Risk Analysis\n${reportData.businessImpact}\n\n`;
     if (activeSections.recommendations && reportData.recommendations) compiledSummary += `## Recommendations\n${reportData.recommendations}\n\n`;
     compiledSummary = compiledSummary.trim();

      const simulationPayloadData = {
          summary: compiledSummary,
          details: simulationDetails,
          attackChain: simulationPayload,
          testResults: finalizedTestResults,
          timestamp: new Date().toISOString()
      };

     for (const p of finalizedTestResults) {
         if (p.coverageRating === 'Partial' || p.coverageRating === 'Minimal' || p.coverageRating === 'None') {
             const severity = p.severity || 'Medium';
             const baseScore = severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20;
             const visibilityMultiplier = (p.coverageRating === 'None') ? 1.0 : (p.coverageRating === 'Minimal' ? 0.9 : (p.coverageRating === 'Partial' ? 0.75 : 0.0));
             const priorityScore = Math.round(baseScore * visibilityMultiplier);
                           const eventTime = p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
              const timeHeader = p.timestamp ? `Timestamp: ${eventTime} (${new Date(p.timestamp).toLocaleDateString()})\n` : '';
              const newGap = {
                  id: Date.now() + Math.random().toString(),
                  displayId: 'GAP-' + Math.floor(1000 + Math.random() * 9000),
                  ttp: (p.ttps || []).join(', ') || 'Unmapped',
                  simulation: finalSimulationName,
                  finding: p.name || 'Unnamed Event',
                  outcome: p.outcome || 'Missed',
                  coverageRating: p.coverageRating || 'None',
                  details: `${timeHeader}Execution: ${p.execNotes || 'N/A'}\nDetection: ${p.detNotes || 'N/A'}`,
                  timestamp: p.timestamp || simulationTimestamp,
                  eventTimestamp: p.timestamp || simulationTimestamp,
                  severity: severity,
                 priorityScore: priorityScore,
                 status: 'Open',
                 actionItems: 'Review telemetry and develop detection logic.',
                 stakeholders: [],
                 remediationNotes: "",
                 environment: simulationDetails.environmentCategory,
                 tags: simulationDetails.tags || [],
                  securityControls: Array.isArray(p.securityControls) ? p.securityControls : [],
                 createdDate: new Date().toISOString()
             };
             await createGap(newGap, true);
         }
     }

      await saveSimulationSummary(finalSimulationName, simulationPayloadData);
      
      if (currentDraftId) {
          if (dbAdapter && typeof dbAdapter.deleteDraft === 'function') {
              try {
                  await dbAdapter.deleteDraft(currentDraftId);
              } catch (e) {
                  console.warn('Failed to delete completed draft from DB:', e);
              }
          }
          const updatedDrafts = savedDrafts.filter(d => d.id !== currentDraftId);
          setSavedDrafts(updatedDrafts);
          localStorage.setItem('wizard_drafts', JSON.stringify(updatedDrafts));
      }
      
      sessionStorage.removeItem('wizard_step');
      sessionStorage.removeItem('wizard_details');
      sessionStorage.removeItem('wizard_ttps');
      sessionStorage.removeItem('wizard_results');
      sessionStorage.removeItem('wizard_payload');
      sessionStorage.removeItem('wizard_draft_id');

      // Do not manually reset state here to prevent flickering to step 1.
      // The spinner will keep spinning until the component unmounts on navigation.
      console.log('--- finishExercise: navigating to /reports ---');
      navigate('/reports', { state: { simulation: finalSimulationName } });
      
     } catch (err) {
         console.error("--- finishExercise FAILED:", err);
         addToast("Failed to save simulation. Please try again.", "error");
         setIsSaving(false);
     }
  };

   const saveDraft = (forceNew = false) => {
      const draftData = {
          step,
          simulationDetails,
          selectedTTPs,
          simulationPayload,
          testResults,
          reportData,
          activeSections
      };
      const cleanName = (simulationDetails.name || '').trim() || 'Unnamed Simulation';

      const executeSave = async (id) => {
          setIsSavingDraft(true);
          const finalDraft = {
              id: String(id),
              name: cleanName,
              step,
              timestamp: new Date().toISOString(),
              data: draftData
          };

          let updatedDrafts;
          if (savedDrafts.find(d => d.id === finalDraft.id)) {
              updatedDrafts = savedDrafts.map(d => d.id === finalDraft.id ? finalDraft : d);
          } else {
              updatedDrafts = [finalDraft, ...savedDrafts];
          }
          updatedDrafts.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

          setSavedDrafts(updatedDrafts);
          try {
              localStorage.setItem('wizard_drafts', JSON.stringify(updatedDrafts));
          } catch (e) {
              // Ignore localStorage quota warnings
          }
          setCurrentDraftId(finalDraft.id);

          try {
              if (dbAdapter && typeof dbAdapter.saveDraft === 'function') {
                  await dbAdapter.saveDraft(finalDraft);
              }
              const targetLabel = dbAdapter?.type === 'supabase' ? 'shared Supabase database' : 'local workspace';
              addToast(`Draft "${finalDraft.name}" saved to ${targetLabel}!`, 'success');
          } catch (err) {
              console.error('Failed to sync draft to database:', err);
              addToast(`Draft "${finalDraft.name}" saved locally (database sync warning: ${err.message || 'offline'}).`, 'warning');
          } finally {
              if (isMounted.current) setIsSavingDraft(false);
          }
      };

      if (!forceNew && currentDraftId && savedDrafts.some(d => d.id === currentDraftId)) {
          confirmAction(`Do you want to update the active draft "${cleanName}"?`, () => {
              executeSave(currentDraftId);
          });
      } else if (
          !forceNew &&
          cleanName !== 'Unnamed Simulation' &&
          savedDrafts.some(d => (d.name || '').trim().toLowerCase() === cleanName.toLowerCase())
      ) {
          const matchingDraft = savedDrafts.find(
              d => (d.name || '').trim().toLowerCase() === cleanName.toLowerCase()
          );
          confirmAction(
              `A draft named "${matchingDraft.name}" already exists in the workspace. Do you want to update that shared draft?`,
              () => {
                  executeSave(matchingDraft.id);
              }
          );
      } else {
          executeSave(Date.now().toString());
      }
   };

   const loadDraft = () => {
      setIsDraftModalOpen(true);
      refreshDrafts(false);
   };

   const restoreDraft = (draft) => {
       const parsed = draft.data || {};
       setStep(parsed.step || draft.step || 1);
       if (parsed.simulationDetails) {
           setSimulationDetails(parsed.simulationDetails);
       }
       setSelectedTTPs(Array.isArray(parsed.selectedTTPs) ? parsed.selectedTTPs : []);
       setSimulationPayload(parsed.simulationPayload ?? '');
       if (parsed.testResults) {
           let loadedResults = [];
           if (Array.isArray(parsed.testResults)) {
               loadedResults = parsed.testResults;
           } else {
               const migrated = [];
               Object.entries(parsed.testResults).forEach(([ttpId, data]) => {
                   (data.procedures || []).forEach(p => {
                       const existing = migrated.find(m => m.id === p.id);
                       if (existing) {
                           if (!existing.ttps.includes(ttpId)) existing.ttps.push(ttpId);
                       } else {
                           migrated.push({ ...p, ttps: [ttpId] });
                       }
                   });
               });
               loadedResults = migrated;
           }
           const cleanedResults = loadedResults.map(p => {
               const currentName = p.name || '';
               if (
                   /^(?:phase|step|event|procedure)\s*\d+/i.test(currentName) ||
                   /\(T\d{4}/i.test(currentName) ||
                   /contextual\s+recon/i.test(currentName) ||
                   /^dll$/i.test(currentName.trim())
               ) {
                   return {
                       ...p,
                       name: formatCleanEventTitle(currentName, p.ttps, mitreData, p.payloadCode)
                   };
               }
               return p;
           });
           setTestResults(cleanedResults);
       } else {
           setTestResults([]);
       }
       if (parsed.reportData) {
           setReportData(parsed.reportData);
       }
       if (parsed.activeSections) {
           setActiveSections(parsed.activeSections);
       }
       setCurrentDraftId(draft.id);
       setIsDraftModalOpen(false);
       addToast(`Draft "${draft.name}" loaded at Step ${parsed.step || draft.step || 1}!`, 'success');
   };

   const deleteDraft = (id) => {
       const target = savedDrafts?.find(d => d.id === id);
       confirmAction(`Are you sure you want to delete the draft "${target?.name || 'Unnamed Simulation'}"?`, async () => {
           const updated = (savedDrafts || []).filter(d => d.id !== id);
           setSavedDrafts(updated);
           try {
               localStorage.setItem('wizard_drafts', JSON.stringify(updated));
           } catch (e) {
               // Ignore
           }
           if (currentDraftId === id) setCurrentDraftId(null);
           try {
               if (dbAdapter && typeof dbAdapter.deleteDraft === 'function') {
                   await dbAdapter.deleteDraft(id);
               }
               addToast("Draft deleted.", "success");
           } catch (err) {
               console.error('Failed to delete draft from DB:', err);
               addToast("Draft removed locally, but failed to delete from remote database.", "warning");
           }
       });
   };

    const generateTestSimulation = async () => {
      const envs = ['Production', 'Staging', 'Development', 'Corporate', 'Cloud', 'On-Premise'];
      const names = ['Operation Crimson', 'Project Chimera', 'Apollo Strike', 'Neon Phantom', 'Shadow Gambit'];
      
      const randomEnv = envs[Math.floor(Math.random() * envs.length)];
      const randomName = names[Math.floor(Math.random() * names.length)] + ' Auto-Sim ' + Math.floor(Math.random() * 1000);
      
      const details = {
          name: randomName,
          environmentCategory: [randomEnv],
          environment: randomEnv + ' Network',
          goals: 'Automatically generated test simulation to evaluate detection engineering gaps.',
          participants: [
              { id: 1, name: 'Red Team Lead', role: 'Red Team' },
              { id: 2, name: 'SOC Analyst', role: 'Blue Team' }
          ]
      };
      
      const ttpCount = Math.floor(Math.random() * 4) + 3; // 3 to 6
      const randomTTPs = [];
      const usedIndices = new Set();
      
      const availableTTPs = mitreData && mitreData.length > 0 ? mitreData : [
          { id: 'T1059', name: 'Command and Scripting Interpreter' },
          { id: 'T1003', name: 'OS Credential Dumping' },
          { id: 'T1036', name: 'Masquerading' },
          { id: 'T1021', name: 'Remote Services' },
          { id: 'T1053', name: 'Scheduled Task/Job' },
          { id: 'T1543', name: 'Create or Modify System Process' },
          { id: 'T1105', name: 'Ingress Tool Transfer' }
      ];
      
      while(randomTTPs.length < ttpCount && usedIndices.size < availableTTPs.length) {
          const idx = Math.floor(Math.random() * availableTTPs.length);
          if (!usedIndices.has(idx)) {
              usedIndices.add(idx);
              randomTTPs.push({ id: availableTTPs[idx].id, name: availableTTPs[idx].name });
          }
      }
      
      const outcomes = ['Prevented', 'Alerted', 'Logged', 'Missed'];
      const eventCount = Math.floor(Math.random() * 6) + 5; // 5 to 10
      const generatedResults = [];
      
      for(let i=0; i<eventCount; i++) {
          const mappedTtpCount = Math.floor(Math.random() * 2) + 1; // 1 to 2
          const mappedTtps = [];
          for(let j=0; j<mappedTtpCount; j++) {
             mappedTtps.push(randomTTPs[Math.floor(Math.random() * randomTTPs.length)].id);
          }
          
          const actualOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
          let cov = 'Optimal';
          if (actualOutcome === 'Logged') cov = 'Partial';
          if (actualOutcome === 'Missed') cov = 'None';
          if (actualOutcome === 'N/A' || actualOutcome === 'Error') cov = 'N/A';
          
          generatedResults.push({
             id: Date.now() + Math.random() + i,
             name: `Auto-Gen Event ${i+1}`,
             ttps: [...new Set(mappedTtps)],
             eventType: 'Payload',
             payloadCode: 'powershell.exe -ExecutionPolicy Bypass -c "Write-Host \'Auto-gen script\'"',
             expectedOutcome: 'Alerted',
             outcome: actualOutcome,
             coverageRating: cov,
             execNotes: `Executed successfully at ${new Date().toLocaleTimeString()}`,
             detNotes: `Found event in Splunk query: index=windows EventCode=4688`,
             severity: (cov === 'None') ? 'High' : (cov === 'Partial' ? 'Medium' : 'N/A')
          });
      }

       const allMappedTTPs = new Map();
       randomTTPs.forEach(t => allMappedTTPs.set(t.id, t));
       
       generatedResults.forEach(proc => {
           if (proc.ttps && Array.isArray(proc.ttps)) {
               proc.ttps.forEach(ttpId => {
                   if (!allMappedTTPs.has(ttpId)) {
                       let ttpName = 'Unknown Technique';
                       if (mitreData) {
                           for (const tactic of Object.values(mitreData)) {
                               const tech = tactic.techniques.find(t => t.id === ttpId);
                               if (tech) { ttpName = tech.name; break; }
                           }
                       }
                       allMappedTTPs.set(ttpId, { id: ttpId, name: ttpName });
                   }
               });
           }
       });

       const finalizedTestResults = generatedResults.map(p => {
             let calcSeverity = p.severity;
             let out = p.outcome || '';
             if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
             if (!calcSeverity || calcSeverity === 'Auto-Calculate') {
                 if (out === 'Missed') calcSeverity = 'High';
                 else if (out === 'Logged') calcSeverity = 'Medium';
                 else if (out.startsWith('Prevented') || out.startsWith('Alerted')) calcSeverity = 'Low';
                 else if (out === 'N/A' || out === 'Error') calcSeverity = 'N/A';
                 else calcSeverity = 'Medium';
             }
             return { ...p, severity: calcSeverity };
       });

       for (const ttp of Array.from(allMappedTTPs.values())) {
           const agg = computeFinalTtpAggregation(ttp.id, finalizedTestResults, { outcome: 'Missed', coverageRating: 'None' });
           let outcomeStatus = 'low'; 
           if (agg.coverageRating === 'Optimal') outcomeStatus = 'high';
           else if (agg.coverageRating === 'Partial') outcomeStatus = 'medium';
           else if (agg.coverageRating === 'Minimal') outcomeStatus = 'minimal';
           else if (agg.outcome === 'N/A') outcomeStatus = 'na';

           const procedures = finalizedTestResults.filter(p => (p.ttps || []).includes(ttp.id));
           const worstSeverity = procedures.some(p => p.severity === 'Critical') ? 'Critical' : 
                                 procedures.some(p => p.severity === 'High') ? 'High' : 
                                 procedures.some(p => p.severity === 'Medium') ? 'Medium' : 
                                 procedures.some(p => p.severity === 'Low') ? 'Low' : 'Medium';
                                 
           const remediationNotes = procedures.map(p => `Event: ${p.name || 'Unnamed Event'} [${p.outcome || 'N/A'}]`).join('\n\n') || 'No specific notes.';
           
           const aggregatedControls = [];
           procedures.forEach(p => {
               if (Array.isArray(p.securityControls)) {
                   p.securityControls.forEach(sc => {
                       if (!aggregatedControls.includes(sc)) aggregatedControls.push(sc);
                   });
               }
           });

           await completeExercise(ttp.id, agg.outcome, remediationNotes, outcomeStatus, details.name, worstSeverity, details.environmentCategory, agg.coverageRating, agg.outcome, details.tags, aggregatedControls);
       }

       const simulationPayloadData = {
           summary: 'Automatically generated test simulation data.',
           details: details,
           attackChain: '',
           testResults: finalizedTestResults,
           timestamp: new Date().toISOString()
       };

       await saveSimulationSummary(details.name, simulationPayloadData);
       addToast(`Successfully ran automated simulation bot for: ${details.name}!`, 'success');
       navigate('/reports');
   };

  return (
    <div className="animate-fade-in" style={{  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0  }}>
      <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0  }}>
          <div>
              <h1 className="iridescent-text" style={{  fontSize: '2.5rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '15px'  }}>
                  Simulation Launcher
              </h1>
              <p style={{  color: 'var(--text-secondary)', margin: 0, marginBottom: '15px'  }}>Launch a comprehensive Purple Team simulation.</p>
          </div>
          <div style={{  display: 'flex', gap: '10px', alignItems: 'center'  }}>
              {currentDraftId && (
                  <div
                      title="Currently editing an in-progress draft. Saving will update this shared draft."
                      style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          color: '#60a5fa',
                          fontSize: '0.76rem',
                          fontWeight: 600
                      }}
                  >
                      <Database size={12} />
                      <span>Active Draft</span>
                  </div>
              )}
              <button
                  type="button"
                  className="btn hover-lift"
                  onClick={loadDraft}
                  style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px'
                  }}
              >
                  <span>Load Draft</span>
                  {savedDrafts.length > 0 && (
                      <span
                          style={{
                              padding: '1px 6px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'rgba(156, 39, 176, 0.25)',
                              border: '1px solid rgba(156, 39, 176, 0.45)',
                              color: '#e9d5ff'
                          }}
                      >
                          {savedDrafts.length}
                      </span>
                  )}
              </button>
              <button
                  type="button"
                  className="btn hover-lift"
                  onClick={() => saveDraft(false)}
                  disabled={isSavingDraft}
                  style={{
                      background: 'rgba(156, 39, 176, 0.2)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                  }}
              >
                  {isSavingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
              </button>
          </div>
      </div>
      
      <div style={{  display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px', flexShrink: 0  }}>
        {['Scope', 'Design', 'Execute', 'Report'].map((name, i) => {
          const isCompleted = step > i + 1;
          const isActive = step === i + 1;
          const className = isActive ? "progress-tab progress-tab-active" 
                          : isCompleted ? "progress-tab progress-tab-completed" 
                          : "progress-tab progress-tab-future";
          return (
            <div key={i} className={className}>{name}</div>
          );
        })}
      </div>

      <div className="glass-panel" style={{  flex: 1, minHeight: 0, padding: '25px', display: 'flex', flexDirection: 'column', overflow: 'hidden'  }}>
        
        {step === 1 && (
          <Step1BasicDetails
            simulationDetails={simulationDetails}
            setSimulationDetails={setSimulationDetails}
            nameConflict={nameConflict}
            setNameConflict={setNameConflict}
            simulationSummaries={simulationSummaries}
            addToast={addToast}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
            isAiActive={isAiActive}
            mapObjectivesToTTPs={mapObjectivesToTTPs}
            isMappingTTPs={isMappingTTPs}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isMitreLoading={isMitreLoading}
            activeMapTactic={activeMapTactic}
            setActiveMapTactic={setActiveMapTactic}
            mitreData={mitreData}
            KILL_CHAIN_ORDER={KILL_CHAIN_ORDER}
            selectedTTPs={selectedTTPs}
            setSelectedTTPs={setSelectedTTPs}
            activeMapTechnique={activeMapTechnique}
            setActiveMapTechnique={setActiveMapTechnique}
            TACTIC_ICONS={TACTIC_ICONS}
            setTestResults={setTestResults}
          />
        )}

        {step === 2 && (
          <Step2Design
            isGenerating={isGenerating}
            simulationPayload={simulationPayload}
            setSimulationPayload={setSimulationPayload}
            isAiActive={isAiActive}
            generatePayloads={generatePayloads}
            isContextCollapsed={isContextCollapsed}
            setIsContextCollapsed={setIsContextCollapsed}
            simulationDetails={simulationDetails}
            setSimulationDetails={setSimulationDetails}
            selectedTTPs={selectedTTPs}
            setSelectedTTPs={setSelectedTTPs}
            addToast={addToast}
            testResults={testResults}
            simulationSummaries={simulationSummaries}
            events={events}
            mitreData={mitreData}
          />
        )}

        {step === 3 && (
          <Step3Execute
            getAdversaryControlRatio={getAdversaryControlRatio}
            simulationPayload={simulationPayload}
            addProcedure={addProcedure}
            testResults={testResults}
            collapsedCards={collapsedCards}
            setCollapsedCards={setCollapsedCards}
            updateProcedure={updateProcedure}
            removeProcedure={removeProcedure}
            showNameErrors={showNameErrors}
            setShowNameErrors={setShowNameErrors}
            selectedTTPs={selectedTTPs}
            autoMapProcedureTTPs={autoMapProcedureTTPs}
            mappingProcedureId={mappingProcedureId}
            aiSettings={aiSettings}
            isAssessing={isAssessing}
            autoAssessSeverity={autoAssessSeverity}
            compressImage={compressImage}
            addSimulationEvidence={addSimulationEvidence}
            simulationDetails={simulationDetails}
            setExpandedImage={setExpandedImage}
          />
        )}

        {step === 4 && (
          <Step4Report
            testResults={testResults}
            selectedTTPs={selectedTTPs}
            getAggregatedScore={getAggregatedScore}
            activeSections={activeSections}
            setActiveSections={setActiveSections}
            reportData={reportData}
            setReportData={setReportData}
            simulationDetails={simulationDetails}
            compressImage={compressImage}
            addSimulationEvidence={addSimulationEvidence}
            simulationEvidence={simulationEvidence}
            isAiActive={isAiActive}
            generateAIReport={generateAIReport}
            isGeneratingReport={isGeneratingReport}
            setExpandedImage={setExpandedImage}
            removeSimulationEvidence={removeSimulationEvidence}
            updateProcedure={updateProcedure}
          />
        )}

        <div style={{  marginTop: '20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '20px', paddingRight: '80px'  }}>
          <div style={{  display: 'flex', gap: '10px'  }}>
            <button type="button" className="btn" style={{  background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)'  }} onClick={handleCancel}>Cancel</button>
            <button type="button" className="btn" style={{  background: 'rgba(255,255,255,0.1)'  }} onClick={handlePrev} disabled={step === 1}>Back</button>
          </div>
          {step < 4 ? (
            <button type="button" className="btn" onClick={handleNext}>Next Step</button>
          ) : (
            <button type="button" className="btn" onClick={finishExercise} style={{  background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px'  }}>
              <CheckSquare size={16} /> Submit
            </button>
          )}
        </div>
        
        {expandedImage && (
            <div style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'  }} onClick={() => setExpandedImage(null)}>
                <img src={expandedImage} alt="Expanded Evidence" style={{  maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'  }} />
            </div>
        )}

        {isDraftModalOpen && (
            <div className="animate-fade-in" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(12px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'  }}>
                <div className="glass-panel responsive-modal" style={{ width: '100%', maxWidth: '680px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'rgba(11, 12, 16, 0.96)', border: '1px solid var(--accent-primary)', borderRadius: '12px', boxShadow: '0 0 30px rgba(126, 34, 206, 0.3)' }}>
                    <div style={{  padding: '18px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'  }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <h3 style={{  margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px'  }}>
                                <Save size={20} color="var(--accent-primary)" /> In-Progress Simulation Drafts
                            </h3>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: dbAdapter?.type === 'supabase' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.06)',
                                    border: dbAdapter?.type === 'supabase' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                                    color: dbAdapter?.type === 'supabase' ? '#34d399' : 'var(--text-secondary)'
                                }}
                            >
                                <Database size={11} />
                                {dbAdapter?.type === 'supabase' ? 'Supabase Shared Workspace' : 'Local Browser Storage'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn hover-lift"
                                onClick={() => refreshDrafts(false)}
                                disabled={isLoadingDrafts}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'var(--text-secondary)',
                                    padding: '5px 10px',
                                    fontSize: '0.78rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                {isLoadingDrafts ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                                <span>Refresh</span>
                            </button>
                            <button className="close-btn" onClick={() => setIsDraftModalOpen(false)}><X size={20} /></button>
                        </div>
                    </div>

                    <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {dbAdapter?.type === 'supabase'
                                ? 'Drafts are isolated in their own Supabase section so team members can collaborate on C2 setup, custom tooling, and execution without polluting finished reports.'
                                : 'Drafts are stored locally in this browser. Connect Supabase in Settings to share in-progress drafts across your team.'}
                        </span>
                        {currentDraftId && (
                            <button
                                type="button"
                                className="btn hover-lift"
                                onClick={() => {
                                    setIsDraftModalOpen(false);
                                    saveDraft(true);
                                }}
                                style={{
                                    background: 'rgba(156, 39, 176, 0.16)',
                                    border: '1px solid rgba(156, 39, 176, 0.4)',
                                    color: '#e9d5ff',
                                    padding: '5px 10px',
                                    fontSize: '0.76rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                + Save Current as New Draft
                            </button>
                        )}
                    </div>

                    <div style={{  padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px'  }}>
                        {isLoadingDrafts && savedDrafts.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '35px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <Loader2 size={18} className="animate-spin" color="var(--accent-primary)" />
                                <span>Syncing in-progress drafts from workspace...</span>
                            </div>
                        ) : savedDrafts.length === 0 ? (
                            <div style={{  textAlign: 'center', color: 'var(--text-muted)', padding: '35px 0'  }}>
                                No saved in-progress drafts found. Click <strong>Save Draft</strong> at any step to store a work-in-progress simulation.
                            </div>
                        ) : (
                            savedDrafts.map(draft => {
                                const dData = draft.data || {};
                                const dStep = Number(dData.step || draft.step || 1);
                                const stepNames = { 1: 'Step 1: Scope', 2: 'Step 2: Design', 3: 'Step 3: Execute', 4: 'Step 4: Report' };
                                const stepLabel = stepNames[dStep] || `Step ${dStep}`;
                                const ttpCount = Array.isArray(dData.selectedTTPs) ? dData.selectedTTPs.length : 0;
                                const eventsList = Array.isArray(dData.testResults) ? dData.testResults : [];
                                const eventCount = eventsList.length;
                                const executedCount = eventsList.filter(e => e?.outcome && e.outcome !== 'N/A').length;
                                const hasDesign = Boolean(dData.simulationPayload && String(dData.simulationPayload).trim().length > 0);
                                const envList = Array.isArray(dData.simulationDetails?.environmentCategory)
                                    ? dData.simulationDetails.environmentCategory.filter(Boolean)
                                    : [];
                                const participantsList = Array.isArray(dData.simulationDetails?.participants)
                                    ? dData.simulationDetails.participants.map(p => p?.name?.trim()).filter(Boolean)
                                    : [];
                                const isActiveDraft = currentDraftId === draft.id;

                                return (
                                    <div
                                        key={draft.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '14px',
                                            background: isActiveDraft ? 'rgba(126, 34, 206, 0.12)' : 'rgba(0,0,0,0.35)',
                                            border: isActiveDraft ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid var(--glass-border)',
                                            padding: '14px 16px',
                                            borderRadius: '10px'
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                <span style={{  fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.02rem'  }}>
                                                    {draft.name || 'Unnamed Simulation'}
                                                </span>
                                                {isActiveDraft && (
                                                    <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(168, 85, 247, 0.22)', border: '1px solid rgba(168, 85, 247, 0.5)', color: '#e9d5ff' }}>
                                                        ACTIVE
                                                    </span>
                                                )}
                                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)', color: '#93c5fd' }}>
                                                    {stepLabel}
                                                </span>
                                                {envList.length > 0 && (
                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)' }}>
                                                        {envList.join(', ')}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '4px' }}>
                                                    {ttpCount} TTP{ttpCount === 1 ? '' : 's'}
                                                </span>
                                                {hasDesign && (
                                                    <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 7px', borderRadius: '4px' }}>
                                                        Design Plan Saved
                                                    </span>
                                                )}
                                                {eventCount > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 7px', borderRadius: '4px' }}>
                                                        {eventCount} Event{eventCount === 1 ? '' : 's'} ({executedCount}/{eventCount} Executed)
                                                    </span>
                                                )}
                                                {participantsList.length > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <Users size={11} /> {participantsList.join(', ')}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{  color: 'var(--text-muted)', fontSize: '0.78rem'  }}>
                                                Last updated: {draft.timestamp ? new Date(draft.timestamp).toLocaleString() : 'Unknown'}
                                            </div>
                                        </div>
                                        <div style={{  display: 'flex', gap: '8px', flexShrink: 0  }}>
                                            <button className="btn hover-lift" onClick={() => restoreDraft(draft)} style={{  background: 'var(--accent-primary)', padding: '6px 14px', fontSize: '0.84rem'  }}>Load</button>
                                            <button className="btn hover-lift" onClick={() => deleteDraft(draft.id)} style={{  background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '6px 10px', fontSize: '0.84rem'  }} title="Delete Draft"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
