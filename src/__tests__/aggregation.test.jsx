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

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMitreData } from '../hooks/useMitreData';
import SimulationWizard from '../components/pages/SimulationWizard';
import { AppProvider, useAppContext } from '../AppContext';
import { MemoryRouter } from 'react-router-dom';

// Mock Toast hook and Provider
const mockAddToast = vi.fn();
const ToastProvider = ({ children }) => children;
vi.mock('../components/ui/Toast.jsx', () => ({
  useToast: () => ({ addToast: mockAddToast }),
  ToastProvider: ({ children }) => children
}));

// Mock DB adapter
const mockDbAdapter = {
    type: 'local',
    fetchData: vi.fn(),
    saveData: vi.fn()
};

// Mock ReactFlow components which don't render well in test environments
vi.mock('@xyflow/react', () => ({
    ReactFlow: () => <div>ReactFlow Mock</div>,
    Background: () => null,
    Controls: () => null,
    applyNodeChanges: (changes, nds) => nds,
    applyEdgeChanges: (changes, eds) => eds,
    addEdge: (connection, eds) => eds,
    MarkerType: { ArrowClosed: 'arrowclosed' }
}));

// Mock react-pdf since it relies on canvas/browser APIs
vi.mock('@react-pdf/renderer', () => ({
    PDFDownloadLink: ({ children }) => children({ loading: false })
}));

// Mock child components of SimulationWizard
vi.mock('../components/dropdowns/InlineEnvironmentDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/InlineTagDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/EventTypeDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/OutcomeDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/CoverageRatingDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/SeverityDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/EventTTPDropdown', () => ({ default: () => null }));
vi.mock('../components/dropdowns/SecurityControlsDropdown', () => ({ default: () => null }));
vi.mock('../components/ui/EventCard', () => ({ default: () => null }));
vi.mock('../components/features/TTPSelector', () => ({ default: () => null }));
vi.mock('../components/features/BattleGlobe', () => ({ default: () => null }));
vi.mock('../components/features/ReportPDF', () => ({ default: () => null }));
vi.mock('../components/ui/MarkdownRenderer', () => ({ default: () => null }));

// Mock RichMarkdownEditor as a simple textarea so we can simulate typing
vi.mock('../components/ui/RichMarkdownEditor', () => ({
    default: ({ value, onChange }) => (
        <textarea 
            data-testid="rich-markdown-editor" 
            value={value} 
            onChange={e => onChange(e.target.value)} 
        />
    )
}));

