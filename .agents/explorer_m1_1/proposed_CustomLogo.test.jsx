import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CustomLogo from '../components/CustomLogo';

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
