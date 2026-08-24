/* ============================================================
   THE DAILY GRIND — levels.js
   Levels are built programmatically (rect/put/row) so maps stay
   aligned. Legend:
     # wall          = desk         C cabinet      x box
     P plant         c cooler       - one-way      ^ shredder
     > belt right    < belt left    G security gate (needs badge)
     H ladder (hold UP to climb, jump to hop off)
     S start         E exit         k checkpoint   B boss
     o coffee        F jira ticket  D donut        K employee badge
     J spring chair  R on-call pager (curse)
     m manager       i intern (flees)              h HR drone (floats)
   Design rules: main path never requires precision wall-jumps;
   springs/movers are the casual bypass; sky routes hold the loot.
   ============================================================ */

const TILE = 48;

const LEVELS = [
  {
    name: 'ONBOARDING',
    quip: 'Monday, 8:59 AM.',
    w: 92, h: 15,
    planes: { every: 3.6, yMin: 2, yMax: 8, speed: -240 },
    track: 'main',
    build(a) {
      a.rect('#', 0, 0, 91, 0);              // ceiling
      a.rect('#', 0, 1, 0, 14);              // walls
      a.rect('#', 91, 1, 91, 14);
      a.rect('#', 1, 13, 30, 14);            // floor A
      a.rect('#', 34, 13, 58, 14);           // floor B
      a.rect('#', 62, 13, 90, 14);           // floor C
      /* welcome */
      a.put('P', 1, 12); a.put('C', 2, 11); a.put('C', 2, 12);
      a.put('S', 4, 12); a.put('o', 6, 12);
      a.put('W', 7, 12);                     /* your desk: the stapler you're about to quit with */
      a.put('=', 8, 12); a.put('=', 9, 12); a.put('c', 11, 12);
      a.put('^', 14, 12); a.put('^', 15, 12);
      /* wall-jump teaser chimney (loot on top, walk-through below) */
      a.put('o', 18, 12);
      a.rect('#', 20, 4, 20, 10);
      a.rect('#', 23, 5, 23, 9);
      a.row('-', 19, 24, 4);
      a.rect('H', 22, 5, 22, 12);          /* ladder: the obvious way up */
      a.put('F', 21, 3); a.put('D', 23, 3);
      a.put('k', 27, 12);
      a.put('^', 28, 12); a.put('^', 29, 12);
      /* pit + spring chair */
      a.put('J', 30, 12);
      a.put('~', 32, 10); a.put('o', 32, 7);
      /* sprint section */
      a.put('m', 38, 12);
      a.row('>', 42, 46, 12); a.put('^', 44, 12);
      a.put('o', 41, 12); a.put('D', 47, 12);
      a.put('x', 49, 11); a.put('x', 49, 12);
      a.put('m', 52, 12);
      a.put('k', 55, 12);
      /* drone-guarded shelf */
      a.row('-', 43, 45, 9); a.put('F', 44, 8); a.put('h', 44, 6);
      /* spring loft */
      a.put('J', 57, 12);
      a.row('-', 54, 57, 6); a.put('F', 55, 5); a.put('F', 56, 5);
      /* second gap */
      a.put('~', 60, 10); a.put('o', 60, 7);
      /* intern comedy hour */
      a.put('i', 65, 12); a.put('i', 67, 12);
      a.put('=', 70, 12); a.put('=', 71, 12); a.put('=', 72, 12); a.put('F', 71, 11);
      a.put('m', 76, 12);
      a.put('^', 80, 12); a.put('^', 81, 12);
      /* wall-jump bonus shelf by the exit */
      a.row('-', 84, 88, 9); a.put('o', 85, 8); a.put('F', 87, 8);
      a.put('E', 87, 12);
      a.put('P', 89, 12);
    },
  },
  {
    name: 'THE SPRINT',
    quip: 'Velocity was a lie.',
    w: 96, h: 15,
    planes: { every: 3.0, yMin: 2, yMax: 7, speed: -260 },
    track: 'main',
    build(a) {
      a.rect('#', 0, 0, 95, 0);
      a.rect('#', 0, 1, 0, 14);
      a.rect('#', 95, 1, 95, 14);
      a.rect('#', 1, 13, 26, 14);            // floor A
      a.rect('#', 38, 13, 66, 14);           // floor B
      a.rect('#', 70, 13, 94, 14);           // floor C
      /* warm-up against the belt */
      a.put('P', 1, 12); a.put('S', 3, 12); a.put('o', 5, 12); a.put('c', 8, 12);
      a.put('^', 12, 12); a.put('^', 13, 12);
      a.row('<', 16, 20, 12); a.put('^', 18, 12);
      a.put('i', 23, 12);
      a.put('k', 25, 12);
      /* badge shaft (climb for sky loot; movers = casual bypass) */
      a.rect('#', 26, 4, 26, 12);
      a.rect('#', 38, 5, 38, 12);
      a.row('-', 30, 32, 10); a.row('-', 30, 32, 6);
      a.put('F', 30, 5); a.put('D', 32, 5);
      a.put('h', 31, 7);
      a.row('-', 28, 36, 3); a.put('F', 29, 2); a.put('o', 33, 2); a.put('F', 35, 2);
      a.put('~', 29, 11); a.put('~', 35, 9);
      /* sprint treadmill */
      a.put('o', 39, 12);
      a.put('K', 41, 12);
      a.put('^', 43, 12); a.put('^', 44, 12);
      a.put('m', 48, 12);
      a.put('R', 50, 12);                    // the pager curse
      a.row('>', 52, 56, 12); a.put('o', 54, 12);
      a.put('x', 58, 11); a.put('x', 58, 12);
      a.put('m', 60, 12);
      a.put('D', 63, 12);
      a.put('k', 65, 12);
      /* last gap */
      a.put('~', 68, 10);
      /* desks = high-five fuel for the pager */
      a.put('=', 71, 12); a.put('=', 72, 12); a.put('=', 73, 12); a.put('F', 72, 11);
      a.put('i', 76, 12);
      a.put('m', 79, 12);
      a.put('^', 82, 12); a.put('^', 83, 12);
      a.put('o', 84, 12);
      /* RTO security gate — badge required */
      a.rect('G', 86, 5, 86, 12);
      a.put('o', 88, 12); a.put('o', 89, 12); a.put('F', 90, 12);
      a.put('C', 90, 11); a.put('C', 90, 12); a.put('C', 90, 13); a.put('C', 90, 14);
      a.rect('C', 91, 10, 93, 14);
      a.put('E', 92, 9);
      a.put('P', 94, 12);
    },
  },
  {
    name: 'THE REORG',
    quip: 'Patch notes: managers buffed. Morale nerfed.',
    w: 104, h: 15,
    planes: { every: 2.6, yMin: 2, yMax: 8, speed: -280 },
    track: 'main',
    build(a) {
      a.rect('#', 0, 0, 103, 0);
      a.rect('#', 0, 1, 0, 14);
      a.rect('#', 103, 1, 103, 14);
      a.rect('#', 1, 13, 20, 14);            // floor A
      a.rect('#', 24, 13, 44, 14);           // floor B
      a.rect('#', 48, 13, 78, 14);           // floor C
      a.rect('#', 82, 13, 102, 14);          // floor D
      /* shredder islands */
      a.put('P', 1, 12); a.put('S', 3, 12); a.put('o', 5, 12);
      a.put('^', 9, 12); a.put('^', 10, 12);
      a.put('=', 11, 12); a.put('=', 12, 12);
      a.put('^', 13, 12); a.put('^', 14, 12);
      a.put('m', 18, 12); a.put('k', 19, 12);
      /* the split: sky highway vs ground drag */
      a.put('J', 20, 12);
      a.put('~', 22, 9);
      a.row('-', 23, 27, 8); a.put('F', 25, 7); a.put('h', 26, 5);
      a.row('-', 28, 32, 7); a.put('F', 30, 6); a.put('h', 31, 4);
      a.put('~', 36, 5); a.put('F', 38, 4);
      a.put('~', 42, 4); a.put('D', 43, 3);
      a.row('<', 24, 27, 12); a.put('^', 26, 12);
      a.put('m', 31, 12); a.put('x', 30, 11); a.put('x', 30, 12);
      a.put('i', 34, 12);
      a.put('^', 37, 12); a.put('^', 38, 12);
      a.put('m', 41, 12); a.put('k', 43, 12);
      /* central tower (walk-through base, chimney above) */
      a.rect('#', 48, 3, 48, 10);
      a.rect('#', 54, 3, 54, 10);
      a.row('-', 50, 52, 10); a.row('-', 50, 52, 6);
      a.put('J', 51, 12);
      a.row('-', 55, 58, 3);
      a.put('F', 56, 2); a.put('K', 57, 2); a.put('D', 58, 2);
      /* reorg gauntlet */
      a.put('m', 61, 12);
      a.put('^', 63, 12); a.put('^', 64, 12);
      a.put('m', 66, 12);
      a.row('>', 69, 73, 12); a.put('^', 74, 12); a.put('o', 69, 12);
      a.put('D', 76, 12); a.put('k', 77, 12);
      /* secret rooftop vault (badge from the tower bridge) */
      a.put('J', 78, 12);
      a.row('-', 74, 79, 4);
      a.rect('#', 80, 0, 80, 2);
      a.put('G', 80, 3);
      a.row('-', 81, 86, 3);
      a.put('F', 82, 2); a.put('F', 83, 2); a.put('F', 84, 2); a.put('D', 85, 2); a.put('o', 86, 2);
      a.put('~', 80, 10);
      /* intern parade + finale */
      a.put('i', 85, 12); a.put('i', 88, 12); a.put('i', 91, 12);
      a.put('^', 94, 12); a.put('^', 95, 12);
      a.put('o', 99, 12);
      a.put('E', 101, 12);
      a.put('P', 102, 12);
    },
  },
  {
    name: 'EXIT INTERVIEW',
    quip: 'Final performance review.',
    w: 30, h: 15,
    planes: null,
    track: 'boss',
    boss: true,
    build(a) {
      a.rect('#', 0, 0, 29, 0);
      a.rect('#', 0, 1, 0, 14);
      a.rect('#', 29, 1, 29, 14);
      a.rect('#', 1, 13, 28, 14);
      a.row('-', 3, 5, 9); a.row('-', 24, 26, 9);
      a.put('P', 2, 12); a.put('P', 27, 12);
      a.put('B', 15, 12);
      a.put('S', 6, 12);
    },
  },
];

