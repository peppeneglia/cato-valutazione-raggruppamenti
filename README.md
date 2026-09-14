# Valutazione ammissibilità del raggruppamento

Dato un bando pubblico con i suoi requisiti di partecipazione e un
raggruppamento temporaneo di imprese con i rispettivi fascicoli, lo strumento
dice **chi copre cosa, quanto manca in numeri e cosa fare per diventare
ammissibili** — con la provenienza di ogni valore e le assunzioni dichiarate.
E quando il documento non decide, lo dice invece di scegliere in silenzio.

Progetto personale a scopo dimostrativo, non affiliato ad alcuna azienda.

## Il caso reale

Il bando disponibile è la gara **ASL Roma 6, n. 9445747** — fornitura di
farmaci e dispositivi da parte di grossista con consegna veloce — letta dal
disciplinare di gara pubblico, con articolo e pagina per ogni valore. Le
imprese e i loro fascicoli sono inventati, e la pagina lo dichiara.

## I documenti

Bandi e fascicoli non sono nel codice: sono file JSON in `public/documenti/`,
che l'applicazione carica all'avvio. `indice.json` elenca quelli disponibili;
per aggiungere un bando basta il suo file e una voce nell'indice.

La pagina si apre sulla scelta, non su un esito: quale gara, quali imprese,
chi è la mandataria. Accanto alle gare disponibili si carica un file dal
proprio computer — un bando o dei fascicoli nello stesso formato — che si
legge nel browser e non viene inviato a nessuno. Le quote partono in parti
uguali; dall'esito si torna alla scelta senza ricaricare.

Il formato è il nostro formato di ingresso al motore: **requisiti
strutturati**, prodotti a valle dell'estrazione dal documento di gara.
L'estrazione questo progetto non la fa, per scelta. Ogni documento dichiara
in testa cosa è (`formato`) e da dove viene (`provenienza`, reale o di
esempio): la dichiarazione sulla pagina nasce da lì. Il campo `note`, su
qualunque oggetto, porta le ragioni di chi ha strutturato il documento — un
testo per campo, e ogni chiave deve essere un campo di quell'oggetto. Il
motore non lo legge.

Un documento che non ha la forma giusta non rompe la pagina: resta
nell'elenco con i suoi errori, ciascuno con il percorso del campo, cosa ci
voleva e cosa c'è. La coerenza — quote che non tornano, rinvii a valori che
il bando non nomina — non è un errore di forma: la dice il motore, come
anomalia.

Il disciplinare rompe un modello ingenuo in sette punti, e non con requisiti
esotici: con l'**indeterminatezza**. Tre requisiti su sei non dicono come si
posseggono nel raggruppamento; la soglia del fatturato rinvia a un valore che
il documento scrive in due modi nella stessa pagina; "ultimo triennio" non
dice da quando; la data di pubblicazione non compare mai; un requisito chiede
l'iscrizione "in registri o albi se prescritta" senza nominare né il registro
né la legge. Il modello rappresenta ciascuno di questi casi come dato.

## Avvio

Richiede Node 20.18.

```
npm install
npm run dev        # sviluppo
npm run build      # produzione, in dist/
npm run test       # motore + interfaccia (Vitest, 360+ test)
npm run lint
npm run esito:atteso    # rigenera l'esito atteso della gara reale dal motore
```

Nessun backend e nessuna persistenza. Nessun servizio esterno, nessun dato che
lascia il browser: i documenti sono caricati dallo stesso server che serve la
pagina, e la valutazione gira tutta nel browser.

## La tesi

**Il motore non conosce il diritto degli appalti.** Ogni requisito porta con sé
due dati letti dal disciplinare — le *letture* (quali fatti del fascicolo lo
soddisfano, una o più se il testo ammette più letture) e la *regola di
composizione* (come quei fatti si compongono tra più soggetti: ciascun membro,
somma dei membri, chi esegue una prestazione, almeno un membro — o *non
dichiarata*, se il documento tace). Il motore applica quattro operatori a quei
dati. Nessuna soglia, finestra, minimo per ruolo o avvalibilità è scritta nel
codice: arrivano dal disciplinare come dati, e la famiglia del requisito è
puramente descrittiva.

Tre stati, non due: `coperto`, `scoperto`, `da_verificare`. Il terzo non è un
giallo decorativo: è il motore che dichiara di non poter decidere, e dice
perché in un elenco di **indeterminatezze** con due famiglie dentro. Il
*documento* non lo dice — regola non dichiarata, criterio non determinato,
letture discordanti, valore contraddittorio — e allora si chiedono chiarimenti
alla stazione appaltante, entro il termine del bando. Oppure serve un
*giudizio* — uno scope, un'attività, un CPV che non coincidono — e allora
decide chi può: la stazione appaltante, se il dubbio è su cosa significa il
suo documento (e il quesito la interpella per nome); il concorrente, se il
dubbio è su cosa c'è nel suo fascicolo. Un requisito può averle entrambe:
sulla gara reale la certificazione ISO le ha tutte e due.

## Cosa fa

- **Valuta un raggruppamento contro un lotto**: verdetto (ammissibile, con
  riserva, non ammissibile), una riga per requisito con il contributo reale di
  ogni membro, il delta, la motivazione in italiano, le fonti.
- **Distingue "non possiede" da "possiede ma non conta qui"**: chi ha una
  certificazione senza eseguire la prestazione non è una mancanza.
- **Soglie per rinvio e valori contraddittori**: una soglia può rinviare per
  nome a un valore del bando, e un valore può avere più candidati, ciascuno
  con la propria fonte. Il motore valuta sotto ciascuno: esiti uguali → l'esito
  vale, mostrando la misurazione peggiore; esiti diversi → da verificare, con
  cosa succede sotto ogni lettura.