describe('useMitreData worst-case aggregation', () => {
    const mockSkeleton = {
        'Initial Access': {
            status: 'unknown',
            techniques: [
                {
                    id: 'T1190',
                    name: 'Exploit Public-Facing Application',
                    status: 'unknown',
                    subTechniques: [
                        {
                            id: 'T1190.001',
                            name: 'Sub-technique 1',
                            status: 'unknown'
                        }
                    ],
                    environments: {}
                }
            ]
        }
    };

    it('should aggregate statuses using worst-case counterpart in calculateAverageStatus', () => {
        // Event 1 is high (Optimal), Event 2 is low (None)
        const mockExercises = [
            {
                ttp: 'T1190.001',
                status: 'high',
                coverageRating: 'Optimal',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            },
            {
                ttp: 'T1190.001',
                status: 'low',
                coverageRating: 'None',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            }
        ];

        const { result } = renderHook(() => useMitreData(mockDbAdapter, mockExercises));
        
        act(() => {
            result.current.setBaseMitreData(mockSkeleton);
        });

        // The subtechnique should rollup to 'low' because one of its events is 'low'
        const initialAccess = result.current.mitreData['Initial Access'];
        const tech = initialAccess.techniques[0];
        expect(tech.subTechniques[0].status).toBe('low');
    });

    it('should aggregate environment status rollup for parent techniques based on worst-case score occurrences', () => {
        // One event is Optimal (score 100 -> b=1) and one is None (score 0 -> m=1)
        const mockExercises = [
            {
                ttp: 'T1190.001',
                coverageRating: 'Optimal',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            },
            {
                ttp: 'T1190.001',
                coverageRating: 'None',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            }
        ];

        const { result } = renderHook(() => useMitreData(mockDbAdapter, mockExercises));
        
        act(() => {
            result.current.setBaseMitreData(mockSkeleton);
        });

        // Under worst-case rollup: m > 0 (there is at least one score < 25) rolls up to 'low'
        const initialAccess = result.current.mitreData['Initial Access'];
        const tech = initialAccess.techniques[0];
        expect(tech.environments['Windows Workstation']).toBe('low');
    });

    it('should aggregate status to na when all events are na', () => {
        const mockExercises = [
            {
                ttp: 'T1190.001',
                coverageRating: 'N/A',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            }
        ];
        const { result } = renderHook(() => useMitreData(mockDbAdapter, mockExercises));
        act(() => {
            result.current.setBaseMitreData(mockSkeleton);
        });
        const tech = result.current.mitreData['Initial Access'].techniques[0];
        expect(tech.subTechniques[0].status).toBe('na');
    });

    it('should aggregate status to unknown when all events are unknown', () => {
        const mockExercises = [
            {
                ttp: 'T1190.001',
                coverageRating: 'unknown',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            }
        ];
        const { result } = renderHook(() => useMitreData(mockDbAdapter, mockExercises));
        act(() => {
            result.current.setBaseMitreData(mockSkeleton);
        });
        const tech = result.current.mitreData['Initial Access'].techniques[0];
        expect(tech.subTechniques[0].status).toBe('unknown');
    });

    it('should aggregate status correctly for various status transitions (worst-case)', () => {
        // minimal and medium -> should rollup to minimal
        const mockExercises1 = [
            { ttp: 'T1190.001', coverageRating: 'Partial', date: '2026-07-01' }, // medium
            { ttp: 'T1190.001', coverageRating: 'Minimal', date: '2026-07-01' }  // minimal
        ];
        const { result: res1 } = renderHook(() => useMitreData(mockDbAdapter, mockExercises1));
        act(() => { res1.current.setBaseMitreData(mockSkeleton); });
        expect(res1.current.mitreData['Initial Access'].techniques[0].subTechniques[0].status).toBe('minimal');

        // high and medium -> should rollup to medium
        const mockExercises2 = [
            { ttp: 'T1190.001', coverageRating: 'Optimal', date: '2026-07-01' }, // high
            { ttp: 'T1190.001', coverageRating: 'Partial', date: '2026-07-01' }  // medium
        ];
        const { result: res2 } = renderHook(() => useMitreData(mockDbAdapter, mockExercises2));
        act(() => { res2.current.setBaseMitreData(mockSkeleton); });
        expect(res2.current.mitreData['Initial Access'].techniques[0].subTechniques[0].status).toBe('medium');
    });

    it('should ignore na when mixed with valid statuses', () => {
        const mockExercises = [
            { ttp: 'T1190.001', coverageRating: 'Optimal', date: '2026-07-01' }, // high
            { ttp: 'T1190.001', coverageRating: 'N/A', date: '2026-07-01' }       // na
        ];
        const { result } = renderHook(() => useMitreData(mockDbAdapter, mockExercises));
        act(() => {
            result.current.setBaseMitreData(mockSkeleton);
        });
        const tech = result.current.mitreData['Initial Access'].techniques[0];
        // High & NA should rollup to High (worst of valid statuses)
        expect(tech.subTechniques[0].status).toBe('high');
    });

    it('demonstrates order dependency bug in environment status rollup when N/A is present', () => {
        // CASE A: N/A is processed first, followed by Optimal (100)
        const mockExercisesA = [
            {
                ttp: 'T1190.001',
                status: 'na',
                coverageRating: 'N/A',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            },
            {
                ttp: 'T1190.001',
                status: 'high',
                coverageRating: 'Optimal',
                environment: 'Windows Workstation',
                date: '2026-07-02'
            }
        ];
        const { result: resA } = renderHook(() => useMitreData(mockDbAdapter, mockExercisesA));
        act(() => { resA.current.setBaseMitreData(mockSkeleton); });
        const techA = resA.current.mitreData['Initial Access'].techniques[0];
        
        // CASE B: Optimal is processed first, followed by N/A
        const mockExercisesB = [
            {
                ttp: 'T1190.001',
                status: 'high',
                coverageRating: 'Optimal',
                environment: 'Windows Workstation',
                date: '2026-07-02'
            },
            {
                ttp: 'T1190.001',
                status: 'na',
                coverageRating: 'N/A',
                environment: 'Windows Workstation',
                date: '2026-07-01'
            }
        ];
        const { result: resB } = renderHook(() => useMitreData(mockDbAdapter, mockExercisesB));
        act(() => { resB.current.setBaseMitreData(mockSkeleton); });
        const techB = resB.current.mitreData['Initial Access'].techniques[0];

        // This assertion checks the current behavior. If they differ, it proves order dependency.
        console.log('Environment rollup for CASE A (N/A first):', techA.environments['Windows Workstation']);
        console.log('Environment rollup for CASE B (Optimal first):', techB.environments['Windows Workstation']);
        
        // Asserting that they do not match because of the bug
        expect(techA.environments['Windows Workstation']).not.toBe(techB.environments['Windows Workstation']);
    });
});

