export const login = 'itsmangooo';

// Editorial copy is grounded in each public repository's README and manifests.
// Keep scope qualifications here; live counts and dates come from the API.
export const projects = [
  {
    repo: 'offdeck', name: 'OFFDECK', category: 'PLAY / 01',
    lines: ['A first-person party card game.', 'Private tables in a desktop browser.'],
    stack: 'JavaScript / Three.js / Socket.IO', note: '3–8 players · 18+',
    icon: 'cards',
  },
  {
    repo: 'Silicon', name: 'Silicon', category: 'SYSTEMS / 02',
    lines: ['Self-hosted application hosting.', 'Your own servers, with room for AWS.'],
    stack: 'Go / React / PostgreSQL / Docker', note: 'Self-hosted',
    icon: 'rack',
  },
  {
    repo: 'Flare', name: 'Flare', category: 'TOOLS / 03',
    lines: ['A homelab, within reach.', 'Android client; Go API back at home.'],
    stack: 'Dart / Flutter / Go / PostgreSQL', note: 'Android + Go API',
    icon: 'phone',
  },
  {
    repo: 'FIRELINE-ADRIATIC', name: 'FIRELINE: ADRIATIC', category: 'SIMULATION / 04',
    lines: ['Cooperative firefighting, in progress.', 'Server-owned fire, wind and flight.'],
    stack: 'C# / Unity 6 / HDRP', note: 'Prototype · M03 in progress',
    icon: 'terrain',
  },
];
