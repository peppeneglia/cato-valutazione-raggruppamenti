# Valutazione ammissibilità del raggruppamento

Dato un bando pubblico con i suoi requisiti di partecipazione e un
raggruppamento temporaneo di imprese con i rispettivi fascicoli, lo strumento
dice **chi copre cosa, quanto manca in numeri e cosa fare per diventare
ammissibili** — lotto per lotto, con la provenienza di ogni valore e le
assunzioni dichiarate.

Progetto personale a scopo dimostrativo, non affiliato ad alcuna azienda. I dati
della fixture sono inventati: i riferimenti agli articoli del disciplinare sono
placeholder espliciti.

## Avvio

Richiede Node 20.18.

```
npm install
npm run dev        # sviluppo
npm run build      # produzione, in dist/
npm run test       # motore + interfaccia (Vitest, 300+ test)
npm run lint
npm run fixture:esito   # rigenera l'esito atteso della fixture dal motore
```

Nessun backend, nessuna chiamata di rete, nessuna persistenza: tutto gira nel
browser e nulla ne esce.

## La tesi

**Il motore non conosce il diritto degli appalti.** Ogni requisito porta con sé
due dati letti dal disciplinare — il *criterio* (quali fatti del fascicolo lo
soddisfano) e la *regola di composizione* (come quei fatti si compongono tra più
soggetti: ciascun membro, somma dei membri, chi esegue una prestazione, almeno
un membro). Il motore applica quattro operatori a quei dati. Nessuna soglia,
finestra, minimo per ruolo o avvalibilità è scritta nel codice: arrivano dal
disciplinare come dati, e la famiglia del requisito è puramente descrittiva.

Tre stati, non due: `coperto`, `scoperto`, `da_verificare`. Il terzo non è un
giallo decorativo: è il motore che dichiara di non poter decidere, perché
l'equivalenza tra due scope, due attività o due CPV è un giudizio semantico.
Decide una persona.

## Cosa fa

- **Valuta un raggruppamento contro un lotto**: verdetto (ammissibile, con
  riserva, non ammissibile), una riga per requisito con il contributo reale di
  ogni membro, il delta, la motivazione in italiano, le fonti.
- **Distingue "non possiede" da "possiede ma non conta qui"**: chi ha una
  certificazione senza eseguire la prestazione non è una mancanza.
- **Avvalimento**: le ausiliarie integrano il fascicolo di un membro specifico,
  solo per i requisiti indicati e solo se il disciplinare li dichiara avvalibili.
- **Anomalie come dati, non eccezioni**: mandataria assente, quote che non
  tornano, riferimenti inesistenti, parametri assurdi. Le bloccanti forzano il
  verdetto; le segnalazioni no.
- **Avvisi di scadenza**: documenti validi oggi che scadono prima del termine di
  presentazione o entro un orizzonte, distinti dalle scoperture.
- **Rimedi verificati**: un rimedio è proposto solo se, applicato a una copia
  dell'input, la rivalutazione lo conferma. Mai perché sembra giusto.
- **Percorso minimo**: la sequenza più breve di mosse (riassegnazione di quota,
  uscita, ingresso, avvalimento) che porta ad ammissibile; se irraggiungibile, a
  con riserva, dichiarando cosa resta. Ricerca in ampiezza, senza limiti di
  profondità: le mosse sono finite.
- **Confronti**: lo stesso raggruppamento su ogni lotto; la composizione attuale
  contro quella prima dell'ultima prova.
- **Prova, non applica**: ogni mossa si prova sul foglio di lavoro come modifica
  annullabile, con un'etichetta onesta nella storia.

## Cosa non fa

Sui requisiti generali verifica che la dichiarazione esista, non che sia vera.
Non giudica equivalenze. Non modella capacità tecniche non documentali
(organico, attrezzature). Non tratta il subappalto. Non legge il PDF del
disciplinare: i requisiti arrivano già strutturati. Non sostituisce la lettura
del documento. La pagina lo dichiara in fondo.

## Struttura

```
src/domain.ts          il contratto: tipi del dominio, unioni discriminate
src/engine/            motore puro: criteri, operatori, validazione, verdetto,
                       scadenze, rimedi, percorso, confronto
src/fixture.ts         gara multi-lotto di esempio + esito atteso GENERATO dal motore
src/lavoro.ts          il foglio di lavoro: reducer puro con storia annullabile
src/descrizioni.ts     testo dagli identificativi
src/formato.ts         euro, date, percentuali in formato italiano
src/ui/                componenti React, solo token CSS
src/tokens.css         i token del brand (placeholder), unico posto con valori fissi
```

Il motore è una funzione pura `valuta(parametri) → Esito`: nessun I/O, nessuna
data implicita, nessuna mutazione. La data di riferimento è un parametro, e
spostandola si vede un certificato scadere.

## Assunzioni dichiarate

Due regole sono del motore e non del disciplinare, e l'esito le espone per
codice così che l'interfaccia le raccolga in una legenda:

- **Arrotondamento per eccesso dei minimi per ruolo**: "40 % di 3 referenze =
  1,2, quindi almeno 2". Si sbaglia dalla parte che costa meno.
- **Classe CPV**: un servizio il cui CPV non condivide le prime *n* cifre con
  quello di gara non è analogo e non conta; *n* è un dato del criterio.

## Test

Il motore è puro e si testa interamente senza infrastruttura: ogni operatore,
ogni codice di anomalia, lo stesso fascicolo a due date, il percorso a una, due e
nessuna mossa, l'equivalenza della ricerca con e senza il limite teorico, la
purezza di `valuta`. L'interfaccia si testa nel comportamento con Testing
Library e `user-event`: niente snapshot.
