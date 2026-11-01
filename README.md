# ANTEU Lab

Simulator open source de **democrație lichidă**: vot direct sau delegare reversibilă, **recall nativ** al mandatelor și un **registru verificabil** pe care oricine îl poate audita.

Este un prototip de învățare, pornit de la [Carta albă ANTEU 2027](https://anteu.open4.education/docs/carta-alba.pdf). Nu este o platformă de vot reală. Scopul lui este să facă vizibile, într-o comunitate mică, mecanismele pe care Carta le propune la scară mare și tensiunile dintre ele.

**Autor:** David Găvrișan, student în anul I la Relații Internaționale, Facultatea de Studii Europene, UBB Cluj.

**Demo:** https://democratie-lichida.netlify.app/

## Ce poți face

- **Turul ghidat** (cam două minute) parcurge totul pas cu pas: simulatorul face singur fiecare acțiune și explică efectul ei. E cel mai rapid mod de a înțelege proiectul.
- **Alegi cine ești** dintre cei 10 membri ai comunității și vezi simularea prin ochii lor.
- **Votul tău:** la fiecare propunere votezi singur sau lași pe cineva în care ai încredere să decidă („Am încredere în Ana pentru toată tema Educație”). Vezi traseul votului tău (Tu → Bogdan → Ana → Pentru) și poți retrage oricând votul sau delegarea.
- **Încredere și mandate:** un graf arată cine are încredere în cine pe fiecare temă. Scenariile „Ce s-ar întâmpla dacă…” arată zona-tampon și recall-ul în acțiune, iar regulile comunității (pragul și zona-tampon) se pot schimba.
- **Registrul:** verifici registrul, încerci să trișezi schimbând un vot și vezi ce anume te prinde.
- Termenii mai tehnici (delegare, mandat, zonă-tampon, recall, sigiliu, chitanță) au o explicație simplă la clic.

## Legătura cu Carta albă

| Concept din Carta albă | Cum apare în simulator | Ce lipsește față de Cartă |
|---|---|---|
| Delegare punctuală, sectorială sau totală, reversibilă instantaneu (5.1) | Trei tipuri de delegare, cu prioritate punctual > temă > total; votul direct le anulează | Vot preferențial Condorcet/Schulze, ca în LiquidFeedback |
| Recall nativ cu prag și zonă-tampon (5.2) | Mandat acordat la prag, retras sub *prag minus zonă-tampon*, fără referendum | Mandate „conjuncturale” cu efecte în afara platformei (5.4) |
| Registru imuabil, auditabil public (stratul 3) | Jurnal append-only înlănțuit prin SHA-256; starea e recalculată mereu din jurnal | Blockchain permisionat, noduri universitare reale, IPFS |
| „Trustless trust”: cetățenii verifică, nu cred | Audit complet: lanț de hash-uri + reconstituirea fiecărei decizii de mandat din reguli; chitanțe pentru votanți | Probe criptografice independente de interfață |
| Identitate electronică (CIE, eIDAS 2.0, EUDI Wallet) | Nu există: alegi pur și simplu „ca cine acționezi” | Tot stratul de identitate și semnătură calificată |
| Anonimizarea votului (zk-STARKs) | Nu există: voturile sunt vizibile în registru | Vezi secțiunea despre tensiuni |
| AI civic | Nu există | Rezumate, detectarea polarizării |

## Regulile, precis

**Rezolvarea votului.** Pentru o propunere, se urmărește lanțul fiecărui participant: dacă a votat direct, votul lui contează. Altfel, se aplică delegarea cea mai specifică (punctuală, apoi pe temă, apoi totală) și se continuă la delegat. Lanțul se poate termina în trei feluri:

- la cineva care a votat: votul contează cu opțiunea acelei persoane;
- la cineva care nici nu a votat, nici nu a delegat: votul rămâne neatribuit;
- într-o buclă (A deleagă la B, B la A): votul rămâne neatribuit, iar bucla e marcată pe graf.

**Sprijinul pe o temă** al unei persoane este numărul celorlalți participanți ale căror lanțuri de delegare pe acea temă trec prin ea, direct sau tranzitiv.

**Recall nativ, cu histerezis.** Cu prag *P* și zonă-tampon *Z*:

- mandatul se **acordă** când sprijinul ajunge la cel puțin *P*% din comunitate;
- mandatul se **retrage** când sprijinul scade sub *(P − Z)*%;
- între cele două valori, nu se schimbă nimic.

Fără zona-tampon, un singur om care își mută delegarea ar putea face un mandat să apară și să dispară la fiecare acțiune. Calculele folosesc numere întregi, ca 20% din 10 oameni să fie exact 2.

## Cum e construit

```
src/engine/   logica, fără nicio dependență de interfață
  ledger.js     registrul înlănțuit prin SHA-256, verificare, chitanțe
  delegation.js rezolvarea lanțurilor, rezultate ponderate, sprijin pe teme
  recall.js     regula de mandat cu prag și zonă-tampon
  state.js      reducer, commit, audit (event sourcing)
  seed.js       scenariul demonstrativ, construit tot prin registru
src/components/ interfața React (secțiunile, graful, turul ghidat)
src/ui/         texte: glosarul, pașii turului, formulări
tests/          15 teste pentru motor (node:test)
```

Decizia principală de arhitectură este **event sourcing**: starea aplicației nu e salvată nicăieri. Ea e recalculată de fiecare dată din registru. Consecințe:

- Oricine are o copie a registrului poate recalcula singur rezultatele și mandatele.
- Deciziile contractului civic sunt și ele intrări în registru. Auditul verifică că fiecare a fost cerută de reguli: un recall adăugat, șters sau modificat de mână e detectat, chiar dacă lanțul de hash-uri a fost refăcut.
- Acțiunile care încalcă regulile (de exemplu, să-ți delegi votul ție însuți) sunt respinse înainte să ajungă în registru.

## Ce arată demonstrația de atac

1. **Modifici un vot** direct în registru: hash-ul intrării nu mai corespunde, iar auditul indică exact intrarea alterată.
2. **Modifici un vot și recalculezi toate hash-urile**: lanțul devine din nou consistent și auditul trece. Ce te prinde este **chitanța** primită de votant la vot, care nu se mai regăsește în registru.

Lecția: un lanț de hash-uri singur nu garantează nimic dacă cel care îl ține îl poate rescrie integral. Garanția vine din **copii independente**. Carta albă propune ca acestea să fie ținute de noduri universitare. Exact aceasta a fost slăbiciunea platformei Rousseau a Mișcării 5 Stele: o infrastructură centralizată, pe care nimeni din afară nu o putea verifica.

## Tensiuni pe care prototipul le face vizibile

**Anonimat versus verificabilitate.** Carta cere vot anonim și, în același timp, delegări vizibile și recall automat. Delegarea însă e o relație între două persoane: dacă A deleagă la B, iar B votează public, votul lui A devine previzibil. Un sistem real trebuie să decidă ce rămâne secret (votul final?) și ce rămâne public (delegările? doar sprijinul agregat?). Aici, totul e public, tocmai ca problema să se vadă.

**Concentrarea influenței.** Delegarea tranzitivă poate aduna multe voturi la câțiva oameni. În scenariul demonstrativ, Ana poartă 4 din 10 voturi pe o propunere despre educație, deși doar două persoane au ales-o direct. Carta numește asta „meritocrație civică”. Merită discutat dacă e nevoie de limite: un plafon de voturi purtate, o adâncime maximă a lanțului sau delegări care expiră.

**Cine stabilește pragul.** Pragul și zona-tampon decid cine are mandat. În simulator, schimbarea lor e și ea o intrare în registru, deci e vizibilă și auditabilă. Rămâne întrebarea politică: cine are dreptul să le schimbe și prin ce procedură.

**Voturi pierdute în tăcere.** Un participant care a delegat poate crede că a votat, deși votul lui s-a oprit la un delegat care n-a votat. Simulatorul îi spune explicit unde a ajuns votul. O platformă reală ar trebui să-l și anunțe.

## Rulare locală

Ai nevoie de Node.js 18 sau mai nou.

```bash
npm install
npm run dev     # pornește aplicația la http://localhost:5173
npm test        # rulează testele motorului
npm run build   # versiunea de producție, în dist/
```

**Publicare pe Netlify:** conectează repo-ul. Setările sunt deja în `netlify.toml` (comanda `npm run build`, directorul `dist`).

## Pași următori posibili

- Vot preferențial Schulze pentru propuneri cu mai multe variante, ca în LiquidFeedback.
- Votul înregistrat ca angajament criptografic (commitment), cu dezvăluire ulterioară, ca pas spre anonimat.
- Mai multe copii ale registrului, ținute de „noduri” separate, care se verifică reciproc.
- Expirarea delegărilor și un plafon pentru voturile purtate de o singură persoană.

## Licență

MIT