// Mock useAppContext for SimulationWizard testing
const mockAppContextValues = {
    completeExercise: vi.fn(),
    mitreData: {
        'Initial Access': {
            techniques: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }]
        }
    },
    isMitreLoading: false,
    generateAIContent: vi.fn(),
    generateAIContentStream: vi.fn(),
    saveSimulationSummary: vi.fn(),
    addSimulationEvidence: vi.fn(),
    simulationEvidence: {},
    compressImage: vi.fn(),
    aiSettings: { provider: 'Gemini' },
    setActiveAiContext: vi.fn(),
    gaps: [],
    setGaps: vi.fn(),
    createGap: vi.fn(),
    confirmAction: vi.fn((msg, callback) => callback()),
    simulationSummaries: {},
    isAiActive: false
};

vi.mock('../AppContext', () => ({
    useAppContext: () => mockAppContextValues,
}));

describe('SimulationWizard worst-case getAggregatedScore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it('should calculate aggregated score using worst-case coverage rating among valid procedures', () => {
        // Inject state via sessionStorage to place SimulationWizard at Step 4 with test results
        sessionStorage.setItem('wizard_step', '4');
        sessionStorage.setItem('wizard_details', JSON.stringify({
            name: 'Test campaign',
            environmentCategory: ['Production'],
            goals: 'Test',
            participants: []
        }));
        sessionStorage.setItem('wizard_ttps', JSON.stringify([
            { id: 'T1190', name: 'Exploit Public-Facing Application' }
        ]));
        
        // Two procedures: one has coverageRating = 'Optimal', one has coverageRating = 'None'
        sessionStorage.setItem('wizard_results', JSON.stringify([
            {
                id: 1,
                name: 'Procedure 1',
                ttps: ['T1190'],
                coverageRating: 'Optimal',
                outcome: 'Prevented & Alerted'
            },
            {
                id: 2,
                name: 'Procedure 2',
                ttps: ['T1190'],
                coverageRating: 'None',
                outcome: 'Missed'
            }
        ]));

        render(
            <MemoryRouter>
                <ToastProvider>
                    <SimulationWizard />
                </ToastProvider>
            </MemoryRouter>
        );

        // Fill in the Executive Summary textarea so we can submit
        const textarea = screen.getAllByTestId('rich-markdown-editor')[0];
        fireEvent.change(textarea, { target: { value: 'This is a sample executive summary' } });

        // Click the Submit button
        const submitBtn = screen.getByRole('button', { name: /Submit/i });
        fireEvent.click(submitBtn);

        // Verify that completeExercise is called with 'low' status and 'None' coverage
        expect(mockAppContextValues.completeExercise).toHaveBeenCalledWith(
            'T1190',
            expect.any(String),
            expect.any(String),
            'low', // outcomeStatus is 'low' under worst-case
            'Test campaign',
            expect.any(String),
            expect.any(Array),
            'None', // aggCoverage is 'None' under worst-case
            'Prevented & Alerted',
            undefined
        );
    });
});