/* ---- builder helper ---- */
function buildGrid(def) {
  const g = [];
  for (let y = 0; y < def.h; y++) g.push(new Array(def.w).fill('.'));
  const spawns = [];
  const api = {
    rect(ch, x0, y0, x1, y1) {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          if (y >= 0 && y < def.h && x >= 0 && x < def.w) g[y][x] = ch;
    },
    put(ch, x, y) {
      if (y >= 0 && y < def.h && x >= 0 && x < def.w) {
        if ('SkEm~!BihJR'.includes(ch)) { spawns.push({ ch, x, y }); g[y][x] = '.'; }
        else g[y][x] = ch;
      }
    },
    row(ch, x0, x1, y) { for (let x = x0; x <= x1; x++) api.put(ch, x, y); },
  };
  def.build(api);
  return { grid: g, spawns };
}

const COWORKER_LINES = [
  'Per my last email...',
  "This meeting could've been an email.",
  "I'm a coffee-based lifeform.",
  'Living the dream.',
  'It works on my machine.',
  "You're on mute.",
  'LGTM. Ship it.',
  "Quick sync? It's 4:59.",
  'Who closed my ticket?!',
  'My RSU vested. I feel nothing.',
  'My calendar is back-to-back with prep meetings. For the meeting.',
  'The copier knows what it did.',
  'I\u2019ve been circling back since 2019.',
  'Corporate said bring your whole self to work. I brought a chair.',
  'Asked for a raise. Got a lanyard.',
  'Quiet quitting? I never made a sound.',
  'They reorged us into a circle. Same work, rounder.',
  'Status: In a meeting. Location: parking garage.',
  'My OKRs say impact. My inbox says survive.',
  'Trust falls today. No trust was found.',
  'HR called the drone incident team building.',
  'The ping-pong table replaced our 401k match.',
  'New hire orientation is trauma bonding with name tags.',
  'Did you get the memo?',
  'Case of the Mondays.',
  'PC LOAD LETTER?! Meaningless!',
  'Bears. Beets. Battlestar Galactica.',
  'World\u2019s Best Boss mug. Self-purchased.',
  'I DECLARE BANKRUPTCY!',
  'The work is mysterious and important.',
  'Please enjoy each donut equally.',
  'Treat. Yo. Self.',
  'The only winning move is not to play.',
  'Someone took my stapler. It was red.',
  'Fifteen pieces of flair, minimum.',
  'The printer deserved what it got.',
];

