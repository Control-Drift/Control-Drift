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
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CustomLogo from '../components/ui/CustomLogo';

describe('CustomLogo component', () => {
  it('renders CustomLogo SVG correctly', () => {
    const { container } = render(<CustomLogo className="test-class" />);
    
    // Find the svg element
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveClass('test-class');
    
    // Check that top and bottom text segments are present
    const orbitalTexts = screen.getAllByText('ORBITAL');
    expect(orbitalTexts.length).toBe(2);
    
    const zeroTexts = screen.getAllByText('ZERO');
    expect(zeroTexts.length).toBe(2);
  });
});
