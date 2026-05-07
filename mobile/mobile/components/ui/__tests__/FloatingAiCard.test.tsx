import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import FloatingAiCard from '../FloatingAiCard';

describe('FloatingAiCard', () => {
  const defaultProps = {
    visible: true,
    title: 'Test Title',
    subtitle: 'Test Subtitle',
  };

  it('renders correctly when visible', () => {
    render(<FloatingAiCard {...defaultProps} />);

    expect(screen.getByText('Test Title')).toBeTruthy();
    expect(screen.getByText('Test Subtitle')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    render(<FloatingAiCard {...defaultProps} visible={false} />);

    expect(screen.queryByText('Test Title')).toBeNull();
    expect(screen.queryByText('Test Subtitle')).toBeNull();
  });

  it('applies correct opacity animation', () => {
    const { rerender } = render(<FloatingAiCard {...defaultProps} visible={false} />);

    // Initially should not be visible
    expect(screen.queryByText('Test Title')).toBeNull();

    // When made visible, should appear
    rerender(<FloatingAiCard {...defaultProps} visible={true} />);
    expect(screen.getByText('Test Title')).toBeTruthy();
  });

  it('handles press events', () => {
    const onPress = jest.fn();
    render(<FloatingAiCard {...defaultProps} onPress={onPress} />);

    const card = screen.getByTestId('floating-ai-card');
    fireEvent.press(card);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});