const DEATH_MSGS = {
  enemy: ['Absorbed into middle management.', 'Reorganized at high speed.', 'Performance improvement plan: failed.'],
  intern: ['Bowled over by a fleeing junior.', 'Casualty of the running of the interns.', 'Team-building exercise gone wrong.'],
  plane: ['Fatal paper cut.', 'Stapled. CC\u2019d. Deceased.', 'Returned to sender. Violently.'],
  shred: [
    'Shredded. HR is asking questions.',
    'Fed to the shredder. It seemed hungry.',
    'You are now confidential waste.',
    'Paperwork: fully processed.',
    'Shredded along with the Q3 projections.',
    'GDPR compliant. Finally.',
    'Recycled into next quarter\'s onboarding packs.',
    'Filed under \'G\' — for Gone.',
    'Confidentiality achieved.',
    'Cross-cut. Like your career path.',
    'Now part of the onboarding pack.',
  ],
  pit: ['You fell into the void between departments.', 'Left the org chart entirely.', 'Gravity filed a complaint.', 'Took a personal day. Forever.'],
  boss: ['Did not pass the EXIT INTERVIEW.', 'Benefits terminated. All of them.', 'Badge deactivated. Symbolically.', 'Should\u2019ve taken this place to a field first.'],
  wave: ['Flattened by quarterly results.', 'Q4 came early.', 'Chili on the floor. Again.'],
  staple: 'Stapled. In triplicate.',
};
