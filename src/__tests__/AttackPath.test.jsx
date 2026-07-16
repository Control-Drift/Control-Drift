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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AttackPath from '../components/features/AttackPath';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useAppContext
const mockGenerateAIContent = vi.fn();
const mockSetActiveAiContext = vi.fn();

const mockGaps = [
  {
    id: 'GAP-1',
    title: 'External Access Point Vulnerable',
    finding: 'Exposed endpoint allows unauthenticated command injection',
    ttp: 'T1190',
    phase: 'Delivery',
    environment: ['Production'],
    severity: 'Critical',
    status: 'Open',
    outcome: 'Missed',
    coverageRating: 'None',
    payloadCode: 'curl -X POST http://victim/exploit',
    details: 'Details about the external vulnerability...',
    remediation: 'Apply patch 1.2.3'
  },
  {
    id: 'GAP-2',
    title: 'Privilege Escalation via SUID',
    finding: 'Misconfigured SUID binary allows root shell access',
    ttp: 'T1059',
    phase: 'Exploitation',
    environment: ['Production'],
    severity: 'High',
    status: 'In Progress',
    outcome: 'Logged',
    coverageRating: 'Minimal',
    payloadCode: 'find . -exec /bin/sh -p \\;',
    details: 'Details about privilege escalation...',
    remediation: 'Remove SUID bit from binaries'
  }
];

const mockMitreData = {
  'Initial Access': {
    techniques: [
      { id: 'T1190', name: 'Exploit Public-Facing Application', subTechniques: [] }
    ]
  },
  'Execution': {
    techniques: [
      { id: 'T1059', name: 'Command and Scripting Interpreter', subTechniques: [] }
    ]
  }
};

const mockAppContextValues = {
  gaps: mockGaps,
  exercises: [],
  mitreData: mockMitreData,
  setActiveAiContext: mockSetActiveAiContext,
  generateAIContent: mockGenerateAIContent,
  aiSettings: { provider: 'Gemini' },
  isAiActive: true,
};

vi.mock('../AppContext', () => ({
  useAppContext: () => mockAppContextValues,
}));

describe('AttackPath component', () => {
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

  it('renders empty state when there are no gaps', () => {
    // Override gaps to be empty
    const originalGaps = mockAppContextValues.gaps;
    mockAppContextValues.gaps = [];
    
    render(<AttackPath />);
    
    expect(screen.getByText('No Active Attack Paths')).toBeInTheDocument();
    expect(screen.getByText(/There are currently no active coverage gaps plotted/)).toBeInTheDocument();
    
    // Restore gaps
    mockAppContextValues.gaps = originalGaps;
  });

  it('renders cyber kill chain stages and plots gaps correctly', () => {
    render(<AttackPath />);
    
    expect(screen.getByText('Attack Path')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Exploitation')).toBeInTheDocument();
    
    // Verify gap cards exist under correct phases
    expect(screen.getByText('Exposed endpoint allows unauthenticated command injection')).toBeInTheDocument();
    expect(screen.getByText('Misconfigured SUID binary allows root shell access')).toBeInTheDocument();
  });

  it('triggers AI threat vector generation and renders paths', async () => {
    const aiResponse = JSON.stringify({
      edges: [
        {
          sourceId: 'GAP-1',
          targetId: 'GAP-2',
          rationale: 'Pivot vector: Command injection on public facing app gives access to local shell to trigger SUID privilege escalation.'
        }
      ]
    });
    mockGenerateAIContent.mockResolvedValueOnce(aiResponse);

    render(<AttackPath />);
    
    const mapPathsBtn = screen.getByRole('button', { name: /Map Viable Paths/ });
    fireEvent.click(mapPathsBtn);
    
    expect(screen.getByText('AI Assessing Vectors...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Map Viable Paths')).toBeInTheDocument();
    });
    
    // Verify SVG paths are rendered and count badge updates
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 threat vector
  });

  it('opens detailed gap modal on card click', async () => {
    render(<AttackPath />);
    
    const gapCard = screen.getByText('Exposed endpoint allows unauthenticated command injection');
    fireEvent.click(gapCard);
    
    // Verify modal elements are rendered via Portal in #root
    expect(screen.getAllByText('T1190').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Exploit Public-Facing Application').length).toBeGreaterThan(0);
    expect(screen.getByText('Critical Severity')).toBeInTheDocument();
    expect(screen.getAllByText('Production').length).toBeGreaterThan(0);
    
    // View Payload code
    const viewPayloadBtn = screen.getByRole('button', { name: /View Payload/i });
    fireEvent.click(viewPayloadBtn);
    expect(screen.getByText('curl -X POST http://victim/exploit')).toBeInTheDocument();
    
    // Click Open in Gap Tracker and assert navigation
    const openTrackerBtn = screen.getByRole('button', { name: /Open in Gap Tracker/ });
    fireEvent.click(openTrackerBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/gaps', { state: { openGapId: 'GAP-1' } });
    
    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close/ });
    fireEvent.click(closeBtn);
    
    expect(screen.queryByText('CRITICAL Severity')).not.toBeInTheDocument();
  });
});
