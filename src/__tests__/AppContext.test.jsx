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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppProvider, useAppContext } from '../AppContext';

// Helper class for Image Mocking
class MockImage {
    constructor() {
        this.width = 100;
        this.height = 100;
        Object.defineProperty(this, 'src', {
            set(val) {
                this._src = val;
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            },
            get() {
                return this._src;
            }
        });
    }
}

// Consumer component to capture context values
const TestConsumer = ({ onRender }) => {
    const context = useAppContext();
    onRender(context);
    return null;
};

const mockDbAdapter = { type: 'local' };
const mockInitDb = vi.fn(cb => cb(mockDbAdapter));

const mockDbConnection = {
    dbConfig: { provider: 'local' },
    setDbConfig: vi.fn(),
    dbAdapter: mockDbAdapter,
    isAuthenticated: false,
    setIsAuthenticated: vi.fn(),
    isDbLoading: false,
    userRole: 'admin',
    initDb: mockInitDb
};

const mockAppUI = {
    confirmConfig: { isOpen: false, message: '', onConfirm: () => {} },
    confirmAction: vi.fn(),
    closeConfirm: vi.fn(),
    requestSuccessToast: vi.fn(),
    checkSyncQueue: vi.fn(),
    addToast: vi.fn()
};

const mockExData = {
    allEventsData: {},
    loadAllData: vi.fn().mockResolvedValue(),
    fetchEventsPage: vi.fn(),
    setExercises: vi.fn(),
    setAllEventsData: vi.fn(),
    exercisesPage: 1,
    exercisesLimit: 10,
    events: []
};

const mockGapsData = {
    gaps: [],
    setGaps: vi.fn(),
    activeEnvironmentFilter: 'All',
    setActiveEnvironmentFilter: vi.fn(),
    targetEnvironments: [],
    setTargetEnvironments: vi.fn(),
    addEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    fetchGaps: vi.fn().mockResolvedValue(),
    createGap: vi.fn(),
    updateGap: vi.fn(),
    deleteGap: vi.fn()
};

const mockSimsData = {
    simulationSummaries: {},
    setSimulationSummaries: vi.fn(),
    simulationEvidence: {},
    fetchSimulations: vi.fn().mockResolvedValue()
};

const mockTagsData = {
    activeTagFilter: 'All',
    setActiveTagFilter: vi.fn(),
    targetTags: [],
    setTargetTags: vi.fn()
};

const mockSecurityControlsData = {
    activeSecurityControlFilter: 'All',
    setActiveSecurityControlFilter: vi.fn(),
    targetSecurityControls: [],
    setTargetSecurityControls: vi.fn()
};

const mockMitreHook = {
    loadMitreSkeleton: vi.fn().mockResolvedValue(),
    setBaseMitreData: vi.fn(),
    mitreData: {},
    isMitreLoading: false
};

const mockActions = {
    completeExercise: vi.fn(),
    updateEventValidation: vi.fn()
};

const mockAiData = {
    aiSettings: {},
    setAiSettings: vi.fn()
};

const mockUseMitreData = vi.fn(() => mockMitreHook);

vi.mock('../hooks/useDbConnection', () => ({ useDbConnection: () => mockDbConnection }));
vi.mock('../hooks/useAppUI', () => ({ useAppUI: () => mockAppUI }));
vi.mock('../hooks/useEventsData', () => ({ useEventsData: () => mockExData }));
vi.mock('../hooks/useGapsData', () => ({ useGapsData: () => mockGapsData }));
vi.mock('../hooks/useMitreData', () => ({ useMitreData: (adapter, filtered) => mockUseMitreData(adapter, filtered) }));
vi.mock('../hooks/useSimulationsData', () => ({ useSimulationsData: () => mockSimsData }));
vi.mock('../hooks/useEventActions', () => ({ useEventActions: () => mockActions }));
vi.mock('../hooks/useAiData', () => ({ useAiData: () => mockAiData }));
vi.mock('../hooks/useTagsData', () => ({ useTagsData: () => mockTagsData }));
vi.mock('../hooks/useSecurityControlsData', () => ({ useSecurityControlsData: () => mockSecurityControlsData }));
vi.mock('../components/ui/Toast', () => ({
    useToast: () => ({ addToast: vi.fn() }),
    ToastProvider: ({ children }) => children
}));

