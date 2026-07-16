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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Reports from '../components/pages/Reports';
import { ToastProvider } from '../components/ui/Toast';

// Mock Toast hook and Provider
const mockAddToast = vi.fn();
vi.mock('../components/ui/Toast.jsx', () => ({
  useToast: () => ({ addToast: mockAddToast }),
  ToastProvider: ({ children }) => children
}));

// Mock React PDF renderer to prevent JSDOM crashes
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => children({ loading: false }),
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
}));

// Mock ReportPDF component
vi.mock('../components/features/ReportPDF', () => ({
  default: () => <div data-testid="mock-pdf">Mock PDF</div>
}));

// Mock dropdowns/selectors to simplify form testing
vi.mock('../components/dropdowns/CoverageRatingDropdown', () => ({
  default: ({ value, onChange }) => (
    <select data-testid="coverage-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="None">None</option>
      <option value="Optimal">Optimal</option>
    </select>
  )
}));

vi.mock('../components/dropdowns/SeverityDropdown', () => ({
  default: ({ value, onChange }) => (
    <select data-testid="severity-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="High">High</option>
      <option value="Medium">Medium</option>
    </select>
  )
}));

vi.mock('../components/dropdowns/OutcomeDropdown', () => ({
  default: ({ value, onChange }) => (
    <select data-testid="outcome-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="Missed">Missed</option>
      <option value="Prevented">Prevented</option>
    </select>
  )
}));

vi.mock('../components/features/TTPSelector', () => ({
  default: ({ selectedTTPs, toggleTTP }) => (
    <div data-testid="ttp-selector">
      <button 
        type="button"
        data-testid="add-ttp-btn" 
        onClick={() => toggleTTP('T1190', 'Exploit Public-Facing Application')}
      >
        Select T1190
      </button>
    </div>
  )
}));

vi.mock('../components/ui/UnifiedPosturePill', () => ({
  default: () => <div>UnifiedPosturePill</div>
}));

// Mock useAppContext
const mockCompleteExercise = vi.fn();
const mockSaveSimulationSummary = vi.fn();
const mockGenerateAIContent = vi.fn();
const mockSetActiveAiContext = vi.fn();

const mockExercises = [
  {
    id: 'ex-1',
    simulation: 'APT29 Simulation',
    date: new Date().toISOString(),
    status: 'low',
    ttp: 'T1190',
    finding: 'Exploited server',
  },
  {
    id: 'ex-2',
    simulation: 'APT29 Simulation',
    date: new Date().toISOString(),
    status: 'high',
    ttp: 'T1059',
    finding: 'Command executed',
  }
];

const mockSimulationSummaries = {
  'APT29 Simulation': {
    summary: 'Executive Summary for APT29 Simulation',
    details: {
      goals: 'Test web server and lateral movement',
      environmentCategory: 'Production',
      participants: [{ name: 'Alice', role: 'Blue Team' }]
    },
    testResults: [
      {
        id: 'res-1',
        name: 'Web Server Exploit',
        ttps: ['T1190'],
        outcome: 'Prevented',
        coverageRating: 'Optimal'
      }
    ]
  }
};

const mockAppContextValues = {
  dbAdapter: {
    fetchSimulations: vi.fn().mockResolvedValue(['APT29 Simulation']),
    fetchExercises: vi.fn().mockResolvedValue({
      data: mockExercises,
      total: mockExercises.length,
      page: 1
    })
  },
  exercises: mockExercises,
  completeExercise: mockCompleteExercise,
  simulationSummaries: mockSimulationSummaries,
  saveSimulationSummary: mockSaveSimulationSummary,
  simulationEvidence: {},
  addSimulationEvidence: vi.fn(),
  compressImage: vi.fn(),
  mitreData: {},
  aiSettings: { provider: 'Gemini' },
  generateAIContent: mockGenerateAIContent,
  gaps: [],
  setActiveAiContext: mockSetActiveAiContext,
  isAuthenticated: true,
  isAiActive: true
};

vi.mock('../AppContext', () => ({
  useAppContext: () => mockAppContextValues
}));

describe('Reports Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders simulation dashboard correctly', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Reports />
        </ToastProvider>
      </MemoryRouter>
    );

    // Verify page title
    expect(screen.getByRole('heading', { name: /Reports/ })).toBeInTheDocument();
    
    // Wait for simulations list to load
    await waitFor(() => {
      expect(screen.getByText('APT29 Simulation')).toBeInTheDocument();
    });
  });

  it('toggles simulation detailed report view and opens drilldown modal', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Reports />
        </ToastProvider>
      </MemoryRouter>
    );

    // Wait and click on simulation
    await waitFor(() => {
      expect(screen.getByText('APT29 Simulation')).toBeInTheDocument();
    });
    
    const simCard = screen.getByText('APT29 Simulation');
    fireEvent.click(simCard);

    // Verify Executive Summary section renders
    await waitFor(() => {
      expect(screen.getByText('Executive Summary for APT29 Simulation')).toBeInTheDocument();
    });

    // Open Drilldown modal
    const openDrilldownBtn = screen.getByRole('button', { name: 'Open Drilldown' });
    fireEvent.click(openDrilldownBtn);

    // Verify modal is open
    expect(screen.getAllByText('Simulation Details Drilldown')[0]).toBeInTheDocument();
    // Close Drilldown modal
    const closeBtn = screen.getAllByRole('heading', { name: /Simulation Details Drilldown/ })[0].closest('.glass-panel').querySelector('.close-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Simulation Details Drilldown')).not.toBeInTheDocument();
  });

  it('handles manual simulation logging form workflow', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <Reports />
        </ToastProvider>
      </MemoryRouter>
    );

    // Click Log External Simulation button
    const logBtn = screen.getByRole('button', { name: 'Log External Simulation' });
    fireEvent.click(logBtn);

    // Fill form
    const simNameInput = screen.getByPlaceholderText('e.g. Ad-Hoc External Penetration Test');
    fireEvent.change(simNameInput, { target: { value: 'Manual APT Test' } });

    // Select TTP
    const addTtpBtn = screen.getByTestId('add-ttp-btn');
    fireEvent.click(addTtpBtn);

    // Update Outcome and Coverage
    const coverageSelect = screen.getByTestId('coverage-select');
    fireEvent.change(coverageSelect, { target: { value: 'Optimal' } });

    const outcomeSelect = screen.getByTestId('outcome-select');
    fireEvent.change(outcomeSelect, { target: { value: 'Prevented' } });

    // Click Submit
    const submitBtn = screen.getByRole('button', { name: 'Submit External Simulation' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCompleteExercise).toHaveBeenCalled();
      expect(mockSaveSimulationSummary).toHaveBeenCalledWith('Manual APT Test', expect.any(Object));
    });
  });
});
