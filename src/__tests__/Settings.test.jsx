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
import Settings from '../components/pages/Settings';

// Mock cryptoUtils
vi.mock('../lib/cryptoUtils', () => ({
  encryptData: vi.fn().mockResolvedValue('encrypted_mock_data'),
  decryptData: vi.fn().mockResolvedValue(JSON.stringify({
    gaps: [{ id: 'GAP-1', title: 'Test Gap', severity: 'Critical' }],
    exercises: [{ id: 'EX-1', ttp: 'T1059', outcome: 'Logged' }],
    simulationSummaries: { 'sim-1': 'Simulation Summary' },
    simulationEvidence: {}
  })),
}));

// Mock useAppContext variables
const mockSetAiSettings = vi.fn();
const mockSetDbConfig = vi.fn();
const mockDeleteEnvironment = vi.fn();
const mockDeleteTag = vi.fn();
const mockDeleteSecurityControl = vi.fn();
const mockAddSecurityControl = vi.fn();
const mockConfirmAction = vi.fn((msg, callback) => callback());
const mockPingDb = vi.fn();
const mockSetGaps = vi.fn();
const mockSetExercises = vi.fn();
const mockSetSimulationSummaries = vi.fn();
const mockSetSimulationEvidence = vi.fn();
const mockSetActiveAiContext = vi.fn();

const mockAppContextValues = {
  aiSettings: { provider: 'Gemini', model: 'gemini-1.5-flash', apiKey: 'mock-ai-key' },
  setAiSettings: mockSetAiSettings,
  targetEnvironments: ['Prod', 'Staging'],
  deleteEnvironment: mockDeleteEnvironment,
  targetTags: ['Critical', 'PCI-DSS'],
  deleteTag: mockDeleteTag,
  targetSecurityControls: ['Splunk', 'CrowdStrike'],
  deleteSecurityControl: mockDeleteSecurityControl,
  addSecurityControl: mockAddSecurityControl,
  confirmAction: mockConfirmAction,
  dbConfig: { provider: 'local', endpoint: '', apiKey: '' },
  setDbConfig: mockSetDbConfig,
  dbAdapter: { bulkImport: vi.fn().mockResolvedValue() },
  testDbConnection: mockPingDb,
  gaps: [],
  exercises: [],
  simulationSummaries: {},
  simulationEvidence: {},
  setGaps: mockSetGaps,
  setExercises: mockSetExercises,
  setSimulationSummaries: mockSetSimulationSummaries,
  setSimulationEvidence: mockSetSimulationEvidence,
  setActiveAiContext: mockSetActiveAiContext,
};

vi.mock('../AppContext', () => ({
  useAppContext: () => mockAppContextValues,
}));

