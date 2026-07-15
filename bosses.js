// FallKard · shared boss cast · campaign + duel both load this
window.BOSSES = [
  // Chapter I · Colony
  { id:'thread-imp', name:'Thread Imp', chapter:1, chamber:'colony', tier:'minor', hp:16, portrait:'ℹ', ability:'Ping Cascade · +1 draw t3', lore:'A single ping. Then two. Then ten.', deckRule:{kinds:['mcp','api'],chambers:['reach','colony']}, unlock:[], drops:{shards:1,runes:['El'],cardTier:'magic'} },
  { id:'notif-wraith', name:'Notification Wraith', chapter:1, chamber:'colony', tier:'minor', hp:20, portrait:'◑', ability:'Attention Drain · -1 mana t4 if hand full', lore:'It thrives when your focus scatters.', deckRule:{kinds:['api','mcp'],chambers:['reach','bridge']}, unlock:['thread-imp'], drops:{shards:2,runes:['El','Eld'],cardTier:'magic'} },
  { id:'slack-fiend', name:'Slack Fiend', chapter:1, chamber:'colony', tier:'lord', hp:26, portrait:'☠', ability:'Notification Cascade · +1 card/turn from t5', lore:'The corrupt god of shattered attention. Cut its threads or drown in them.', deckRule:{kinds:['mcp','api'],chambers:['reach','bridge','colony']}, unlock:['thread-imp','notif-wraith'], drops:{shards:4,runes:['Tir'],cardTier:'rare',charm:'colony-banner'} },
  // Chapter II · Studio
  { id:'draft-goblin', name:'Draft Goblin', chapter:2, chamber:'studio', tier:'minor', hp:18, portrait:'✎', ability:'Sketch · Steals 1 cost from your next play', lore:'Half-written. Never shipped.', deckRule:{kinds:['sdk','tool'],chambers:['studio','forge']}, unlock:['slack-fiend'], drops:{shards:2,runes:['Eld'],cardTier:'magic'} },
  { id:'canvas-hollow', name:'Canvas Hollow', chapter:2, chamber:'studio', tier:'minor', hp:22, portrait:'◇', ability:'Blank Slate · Discards a drawn card at 50%', lore:'The empty page eats intention.', deckRule:{kinds:['tool','sdk'],chambers:['studio']}, unlock:['draft-goblin'], drops:{shards:2,runes:['Eld','Tir'],cardTier:'magic'} },
  { id:'notion-lich', name:'Notion Lich', chapter:2, chamber:'studio', tier:'lord', hp:30, portrait:'☩', ability:'Nested Curse · every 3 turns your minion -1/-1', lore:'Every doc a tomb. Every page a chain.', deckRule:{kinds:['mcp','tool','sdk'],chambers:['studio','forge']}, unlock:['draft-goblin','canvas-hollow'], drops:{shards:5,runes:['Ith'],cardTier:'rare',charm:'studio-brush'} },
  // Chapter III · Market
  { id:'lead-imp', name:'Lead Imp', chapter:3, chamber:'market', tier:'minor', hp:20, portrait:'$', ability:'Cold Call · deals 1 to random minion', lore:'It knew your name once.', deckRule:{kinds:['api','tool'],chambers:['market','reach']}, unlock:['notion-lich'], drops:{shards:2,runes:['Ith'],cardTier:'magic'} },
  { id:'quota-shade', name:'Quota Shade', chapter:3, chamber:'market', tier:'minor', hp:24, portrait:'☯', ability:'Pipeline · +1 ATK each turn a card sits in your hand', lore:'It grows fat on deferred plays.', deckRule:{kinds:['tool','sdk'],chambers:['market']}, unlock:['lead-imp'], drops:{shards:3,runes:['Ith','Nef'],cardTier:'magic'} },
  { id:'salesforce-wyrm', name:'Salesforce Wyrm', chapter:3, chamber:'market', tier:'lord', hp:32, portrait:'☾', ability:'Cloud Assault · t7 its minions +2/+2', lore:'The great wyrm coiled in a hundred subscriptions.', deckRule:{kinds:['api','mcp','tool'],chambers:['market','bridge','reach']}, unlock:['lead-imp','quota-shade'], drops:{shards:6,runes:['Nef'],cardTier:'rare',charm:'merchant-coin'} },
  // Chapter IV · Reach
  { id:'ad-mite', name:'Ad Mite', chapter:4, chamber:'reach', tier:'minor', hp:18, portrait:'◙', ability:'Retarget · copies your last-played minion once', lore:'It shows you what you already saw.', deckRule:{kinds:['api','tool'],chambers:['reach','market']}, unlock:['salesforce-wyrm'], drops:{shards:3,runes:['Nef'],cardTier:'magic'} },
  { id:'metric-shade', name:'Metric Shade', chapter:4, chamber:'reach', tier:'minor', hp:22, portrait:'◊', ability:'Vanity Reflection · 5+ ATK minion takes 2 self', lore:'What gets measured gets bled.', deckRule:{kinds:['api','sdk'],chambers:['reach','studio']}, unlock:['ad-mite'], drops:{shards:3,runes:['Nef','Sol'],cardTier:'magic'} },
  { id:'zoom-basilisk', name:'Zoom Basilisk', chapter:4, chamber:'reach', tier:'lord', hp:30, portrait:'◉', ability:'Screen Freeze · locks a random own minion each turn from t5', lore:'It sees you. It always sees you.', deckRule:{kinds:['api','mcp'],chambers:['reach','bridge']}, unlock:['ad-mite','metric-shade'], drops:{shards:7,runes:['Sol'],cardTier:'rare',charm:'reach-lens'} },
  // Chapter V · Bridge
  { id:'daemon-worm', name:'Daemon Worm', chapter:5, chamber:'bridge', tier:'minor', hp:20, portrait:'⚙', ability:'Runtime Loop · attacks twice if survived', lore:'It runs even when you stop it.', deckRule:{kinds:['sdk','mcp'],chambers:['forge','bridge']}, unlock:['zoom-basilisk'], drops:{shards:3,runes:['Sol'],cardTier:'magic'} },
  { id:'orchestration-imp', name:'Orchestration Imp', chapter:5, chamber:'bridge', tier:'minor', hp:24, portrait:'⚘', ability:'Chain Trigger · on kill plays a free 3-cost card from deck', lore:'Every tool moves the next. Wrong way.', deckRule:{kinds:['mcp','api','sdk'],chambers:['bridge']}, unlock:['daemon-worm'], drops:{shards:4,runes:['Sol','Um'],cardTier:'magic'} },
  { id:'aws-behemoth', name:'AWS Behemoth', chapter:5, chamber:'bridge', tier:'lord', hp:36, portrait:'⬢', ability:'Cloud Bill · deals 3 to you every 3rd turn', lore:'Vast. Distributed. Uncounted.', deckRule:{kinds:['api','mcp','sdk'],chambers:['bridge','forge']}, unlock:['daemon-worm','orchestration-imp'], drops:{shards:8,runes:['Um'],cardTier:'rare',charm:'bridge-key'} },
  // Chapter VI · Forge
  { id:'ci-imp', name:'CI Imp', chapter:6, chamber:'forge', tier:'minor', hp:16, portrait:'☒', ability:'Flaky Test · 25% your played minion enters silenced', lore:'Sometimes it passes. Sometimes not.', deckRule:{kinds:['sdk','tool'],chambers:['forge']}, unlock:['aws-behemoth'], drops:{shards:3,runes:['Um'],cardTier:'magic'} },
  { id:'lock-hydra', name:'Lockfile Hydra', chapter:6, chamber:'forge', tier:'minor', hp:24, portrait:'⚹', ability:'Cascade Update · minions +0/+2 per turn', lore:'You changed one. It broke ten thousand.', deckRule:{kinds:['sdk','api'],chambers:['forge','bridge']}, unlock:['ci-imp'], drops:{shards:4,runes:['Um','Ohm'],cardTier:'magic'} },
  { id:'docker-hydra', name:'Docker Hydra', chapter:6, chamber:'forge', tier:'lord', hp:30, portrait:'⬣', ability:'Container Split · on head death spawns 2/2 in lane', lore:'Kill one head. Two more rise.', deckRule:{kinds:['mcp','sdk'],chambers:['forge','bridge']}, unlock:['ci-imp','lock-hydra'], drops:{shards:9,runes:['Ohm'],cardTier:'rare',charm:'forge-hammer'} },
  // Chapter VII · Vault
  { id:'debit-mote', name:'Debit Mote', chapter:7, chamber:'vault', tier:'minor', hp:18, portrait:'◈', ability:'Micro-Charge · deals 1 to you per card drawn', lore:'A single fee. A thousand times.', deckRule:{kinds:['api','tool'],chambers:['vault','market']}, unlock:['docker-hydra'], drops:{shards:4,runes:['Ohm'],cardTier:'magic'} },
  { id:'reconcile-shade', name:'Reconciliation Shade', chapter:7, chamber:'vault', tier:'minor', hp:22, portrait:'◇', ability:'Ledger Rot · t6 lose 1 random rune', lore:'It counts the coin you never held.', deckRule:{kinds:['api','sdk'],chambers:['vault']}, unlock:['debit-mote'], drops:{shards:5,runes:['Ohm','Zod'],cardTier:'magic'} },
  { id:'stripe-chimera', name:'Stripe Chimera', chapter:7, chamber:'vault', tier:'lord', hp:32, portrait:'§', ability:'Interchange · minions steal 1 mana on ETB', lore:'The horns are the fees. The tail is the chargeback.', deckRule:{kinds:['api','mcp'],chambers:['vault','market']}, unlock:['debit-mote','reconcile-shade'], drops:{shards:10,runes:['Zod'],cardTier:'rare',charm:'vault-seal'} },
  // Chapter VIII · Estate
  { id:'boilerplate-imp', name:'Boilerplate Imp', chapter:8, chamber:'estate', tier:'minor', hp:20, portrait:'§', ability:'Fine Print · Trade keyword silenced this match', lore:'Read every clause. Slowly.', deckRule:{kinds:['tool','sdk'],chambers:['estate']}, unlock:['stripe-chimera'], drops:{shards:4,runes:['Zod','El'],cardTier:'magic'} },
  { id:'redaction-wraith', name:'Redaction Wraith', chapter:8, chamber:'estate', tier:'minor', hp:24, portrait:'◘', ability:'Blackout · top-deck card hidden until played', lore:'What you cannot see cannot help you.', deckRule:{kinds:['api','tool'],chambers:['estate','vault']}, unlock:['boilerplate-imp'], drops:{shards:5,runes:['Zod','Eld'],cardTier:'magic'} },
  { id:'contract-lich', name:'The Contract Lich', chapter:8, chamber:'estate', tier:'lord', hp:34, portrait:'☩', ability:'Binding Terms · locks 1 played minion in place per turn', lore:'It signs in ink that never dries.', deckRule:{kinds:['tool','api','mcp'],chambers:['estate','vault']}, unlock:['boilerplate-imp','redaction-wraith'], drops:{shards:11,runes:['Zod'],cardTier:'rare',charm:'estate-quill'} },
  // Chapter IX · Clinic
  { id:'burnout-imp', name:'Burnout Imp', chapter:9, chamber:'clinic', tier:'minor', hp:22, portrait:'✕', ability:'Fatigue · your hero drops 1 HP at your turn end', lore:'It offers rest. Gives none.', deckRule:{kinds:['api','tool'],chambers:['clinic']}, unlock:['contract-lich'], drops:{shards:5,runes:['Um','Ohm'],cardTier:'magic'} },
  { id:'metric-parasite', name:'Metric Parasite', chapter:9, chamber:'clinic', tier:'minor', hp:26, portrait:'◑', ability:'Health Snapshot · deals your HP loss back at t6', lore:'It measures what you feel.', deckRule:{kinds:['api','sdk'],chambers:['clinic','vault']}, unlock:['burnout-imp'], drops:{shards:6,runes:['Sol','Um'],cardTier:'magic'} },
  { id:'wellness-vulture', name:'The Wellness Vulture', chapter:9, chamber:'clinic', tier:'lord', hp:34, portrait:'☬', ability:'Prescription Cascade · consumes 1 shard/turn from t4', lore:'It sells you the cure to the wound it opened.', deckRule:{kinds:['api','tool','sdk'],chambers:['clinic','market']}, unlock:['burnout-imp','metric-parasite'], drops:{shards:12,runes:['Zod'],cardTier:'rare',charm:'clinic-mirror'} },
  // Chapter X · Uber
  { id:'ad-godling', name:'The Ad-Godling', chapter:10, chamber:'reach', tier:'uber', hp:44, portrait:'∆', ability:'Autoplay · plays random 4-cost from your deck vs you every 3 turns', lore:'"Skip Ad" was a lie.', deckRule:{kinds:['api','tool'],chambers:['reach','market']}, unlock:['zoom-basilisk','wellness-vulture'], drops:{shards:18,runes:['Zod','Zod'],cardTier:'unique',charm:'ad-godling-relic'} },
  { id:'saas-emperor', name:'The SaaS Emperor', chapter:10, chamber:'bridge', tier:'uber', hp:52, portrait:'♛', ability:'Vendor Lock · every socketed rune -1 rune/turn', lore:'"All-in-one." All-in-you.', deckRule:{kinds:['api','mcp','sdk','tool'],chambers:['bridge','market','vault']}, unlock:['aws-behemoth','stripe-chimera','contract-lich'], drops:{shards:25,runes:['Zod','Zod','Zod'],cardTier:'uber-unique',charm:'emperor-crown'} },
  { id:'metric-wraith', name:'The Metric Wraith · Uber', chapter:10, chamber:'reach', tier:'uber', hp:48, portrait:'⬢', ability:'Impression Storm · +1 minion to enemy back per card you draw', lore:'It has always been watching. Now it strikes back.', deckRule:{kinds:['api','tool'],chambers:['reach','studio']}, unlock:['ad-godling'], drops:{shards:20,runes:['Zod','Zod'],cardTier:'unique',charm:'metric-wraith-eye'} }
];

