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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import GapTracker from '../components/pages/GapTracker';
// Mock Toast hook and Provider
const mockAddToast = vi.fn();
const ToastProvider = ({ children }) => children;
vi.mock('../components/ui/Toast.jsx', () => ({
  useToast: () => ({ addToast: mockAddToast }),
  ToastProvider: ({ children }) => children
}));

// Mock child components to isolate GapTracker layout
vi.mock('../components/dropdowns/EnvironmentDropdown', () => ({
  default: () => <div>EnvironmentDropdown</div>
}));
vi.mock('../components/dropdowns/TagDropdown', () => ({
  default: () => <div>TagDropdown</div>
}));
vi.mock('../components/features/GapDetails', () => ({
  default: ({ gapIdProp, onClose }) => (
    <div data-testid="gap-details">
      GapDetails for {gapIdProp}
      <button onClick={onClose}>Close Details</button>
    </div>
  )
}));
vi.mock('../components/dropdowns/ValidationOutcomeDropdown', () => ({
  default: ({ value, onChange }) => (
    <select 
      data-testid="val-outcome-select" 
      value={value} 
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Select...</option>
      <option value="Optimal">Optimal</option>
    </select>
  )
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// Mock useAppContext variables
const mockUpdateGap = vi.fn();
const mockCreateGap = vi.fn();
const mockDeleteGap = vi.fn();
const mockUpdateExerciseValidation = vi.fn();
const mockSetActiveAiContext = vi.fn();
const mockConfirmAction = vi.fn((msg, callback) => callback());
const mockSetSimulationSummaries = vi.fn();
const mockSetExercises = vi.fn();
const mockSetAllExercisesData = vi.fn();

const mockGaps = [
  {
    id: 'GAP-100',
    displayId: 'GAP-100',
    title: 'Vulnerable Public Service',
    finding: 'Apache Server Vulnerability',
    ttp: 'T1190',
    phase: 'Delivery',
    environment: ['Production'],
    severity: 'Critical',
    status: 'Open',
    priorityScore: 90,
    createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    resolvedDate: null,
  },
  {
    id: 'GAP-101',
    displayId: 'GAP-101',
    title: 'Local Root Exploit',
    finding: 'Local SUID Exploit',
    ttp: 'T1059',
    phase: 'Exploitation',
    environment: ['Production'],
    severity: 'High',
    status: 'In Progress',
    priorityScore: 70,
    createdDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedDate: null,
  },
  {
    id: 'GAP-102',
    displayId: 'GAP-102',
    title: 'Resolved Database Access',
    finding: 'Unauthenticated DB Access',
    ttp: 'T1190',
    phase: 'Delivery',
    environment: ['Staging'],
    severity: 'Medium',
    status: 'Resolved',
    priorityScore: 40,
    createdDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // Resolved in 2 days
  }
];

const mockMitreData = {
  'Initial Access': {
    techniques: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }]
  },
  'Execution': {
    techniques: [{ id: 'T1059', name: 'Command and Scripting Interpreter' }]
  }
};

const mockAppContextValues = {
  gaps: mockGaps,
  updateGap: mockUpdateGap,
  createGap: mockCreateGap,
  deleteGap: mockDeleteGap,
  isReadOnly: false,
  mitreData: mockMitreData,
  updateExerciseValidation: mockUpdateExerciseValidation,
  aiSettings: { provider: 'Gemini' },
  setActiveAiContext: mockSetActiveAiContext,
  activeEnvironmentFilter: 'All',
  activeTagFilter: 'All',
  targetEnvironments: ['Production', 'Staging'],
  simulationSummaries: {},
  setSimulationSummaries: mockSetSimulationSummaries,
  setExercises: mockSetExercises,
  allExercisesData: {},
  setAllExercisesData: mockSetAllExercisesData,
  dbAdapter: { bulkImport: vi.fn(), saveData: vi.fn(), fetchData: vi.fn() },
  confirmAction: mockConfirmAction,
};

vi.mock('../AppContext', () => ({
  useAppContext: () => mockAppContextValues,
}));

describe('GapTracker component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    
    // Setup portal root
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'root');
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    const portalRoot = document.getElementById('root');
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
  });

  it('renders Kanban board with columns, items and MTTR', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <GapTracker />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Gap Tracker')).toBeInTheDocument();
    
    // Verify MTTR badge (Resolved in 2 days -> "2d 0h")
    expect(screen.getByText('MTTR')).toBeInTheDocument();
    expect(screen.getByText('2d 0h')).toBeInTheDocument();
    
    // Verify columns
    expect(screen.getByRole('heading', { name: /Open/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /In Progress/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Resolved/ })).toBeInTheDocument();

    // Verify cards are placed
    expect(screen.getByText('Apache Server Vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Local SUID Exploit')).toBeInTheDocument();
    expect(screen.getByText('Unauthenticated DB Access')).toBeInTheDocument();
  });

  it('allows filtering by search query', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <GapTracker />
        </ToastProvider>
      </MemoryRouter>
    );

    // Initial state: both open cards are visible
    expect(screen.getByText('Apache Server Vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Local SUID Exploit')).toBeInTheDocument();
    
    const searchInput = screen.getByPlaceholderText('Search gaps...');
    fireEvent.change(searchInput, { target: { value: 'SUID' } });
    
    // SUID is visible, Apache is filtered out
    expect(screen.queryByText('Apache Server Vulnerability')).not.toBeInTheDocument();
    expect(screen.getByText('Local SUID Exploit')).toBeInTheDocument();
  });

  it('opens detailed gap view on card click', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <GapTracker />
        </ToastProvider>
      </MemoryRouter>
    );

    const card = screen.getByText('Apache Server Vulnerability');
    fireEvent.click(card);

    expect(screen.getByTestId('gap-details')).toBeInTheDocument();
    expect(screen.getByText('GapDetails for GAP-100')).toBeInTheDocument();

    // Close details
    const closeBtn = screen.getByRole('button', { name: 'Close Details' });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('gap-details')).not.toBeInTheDocument();
  });

  it('handles Accept Risk modal workflow', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <GapTracker />
        </ToastProvider>
      </MemoryRouter>
    );

    // Click "Accept Risk" on the first card
    const acceptRiskBtns = screen.getAllByRole('button', { name: 'Accept Risk' });
    fireEvent.click(acceptRiskBtns[0]);

    // Modal should render (title heading)
    expect(screen.getByRole('heading', { name: 'Accept Risk' })).toBeInTheDocument();
    
    // Fill form
    const authorityInput = screen.getByPlaceholderText('e.g. CISO, Risk Committee');
    const justificationInput = screen.getByPlaceholderText('Provide business or technical rationale for accepting this gap...');
    
    fireEvent.change(authorityInput, { target: { value: 'CISO' } });
    await waitFor(() => {
      expect(authorityInput.value).toBe('CISO');
    });

    fireEvent.change(justificationInput, { target: { value: 'Business critical system, no patch available.' } });
    await waitFor(() => {
      expect(justificationInput.value).toBe('Business critical system, no patch available.');
    });

    // Submit risk acceptance using the "Accept Risk" button inside the modal portal
    const submitBtn = within(document.getElementById('root')).getByRole('button', { name: 'Accept Risk' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateGap).toHaveBeenCalledWith('GAP-100', {
        status: 'Risk Accepted',
        riskAcceptedBy: 'CISO',
        riskJustification: 'Business critical system, no patch available.',
        riskAcceptedDate: expect.any(String)
      });
    });
  });

  it('instantly updates status when dragging card to In Progress column', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <GapTracker />
        </ToastProvider>
      </MemoryRouter>
    );

    // Get the In Progress column div
    const inProgressColumn = screen.getByRole('heading', { name: /In Progress/ }).parentElement;
    
    // Simulate drag start on an Open card
    const card = screen.getByText('Apache Server Vulnerability').closest('[draggable="true"]');
    
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } });
    
    // Wait a tick for React state to update draggedGapId
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // Drop on In Progress column
    fireEvent.drop(inProgressColumn, { dataTransfer: { getData: () => 'GAP-100' } });
    
    await waitFor(() => {
      // It should call updateGap immediately without opening a modal
      expect(mockUpdateGap).toHaveBeenCalledWith('GAP-100', expect.objectContaining({ status: 'In Progress' }));
    });
  });

  it('opens Validation Modal when dragging card to Resolved column', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <GapTracker />
        </ToastProvider>
      </MemoryRouter>
    );

    // Get the Resolved column div by targeting the heading's parentElement
    const resolvedColumn = screen.getByRole('heading', { name: /Resolved/ }).parentElement;
    
    // Simulate drag start on the card
    const card = screen.getByText('Apache Server Vulnerability').closest('[draggable="true"]');
    
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } });
    
    // Wait a tick for React state to update draggedGapId
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // Drop on Resolved column
    fireEvent.drop(resolvedColumn, { dataTransfer: { getData: () => 'GAP-100' } });
    
    // Let's verify Validation Modal opens
    await waitFor(() => {
      expect(screen.getByText('Validate Remediation')).toBeInTheDocument();
    });

    // Fill validation outcome dropdown mock
    const outcomeSelect = screen.getByTestId('val-outcome-select');
    fireEvent.change(outcomeSelect, { target: { value: 'Optimal' } });

    // Fill validation form
    const notesArea = screen.getByPlaceholderText(/e.g., Tested newly deployed Sigma rule/);
    fireEvent.change(notesArea, { target: { value: 'Verified with new Nessus scan' } });
    
    // Submit validation (mock resolved = true)
    mockUpdateExerciseValidation.mockResolvedValueOnce(true);
    
    const submitValidationBtn = screen.getByRole('button', { name: 'Submit Validation' });
    fireEvent.click(submitValidationBtn);
    
    await waitFor(() => {
      expect(mockUpdateExerciseValidation).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith('Gap Resolved successfully.', 'success');
    });
  });
});
