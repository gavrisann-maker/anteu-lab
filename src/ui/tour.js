// Guided tour: each step may switch section, person or topic, perform one action,
// and point at the part of the page where the effect is visible.

const mediu = { kind: 'sector', topic: 'mediu' };

export const TOUR = [
  {
    tab: 'vote',
    actor: 'mihai',
    title: 'Bun venit',
    text: 'Ești Mihai, unul dintre cei 10 membri ai unei comunități de studenți care decide asupra a trei propuneri. Turul îți arată, pas cu pas, ce se întâmplă cu votul tău. La fiecare pas simulatorul face singur acțiunea, iar tu urmărești efectul.',
  },
  {
    tab: 'vote',
    focus: 'card-p1',
    title: 'Votul lui Mihai se pierde',
    text: 'La propunerea despre bibliotecă, Mihai nu a votat și nu a lăsat pe nimeni să decidă pentru el. Uită-te la „Votul tău”: deocamdată vocea lui nu contează.',
  },
  {
    tab: 'vote',
    focus: 'card-p1',
    title: 'Mihai are încredere în Ana',
    text: 'Mihai nu are timp să citească toate propunerile despre educație, dar are încredere în Ana. Își lasă votul la ea pentru toată tema. Ana a votat „Pentru”, așa că acum și votul lui Mihai contează ca „Pentru”.',
    run: (api) => api.act('delegare_setata', { from: 'mihai', to: 'ana', scope: { kind: 'sector', topic: 'educatie' } }, 'mihai'),
  },
  {
    tab: 'vote',
    focus: 'card-p1',
    title: 'Mihai se răzgândește',
    text: 'La bibliotecă, Mihai are totuși o părere proprie și votează singur „Împotrivă”. Votul direct are mereu prioritate. La alte propuneri despre educație, Ana ar decide în continuare pentru el.',
    run: (api) => api.act('vot_exprimat', { proposalId: 'p1', voter: 'mihai', choice: 'impotriva' }, 'mihai'),
  },
  {
    tab: 'trust',
    topic: 'educatie',
    focus: 'graph',
    title: 'Fluxurile de încredere',
    text: 'Fiecare săgeată arată cine are încredere în cine pe educație. Ana adună încrederea a 4 oameni: Bogdan, Cristina, Mihai și Dan, care ajunge la ea prin Bogdan. Trece de pragul de 20%, așa că are mandat: cercul violet.',
  },
  {
    tab: 'trust',
    topic: 'mediu',
    focus: 'mandates',
    title: 'Mandatul lui Florin',
    text: 'Pe mediu, Elena și Gabriela au încredere în Florin. Asta înseamnă 2 din 10 oameni, exact pragul de 20%, deci Florin are mandat.',
  },
  {
    tab: 'trust',
    topic: 'mediu',
    focus: 'mandates',
    title: 'O scădere mică',
    text: 'Gabriela nu mai are încredere în lanțul care duce la Florin. El coboară la 10%, sub prag, dar nu sub zona-tampon, așa că își păstrează mandatul. Fără această marjă, mandatele s-ar schimba la fiecare mică supărare.',
    run: (api) => api.act('delegare_retrasa', { from: 'gabriela', scope: mediu }, 'gabriela'),
  },
  {
    tab: 'trust',
    topic: 'mediu',
    focus: 'mandates',
    title: 'Recall automat',
    text: 'Acum pleacă și Elena. Florin rămâne fără susținători, iar contractul civic îi retrage mandatul imediat, fără referendum și fără campanie. Acesta este recall-ul nativ propus în Carta albă ANTEU.',
    run: (api) => api.act('delegare_retrasa', { from: 'elena', scope: mediu }, 'elena'),
  },
  {
    tab: 'ledger',
    focus: 'audit-box',
    title: 'Totul e scris în registru',
    text: 'Fiecare vot, delegare și mandat de până acum e o pagină sigilată în registru. Verificarea confirmă că nicio pagină nu a fost modificată.',
    run: (api) => api.audit(),
  },
  {
    tab: 'ledger',
    focus: 'audit-box',
    title: 'Un atac reușit?',
    text: 'Cineva cu acces la baza de date schimbă votul Anei și reface toate sigiliile, ca să nu se observe. Verificarea trece! Doar uitându-te la registru, frauda nu se vede.',
    run: async (api) => {
      await api.tamper(true);
      await api.audit();
    },
  },
  {
    tab: 'ledger',
    actor: 'ana',
    focus: 'receipts-box',
    title: 'Chitanța o prinde',
    text: 'Ana și-a păstrat chitanța de la vot. Ea nu se mai găsește în registrul rescris, deci frauda iese la iveală. De aceea Carta albă propune ca registrul să aibă copii ținute de universități independente.',
    run: (api) => api.checkReceipts('ana'),
  },
  {
    tab: 'vote',
    actor: 'mihai',
    title: 'Acum e rândul tău',
    text: 'Ai văzut tot ce face simulatorul. Scenariul a pornit din nou de la zero. Alege orice persoană, votează, deleagă și urmărește ce se schimbă.',
    last: true,
    run: (api) => api.reset(),
  },
];
