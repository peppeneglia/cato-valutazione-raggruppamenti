import { describe, expect, it } from 'vitest';
import { creaAnomalia } from './validazione';
import { calcolaVerdetto } from './verdetto';

describe('calcolaVerdetto', () => {
  it('è ammissibile con tutto coperto e nessuna anomalia', () => {
    expect(calcolaVerdetto([{ stato: 'coperto', vincolante: true }], [])).toBe('ammissibile');
  });
  it('è non ammissibile con uno scoperto vincolante', () => {
    expect(calcolaVerdetto([{ stato: 'coperto', vincolante: true }, { stato: 'scoperto', vincolante: true }], [])).toBe('non_ammissibile');
  });
  it('è con riserva con un da verificare', () => {
    expect(calcolaVerdetto([{ stato: 'da_verificare', vincolante: true }], [])).toBe('ammissibile_con_riserva');
  });
  it('è con riserva con uno scoperto non vincolante', () => {
    expect(calcolaVerdetto([{ stato: 'scoperto', vincolante: false }], [])).toBe('ammissibile_con_riserva');
  });
  it('lo scoperto vincolante prevale sul da verificare', () => {
    expect(calcolaVerdetto([{ stato: 'da_verificare', vincolante: true }, { stato: 'scoperto', vincolante: true }], [])).toBe('non_ammissibile');
  });
  it('un’anomalia bloccante forza non ammissibile anche con tutto coperto', () => {
    expect(calcolaVerdetto([{ stato: 'coperto', vincolante: true }], [creaAnomalia({ codice: 'mandataria_assente' })])).toBe('non_ammissibile');
  });
  it('una segnalazione non cambia il verdetto', () => {
    expect(calcolaVerdetto([{ stato: 'coperto', vincolante: true }], [creaAnomalia({ codice: 'membro_senza_quote', soggettoId: 's' })])).toBe('ammissibile');
  });
  it('senza requisiti è ammissibile', () => {
    expect(calcolaVerdetto([], [])).toBe('ammissibile');
  });
});