describe('Settings component', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    
    // Mock window.location
    delete window.location;
    window.location = { href: '', assign: vi.fn() };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('renders Settings component correctly with initial state', () => {
    render(<Settings />);
    
    expect(screen.getByText('System Configuration')).toBeInTheDocument();
    expect(screen.getByText('Generative AI Integration')).toBeInTheDocument();
    expect(screen.getByText('Database & Sync')).toBeInTheDocument();
    expect(screen.getByText('Global Metadata')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('toggles panels when headers are clicked', () => {
    render(<Settings />);
    
    // Database & Sync panel should start collapsed (inner text not visible initially)
    expect(screen.queryByText(/Configure your primary datastore/)).not.toBeInTheDocument();
    
    // Click header to expand
    fireEvent.click(screen.getByText('Database & Sync'));
    expect(screen.getByText(/Configure your primary datastore/)).toBeInTheDocument();
    
    // Click again to collapse
    fireEvent.click(screen.getByText('Database & Sync'));
    expect(screen.queryByText(/Configure your primary datastore/)).not.toBeInTheDocument();
  });

  it('allows editing AI settings and toggling API key visibility', () => {
    render(<Settings />);
    
    const apiKeyInput = screen.getByPlaceholderText('Enter your Gemini API key...');
    expect(apiKeyInput.value).toBe('mock-ai-key');
    expect(apiKeyInput.type).toBe('password');
    
    // Toggle visibility
    const toggleVisibleBtn = screen.getByRole('button', { name: '' }); // the only button inside API key container is eye icon
    fireEvent.click(toggleVisibleBtn);
    expect(apiKeyInput.type).toBe('text');
    
    // Change input value
    fireEvent.change(apiKeyInput, { target: { value: 'new-key' } });
    expect(apiKeyInput.value).toBe('new-key');
  });

  it('tests AI Connection successfully', async () => {
    // Mock success fetch response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({})
    });

    render(<Settings />);
    
    const testConnectionBtn = screen.getByText('Test AI Connection');
    fireEvent.click(testConnectionBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Connection successful!')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalled();
  });

  it('handles AI Connection failure', async () => {
    // Mock error fetch response
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    render(<Settings />);
    
    const testConnectionBtn = screen.getByText('Test AI Connection');
    fireEvent.click(testConnectionBtn);
    
    await waitFor(() => {
      expect(screen.getByText('HTTP Error: 500')).toBeInTheDocument();
    });
  });

  it('tests Database Connection successfully for supabase provider', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({})
    });

    render(<Settings />);
    
    // Expand Database & Sync
    fireEvent.click(screen.getByText('Database & Sync'));
    
    // Select Supabase provider
    fireEvent.click(screen.getByText('Supabase'));
    
    // Type endpoint URL
    const endpointInput = screen.getByPlaceholderText('Project URL');
    fireEvent.change(endpointInput, { target: { value: 'https://test-supabase-project.supabase.co' } });
    
    const testDbBtn = screen.getByText('Test Database Connection');
    fireEvent.click(testDbBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Connection successful!')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-supabase-project.supabase.co/rest/v1/gaps?limit=1',
      expect.any(Object)
    );
  });

  it('manages target environments, tags, and controls', () => {
    render(<Settings />);
    
    // Expand Global Metadata
    fireEvent.click(screen.getByText('Global Metadata'));
    
    expect(screen.getByText('Prod')).toBeInTheDocument();
    expect(screen.getByText('Staging')).toBeInTheDocument();
    
    // Delete environment
    const deleteEnvButtons = screen.getAllByTitle('Delete Environment');
    fireEvent.click(deleteEnvButtons[0]);
    expect(mockConfirmAction).toHaveBeenCalled();
    expect(mockDeleteEnvironment).toHaveBeenCalledWith('Prod');
    
    // Expand Tags
    fireEvent.click(screen.getByText('Tag Management'));
    expect(screen.getByText('PCI-DSS')).toBeInTheDocument();
    const deleteTagButtons = screen.getAllByTitle('Delete Tag');
    fireEvent.click(deleteTagButtons[0]);
    expect(mockDeleteTag).toHaveBeenCalledWith('Critical');

    // Security Controls should already be visible since Global Metadata is expanded
    expect(screen.getByText('Splunk')).toBeInTheDocument();
    
    // Add new security control
    const inputControl = screen.getByPlaceholderText('Enter new security control (e.g. Splunk, CrowdStrike)...');
    fireEvent.change(inputControl, { target: { value: 'SentinelOne' } });
    fireEvent.click(screen.getByText('Add Control'));
    expect(mockAddSecurityControl).toHaveBeenCalledWith('SentinelOne');
  });

  it('triggers erase data in Danger Zone', () => {
    const localClearSpy = vi.spyOn(Storage.prototype, 'clear');
    
    render(<Settings />);
    
    fireEvent.click(screen.getByText('Danger Zone'));
    const eraseBtn = screen.getByText('Erase All Application Data');
    fireEvent.click(eraseBtn);
    
    expect(mockConfirmAction).toHaveBeenCalled();
    expect(localClearSpy).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  it('triggers export backup flow', async () => {
    // Fill gaps/exercises to ensure data exports
    mockAppContextValues.gaps = [{ id: 'GAP-1' }];
    
    render(<Settings />);
    
    fireEvent.click(screen.getByText('Database & Sync'));
    fireEvent.click(screen.getByText('Export Backup'));
    
    // Enter password modal should open
    const passwordInput = screen.getByPlaceholderText('Password');
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });
    
    // Submit password
    fireEvent.click(screen.getByText('Encrypt & Download'));
    
    await waitFor(() => {
      expect(screen.getByText('Backup encrypted and downloaded successfully.')).toBeInTheDocument();
    });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('triggers import backup flow', async () => {
    // Stub FileReader
    class MockFileReader {
      readAsText(file) {
        setTimeout(() => {
          this.onload({ target: { result: 'encrypted_mock_string' } });
        }, 10);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const { container } = render(<Settings />);
    
    fireEvent.click(screen.getByText('Database & Sync'));
    
    // Select a file
    const file = new File(['encrypted_mock_string'], 'backup.enc', { type: 'text/plain' });
    const fileInput = container.querySelector('#db-import-input');
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Password modal should open
    const passwordInput = screen.getByPlaceholderText('Password');
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });
    
    fireEvent.click(screen.getByText('Decrypt & Verify'));
    
    await waitFor(() => {
      expect(screen.getByText('Encrypted backup restored securely.')).toBeInTheDocument();
    });
    expect(mockAppContextValues.dbAdapter.bulkImport).toHaveBeenCalled();
  });

  it('saves settings when Save Settings is clicked', () => {
    render(<Settings />);
    
    const saveBtn = screen.getByText('Save Settings');
    fireEvent.click(saveBtn);
    
    expect(mockSetAiSettings).toHaveBeenCalled();
    expect(mockSetDbConfig).toHaveBeenCalled();
    expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
  });
});
