// @vitest-environment jsdom
//
// Test di comportamento della pagina: cosa fa, non come appare.
// Niente snapshot.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('pagina — avvio', () => {
  it('mostra il verdetto del primo lotto e la data di riferimento della fixture', () => {
    render(<App />);
    const verdetto = screen.getByRole('region', { name: 'Verdetto' });
    expect(within(verdetto).getByText('Non ammissibile')).toBeTruthy();
    expect(screen.getByLabelText('Data di riferimento')).toHaveProperty('value', '2026-09-14');
  });
  it('elenca i lotti e dichiara la classifica in calcolo finché il motore non risponde', async () => {
    render(<App />);
    const lotti = screen.getByRole('region', { name: 'Lotti' });
    expect(within(lotti).getAllByRole('button')).toHaveLength(2);
    expect(within(lotti).getAllByText('Calcolo in corso…').length).toBeGreaterThan(0);
    expect(await within(lotti).findByText('Ammissibile')).toBeTruthy();
    expect(within(lotti).queryByText('Calcolo in corso…')).toBeNull();
  });
  it('selezionare un lotto cambia il verdetto mostrato', async () => {
    render(<App />);
    const lotti = screen.getByRole('region', { name: 'Lotti' });
    within(lotti).getByRole('button', { name: /lotto-2/ }).click();
    const verdetto = screen.getByRole('region', { name: 'Verdetto' });
    expect(await within(verdetto).findByText('Ammissibile')).toBeTruthy();
  });
});