window.CHAPTERS = [
  { n:1, name:'Colony', sub:'The Chamber of Broken Focus', chamber:'colony', color:'#e8a83a' },
  { n:2, name:'Studio', sub:'The Chamber of the Empty Page', chamber:'studio', color:'#9a6dbf' },
  { n:3, name:'Market', sub:'The Chamber of the False Bid', chamber:'market', color:'#d4a017' },
  { n:4, name:'Reach', sub:'The Chamber of the Endless Ping', chamber:'reach', color:'#4a9d8f' },
  { n:5, name:'Bridge', sub:'The Chamber of the Broken Chain', chamber:'bridge', color:'#7ab88a' },
  { n:6, name:'Forge', sub:'The Chamber of the Failed Build', chamber:'forge', color:'#c46a2e' },
  { n:7, name:'Vault', sub:'The Chamber of the Silent Ledger', chamber:'vault', color:'#3f3d4a' },
  { n:8, name:'Estate', sub:'The Chamber of the Bound Word', chamber:'estate', color:'#c4bfb2' },
  { n:9, name:'Clinic', sub:'The Chamber of the Hollow Mirror', chamber:'clinic', color:'#e6846e' },
  { n:10, name:'Uber Rounds', sub:'The World Beneath Rises', chamber:null, color:'#e6846e' }
];