describe('AppContext integration tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Mount & Initial Loading', () => {
        it('calls initDb and sequential data fetching on mount', async () => {
            render(
                <AppProvider>
                    <div />
                </AppProvider>
            );

            expect(mockInitDb).toHaveBeenCalled();
            await waitFor(() => {
                expect(mockExData.loadAllData).toHaveBeenCalledWith(mockDbAdapter);
            });
            await waitFor(() => {
                expect(mockGapsData.fetchGaps).toHaveBeenCalledWith(mockDbAdapter);
            });
            await waitFor(() => {
                expect(mockSimsData.fetchSimulations).toHaveBeenCalledWith(mockDbAdapter);
            });
            await waitFor(() => {
                expect(mockMitreHook.loadMitreSkeleton).toHaveBeenCalled();
            });
        });
    });

    describe('Synchronization Interval', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('sets up a 15 second interval that calls checkSyncQueue and clears it on unmount', () => {
            const spyClearInterval = vi.spyOn(global, 'clearInterval');
            
            const { unmount } = render(
                <AppProvider>
                    <div />
                </AppProvider>
            );

            act(() => {
                vi.advanceTimersByTime(15000);
            });
            expect(mockAppUI.checkSyncQueue).toHaveBeenCalledTimes(1);
            expect(mockAppUI.checkSyncQueue).toHaveBeenCalledWith(mockDbAdapter, mockDbConnection.isAuthenticated);

            act(() => {
                vi.advanceTimersByTime(15000);
            });
            expect(mockAppUI.checkSyncQueue).toHaveBeenCalledTimes(2);

            unmount();
            expect(spyClearInterval).toHaveBeenCalled();
        });
    });

    describe('toggleTacticScope', () => {
        it('toggles all techniques in tactic to unknown if all are na', () => {
            let capturedUpdater;
            mockMitreHook.setBaseMitreData.mockImplementation(fn => {
                capturedUpdater = fn;
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            context.toggleTacticScope('Initial Access');

            expect(mockMitreHook.setBaseMitreData).toHaveBeenCalled();
            expect(capturedUpdater).toBeDefined();

            const prevData = {
                'Initial Access': {
                    techniques: [
                        { id: 'T1190', status: 'na' },
                        { id: 'T1133', status: 'na' }
                    ]
                }
            };

            const nextData = capturedUpdater(prevData);
            expect(nextData['Initial Access'].techniques[0].status).toBe('unknown');
            expect(nextData['Initial Access'].techniques[1].status).toBe('unknown');
        });

        it('toggles all techniques in tactic to na if any are not na', () => {
            let capturedUpdater;
            mockMitreHook.setBaseMitreData.mockImplementation(fn => {
                capturedUpdater = fn;
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            context.toggleTacticScope('Initial Access');

            const prevData = {
                'Initial Access': {
                    techniques: [
                        { id: 'T1190', status: 'na' },
                        { id: 'T1133', status: 'unknown' }
                    ]
                }
            };

            const nextData = capturedUpdater(prevData);
            expect(nextData['Initial Access'].techniques[0].status).toBe('na');
            expect(nextData['Initial Access'].techniques[1].status).toBe('na');
        });

        it('returns prev if tactic is not found', () => {
            let capturedUpdater;
            mockMitreHook.setBaseMitreData.mockImplementation(fn => {
                capturedUpdater = fn;
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            context.toggleTacticScope('NonExistentTactic');

            const prevData = {
                'Initial Access': {
                    techniques: [{ id: 'T1190', status: 'na' }]
                }
            };

            const nextData = capturedUpdater(prevData);
            expect(nextData).toBe(prevData);
        });
    });

    describe('toggleTechniqueScope', () => {
        it('toggles technique status from na to unknown across all tactics, for environment "All"', () => {
            let capturedUpdater;
            mockMitreHook.setBaseMitreData.mockImplementation(fn => {
                capturedUpdater = fn;
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            context.toggleTechniqueScope('T1190', 'All');

            const prevData = {
                'Initial Access': {
                    techniques: [
                        { id: 'T1190', status: 'na' }
                    ]
                },
                'Execution': {
                    techniques: [
                        { id: 'T1190', status: 'na' }
                    ]
                }
            };

            const nextData = capturedUpdater(prevData);
            expect(nextData['Initial Access'].techniques[0].status).toBe('unknown');
            expect(nextData['Execution'].techniques[0].status).toBe('unknown');
        });

        it('toggles technique status and updates specific environment when environment is not "All"', () => {
            let capturedUpdater;
            mockMitreHook.setBaseMitreData.mockImplementation(fn => {
                capturedUpdater = fn;
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            context.toggleTechniqueScope('T1190', 'Prod');

            const prevData = {
                'Initial Access': {
                    techniques: [
                        { id: 'T1190', status: 'unknown', environments: { Staging: 'unknown' } }
                    ]
                }
            };

            const nextData = capturedUpdater(prevData);
            expect(nextData['Initial Access'].techniques[0].status).toBe('na');
            expect(nextData['Initial Access'].techniques[0].environments['Prod']).toBe('na');
        });

        it('returns next unmodified if technique is not found', () => {
            let capturedUpdater;
            mockMitreHook.setBaseMitreData.mockImplementation(fn => {
                capturedUpdater = fn;
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            context.toggleTechniqueScope('NonExistent', 'All');

            const prevData = {
                'Initial Access': {
                    techniques: [
                        { id: 'T1190', status: 'na' }
                    ]
                }
            };

            const nextData = capturedUpdater(prevData);
            expect(nextData).toEqual(prevData);
        });
    });

    describe('injectTestData', () => {
        it('calls addToast with the disabled message', async () => {
            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            await context.injectTestData();
            expect(mockAppUI.addToast).toHaveBeenCalledWith("Stress Test Injection is disabled in the refactored architecture. Please use the Import feature.", "info");
        });
    });

    describe('isReadOnly', () => {
        it('returns true when userRole is reader', () => {
            mockDbConnection.userRole = 'reader';
            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );
            expect(context.isReadOnly).toBe(true);
        });

        it('returns false when userRole is admin', () => {
            mockDbConnection.userRole = 'admin';
            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );
            expect(context.isReadOnly).toBe(false);
        });
    });

    describe('Confirmation Modal rendering', () => {
        it('renders the confirmation modal when isOpen is true', () => {
            mockAppUI.confirmConfig = {
                isOpen: true,
                message: 'Are you sure?',
                onConfirm: vi.fn()
            };

            render(
                <AppProvider>
                    <div />
                </AppProvider>
            );

            expect(screen.getByText('Confirmation Required')).toBeInTheDocument();
            expect(screen.getByText('Are you sure?')).toBeInTheDocument();

            const cancelBtn = screen.getByText('Cancel');
            fireEvent.click(cancelBtn);
            expect(mockAppUI.closeConfirm).toHaveBeenCalled();

            const confirmBtn = screen.getByText('Confirm');
            fireEvent.click(confirmBtn);
            expect(mockAppUI.confirmConfig.onConfirm).toHaveBeenCalled();
            expect(mockAppUI.closeConfirm).toHaveBeenCalled();
        });
    });

    describe('filteredExercisesForMitre', () => {
        beforeEach(() => {
            mockUseMitreData.mockClear();
        });

        it('filters events by activeTagFilter and activeSecurityControlFilter', () => {
            mockExData.allEventsData = {
                ex1: { id: 'ex1', tags: 'PCI-DSS', securityControls: ['Splunk'] },
                ex2: { id: 'ex2', tags: ['HIPAA'], securityControls: ['CrowdStrike'] },
                ex3: { id: 'ex3', tags: ['PCI-DSS', 'GDPR'], securityControls: ['Splunk', 'Firewall'] }
            };

            mockTagsData.activeTagFilter = 'PCI-DSS';
            mockSecurityControlsData.activeSecurityControlFilter = 'All';

            const TestWrapper = () => (
                <AppProvider>
                    <div />
                </AppProvider>
            );

            const { rerender } = render(<TestWrapper />);
            
            let lastCall = mockUseMitreData.mock.calls[mockUseMitreData.mock.calls.length - 1];
            let filtered = lastCall[1];
            
            expect(filtered.ex1).toBeDefined();
            expect(filtered.ex2).toBeUndefined();
            expect(filtered.ex3).toBeDefined();

            mockTagsData.activeTagFilter = 'PCI-DSS';
            mockSecurityControlsData.activeSecurityControlFilter = 'Firewall';

            rerender(<TestWrapper />);

            lastCall = mockUseMitreData.mock.calls[mockUseMitreData.mock.calls.length - 1];
            filtered = lastCall[1];
            
            expect(filtered.ex1).toBeUndefined();
            expect(filtered.ex2).toBeUndefined();
            expect(filtered.ex3).toBeDefined();
        });
    });

    describe('compressImage', () => {
        it('resolves with the original dataUrl if image width is less than or equal to maxWidth', async () => {
            const originalImage = global.Image;
            global.Image = class extends MockImage {
                constructor() {
                    super();
                    this.width = 500;
                    this.height = 300;
                }
            };

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            const result = await context.compressImage('data:image/png;base64,original', 800);
            expect(result).toBe('data:image/png;base64,original');

            global.Image = originalImage;
        });

        it('resizes the image using canvas if width exceeds maxWidth', async () => {
            const originalImage = global.Image;
            global.Image = class extends MockImage {
                constructor() {
                    super();
                    this.width = 1000;
                    this.height = 600;
                }
            };

            const mockContext = {
                drawImage: vi.fn()
            };
            const mockCanvas = {
                width: 0,
                height: 0,
                getContext: vi.fn(() => mockContext),
                toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressed')
            };
            
            const originalCreateElement = document.createElement.bind(document);
            const spyCreateElement = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') return mockCanvas;
                return originalCreateElement(tag);
            });

            let context;
            render(
                <AppProvider>
                    <TestConsumer onRender={ctx => { context = ctx; }} />
                </AppProvider>
            );

            const result = await context.compressImage('data:image/png;base64,original', 800);

            expect(spyCreateElement).toHaveBeenCalledWith('canvas');
            expect(mockCanvas.width).toBe(800);
            expect(mockCanvas.height).toBe(480);
            expect(mockContext.drawImage).toHaveBeenCalled();
            expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.6);
            expect(result).toBe('data:image/jpeg;base64,compressed');

            global.Image = originalImage;
        });
    });
});