- **Letture alternative di un requisito**: "importo non inferiore alla base
  d'asta" per un solo contratto o per la somma. Stesso meccanismo.
- **Ancoraggio non dichiarato**: "nell'ultimo triennio" senza dies a quo si
  ancora al termine di presentazione, dichiarato come assunzione, con i giorni
  di arretramento che cambierebbero l'esito, ricavati dai dati.
- **Avvalimento**: le ausiliarie integrano il fascicolo di un membro specifico,
  solo per i requisiti indicati e solo se il disciplinare li dichiara avvalibili.
- **Anomalie come dati, non eccezioni**: mandataria assente, quote che non
  tornano, riferimenti inesistenti, rinvii a valori che il bando non nomina,
  ancoraggio a una data che il bando non scrive. Le bloccanti forzano il
  verdetto; le segnalazioni no.
- **Avvisi di scadenza**: documenti validi oggi che scadono prima del termine di
  presentazione o entro un orizzonte, distinti dalle scoperture.
- **Rimedi verificati**: un rimedio è proposto solo se, applicato a una copia
  dell'input, la rivalutazione lo conferma. La **richiesta di chiarimenti** è
  l'eccezione: non cambia i dati, ma dice se il termine per chiederli è già
  decorso, e allora l'ambiguità resta a rischio del concorrente.
- **Percorso minimo**: la sequenza più breve di mosse che porta ad
  ammissibile; se irraggiungibile, a con riserva, dichiarando cosa resta. E
  quando il massimo è già raggiunto ma una mossa toglie un'incertezza, lo dice:
  il percorso non deve sembrare inerte.
- **Confronti**: lo stesso raggruppamento su ogni lotto; la composizione attuale
  contro quella prima dell'ultima prova.
- **Prova, non applica**: ogni mossa si prova sul foglio di lavoro come modifica
  annullabile, con un'etichetta onesta nella storia.

## Cosa non fa

Sui requisiti generali verifica che la dichiarazione esista, non che sia vera.
Non giudica equivalenze. Non modella la certificazione del produttore né quella
in corso di rilascio, le imprese con meno di un anno di attività, i consorzi
come entità, le reti e i GEIE, la garanzia provvisoria e le sue riduzioni, la
comprova tramite FVOE, l'offerta tecnica, gli adempimenti (DGUE, PASSOE,
contributo ANAC, registrazione alla piattaforma, self cleaning, divieto di
partecipazione plurima). Non tratta il subappalto. Non legge il PDF del
disciplinare: i requisiti arrivano già strutturati. Non sostituisce la lettura
del documento. La pagina lo dichiara in fondo, con la fonte di ogni voce.

## Struttura

```
src/domain.ts          il contratto: tipi del dominio, unioni discriminate;
                       ogni variante cita il caso del disciplinare che l'ha imposta
src/engine/            motore puro: varianti (letture × candidati), criteri,
                       operatori, validazione, verdetto, scadenze, rimedi,
                       percorso, confronto
public/documenti/      bandi e fascicoli in JSON, con l'indice
src/documenti/         caricamento e controllo di struttura dei documenti,
                       tipizzato contro il modello
src/engine/esito-atteso-asl-roma-6.json
                       l'esito della gara reale, GENERATO dal motore
src/lavoro.ts          il foglio di lavoro: reducer puro con storia annullabile
src/descrizioni.ts     testo dagli identificativi
src/formato.ts         euro, date, percentuali in formato italiano
src/ui/                componenti React, solo token CSS
src/tokens.css         i token del brand (placeholder), unico posto con valori fissi
```

Il motore è una funzione pura `valuta(parametri) → Esito`: nessun I/O, nessuna
data implicita, nessuna mutazione. La data di riferimento è un parametro, e
spostandola si vede un certificato scadere, o un termine per i chiarimenti
decorrere.

## Assunzioni dichiarate

Quattro regole sono del motore e non del disciplinare, e l'esito le espone per
codice così che l'interfaccia le raccolga in una legenda:

- **Arrotondamento per eccesso dei minimi per ruolo**: "40 % di 3 referenze =
  1,2, quindi almeno 2". Si sbaglia dalla parte che costa meno.
- **Classe CPV**: un servizio il cui CPV non condivide le prime *n* cifre con
  quello di gara non è analogo e non conta; *n* è un dato del criterio.
- **Ancoraggio al termine di presentazione**: una finestra "a ritroso" senza
  dies a quo dichiarato parte dall'unica data certa del bando. La nota dice di
  quanto potrebbe arretrare senza cambiare chi conta. Si vede sulle forniture
  analoghe della gara reale.
- **Esito concordante**: con letture o candidati diversi nel testo ma
  concordanti nell'esito, l'esito vale anche se il documento è ambiguo; dove
  i numeri differiscono si mostra la lettura peggiore. Si vede sulle forniture
  analoghe della gara reale.

## Test

Il motore è puro e si testa interamente senza infrastruttura: ogni operatore,
ogni codice di anomalia, lo stesso fascicolo a due date, il percorso a una, due
e nessuna mossa, l'equivalenza della ricerca con e senza il limite teorico, la
purezza di `valuta`, e un test per ogni caso del disciplinare reale: regola non
dichiarata, criterio non determinato, tre candidati per una soglia, due
letture, ancoraggio assunto, termine dei chiarimenti prima e dopo, costo del
memo. L'interfaccia si testa nel comportamento con Testing Library e
`user-event`: niente snapshot.