window.LIA_LINES = {
  intro:    '"The Fall waits for no one. The Ancient Architect walked these plains long ago and shaped what still stands. The SaaS-god\'s remnants remember him. They fear him. He departed. You are what remains. Pick a chamber. Cut the threads."',
  earlyWin: '"You have cleared the first minions. The chambers are noticing. Watch your hand — the Fiend\'s cascade builds every turn."',
  firstLord:'"You have taken your first Chamber Lord. The chamber banner rises. A rune has dropped from the world beneath. Take it to the Loom or the Cube."',
  midMarch: '"The Fall grows quieter with each cut. Do not mistake it for peace. The Ubers wait beyond the ninth chamber. They wrote your name in the ledger."',
  fiveDown: '"Five chambers cleared. The Ad-Godling stirs. It has begun."',
  emperor:  '"The Emperor sits above them all. It signed every contract you thought was yours. It cannot be talked to. Only cut."',
  boss:     ['"Every ping is a wound. Cut fast."',
             '"The lich remembers you. Play carefully."',
             '"The wyrm is coiled. Do not linger in one lane."',
             '"You are on screen. Cut before you fade."',
             '"The behemoth pays no bills. It sends them."',
             '"The hydra bites in ten places."',
             '"The chimera hunts your ledger."',
             '"Every clause is a chain. Break them."',
             '"The vulture waits for the wound."',
             '"The Godling never sleeps."',
             '"The Emperor sees every socket."'],
  win:      ['"The threads snap silent."',
             '"The page falls blank."',
             '"The wyrm withers to coin."',
             '"The screen goes dark."',
             '"The bill goes unpaid."',
             '"The heads stop growing."',
             '"The ledger closes."',
             '"The clause dissolves."',
             '"The vulture stills."',
             '"The Godling sleeps."',
             '"The Emperor kneels."'],
  loss:     '"The chamber holds. Try again — the Fall does not forget."'
};

// ────────── Runes + Runewords · reference · manifest.json is source-of-truth
window.RUNES = ['El','Eld','Tir','Ith','Nef','Sol','Um','Ohm','Zod'];
window.RUNE_TIER = { El:1, Eld:1, Tir:2, Ith:2, Nef:3, Sol:4, Um:5, Ohm:6, Zod:8 };
window.RUNE_SIGIL = { El:'⟁', Eld:'⟐', Tir:'⟢', Ith:'△', Nef:'▽', Sol:'◇', Um:'⬡', Ohm:'⬢', Zod:'⟡' };
window.RUNE_EFFECT = {
  El:  '+1 ATK',
  Eld: '+1 HP',
  Tir: 'on-play gain 1 mana crystal',
  Ith: 'on-play draw 1',
  Nef: 'on death return to hand',
  Sol: 'immune to silence',
  Um:  'adjacent friendly +1/+1',
  Ohm: 'on play destroy an enemy minion',
  Zod: 'indestructible'
};
window.RUNEWORDS = [
  { name:'Steel',            recipe:['Tir','El'],           effect:'+1 ATK · on-play gain 1 mana' },
  { name:'Malice',           recipe:['Ith','El','Eld'],     effect:'+1/+1 · on-play draw 1' },
  { name:'Enigma',           recipe:['Sol','Um','Ohm'],     effect:'silence immune · adjacent +1/+1 · destroy on play' },
  { name:'Faith',            recipe:['Ohm','Um','Nef'],     effect:'on death return · destroy on play · adjacent +1/+1' },
  { name:'Enlightenment',    recipe:['Ith','Ith','Nef'],    effect:'draw 2 · return on death' },
  { name:'Fortitude',        recipe:['El','Sol','Zod'],     effect:'+1 ATK · silence immune · indestructible' },
  { name:'Grief',            recipe:['Tir','Ohm'],          effect:'gain mana + destroy enemy' },
  { name:'Chains of Honor',  recipe:['Um','Um','Um'],       effect:'+3/+3 to all adjacent friendlies' },
  { name:'Call to Arms',     recipe:['Ith','Nef','Ohm'],    effect:'draw 1 · return on death · destroy on play' },
  { name:'Heart of Wolves',  recipe:['El','Eld','El','Eld'],effect:'+2 ATK / +2 HP' }
];

window.matchRuneword = function(runes) {
  if (!runes || !runes.length) return null;
  for (const rw of window.RUNEWORDS) {
    if (rw.recipe.length !== runes.length) continue;
    if (rw.recipe.every((r,i) => runes[i] === r)) return rw;
  }
  return null;
};

// ────────── Inventory helper · single source
window.openInventoryDB = function() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('fallkard', 1);
    req.onerror = () => rej(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('decks')) db.createObjectStore('decks', { keyPath: 'name' });
      if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
  });
};
window.loadInventory = function(db) {
  return new Promise(res => {
    const tx = db.transaction('inventory','readonly');
    const req = tx.objectStore('inventory').get('main');
    req.onsuccess = () => res(req.result || { id:'main', shards:0, runes:{}, charms:{}, cardDrops:[], socketed:{}, defeated:[] });
  });
};
window.saveInventory = function(db, inv) {
  return new Promise((res,rej) => {
    const tx = db.transaction('inventory','readwrite');
    tx.objectStore('inventory').put(inv);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};
