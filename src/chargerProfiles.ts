export interface ChargerProfile {
  id: string;
  name: string;
  chargerLevel: string;
  chargerAmps: string;           // Actual input current (A)
  chargerPorts: string;
  outputKw?: number;             // Rated output kW (DCFC only)
  necMinBreaker: number;         // NEC 240.6(A) minimum breaker
  recommendedBreaker: number;    // Manufacturer recommended w/ headroom
  minConductor?: string;         // Min conductor @ 75°C Cu
  recommendedConductor?: string; // Recommended conductor @ 75°C Cu
}

export const CHARGER_PROFILES: ChargerProfile[] = [
  // ── Level 2 AC ──
  {
    id: 'ac50',
    name: 'CoreCharger AC/50',
    chargerLevel: 'Level 2',
    chargerAmps: '50',
    chargerPorts: '1',
    necMinBreaker: 70,
    recommendedBreaker: 70,
  },
  {
    id: 'acs50',
    name: 'CoreCharger ACS/50',
    chargerLevel: 'Level 2',
    chargerAmps: '50',
    chargerPorts: '1',
    necMinBreaker: 70,
    recommendedBreaker: 70,
  },
  {
    id: 'ac80',
    name: 'CoreCharger AC/80',
    chargerLevel: 'Level 2',
    chargerAmps: '80',
    chargerPorts: '1',
    necMinBreaker: 100,
    recommendedBreaker: 125,
  },
  {
    id: 'dual-ac80',
    name: 'CoreCharger Dual AC/80',
    chargerLevel: 'Level 2',
    chargerAmps: '80',
    chargerPorts: '2',
    necMinBreaker: 100,
    recommendedBreaker: 125,
  },

  // ── Level 3 DCFC (480V 3φ) — Mfr-rated input current per FutureEnergy install manual ──
  {
    id: 'dc60',
    name: 'CoreCharger DC/60',
    chargerLevel: 'Level 3',
    chargerAmps: '81',
    chargerPorts: '2',
    outputKw: 60,
    necMinBreaker: 110,
    recommendedBreaker: 125,
    minConductor: '1 AWG',
    recommendedConductor: '1/0 AWG',
  },
  {
    id: 'dc80',
    name: 'CoreCharger DC/80',
    chargerLevel: 'Level 3',
    chargerAmps: '107',
    chargerPorts: '2',
    outputKw: 80,
    necMinBreaker: 150,
    recommendedBreaker: 225,
    minConductor: '1/0 AWG',
    recommendedConductor: '4/0 AWG',
  },
  {
    id: 'dc100',
    name: 'CoreCharger DC/100',
    chargerLevel: 'Level 3',
    chargerAmps: '133',
    chargerPorts: '2',
    outputKw: 100,
    necMinBreaker: 175,
    recommendedBreaker: 225,
    minConductor: '2/0 AWG',
    recommendedConductor: '4/0 AWG',
  },
  {
    id: 'dc120',
    name: 'CoreCharger DC/120',
    chargerLevel: 'Level 3',
    chargerAmps: '158',
    chargerPorts: '2',
    outputKw: 120,
    necMinBreaker: 200,
    recommendedBreaker: 250,
    minConductor: '3/0 AWG',
    recommendedConductor: '250 kcmil',
  },
  {
    id: 'dc140',
    name: 'CoreCharger DC/140',
    chargerLevel: 'Level 3',
    chargerAmps: '184',
    chargerPorts: '2',
    outputKw: 140,
    necMinBreaker: 250,
    recommendedBreaker: 400,
    minConductor: '250 kcmil',
    recommendedConductor: '500 kcmil',
  },
  {
    id: 'dc160',
    name: 'CoreCharger DC/160',
    chargerLevel: 'Level 3',
    chargerAmps: '209',
    chargerPorts: '2',
    outputKw: 160,
    necMinBreaker: 300,
    recommendedBreaker: 400,
    minConductor: '350 kcmil',
    recommendedConductor: '500 kcmil',
  },
  {
    id: 'dc180',
    name: 'CoreCharger DC/180',
    chargerLevel: 'Level 3',
    chargerAmps: '235',
    chargerPorts: '2',
    outputKw: 180,
    necMinBreaker: 300,
    recommendedBreaker: 400,
    minConductor: '350 kcmil',
    recommendedConductor: '500 kcmil',
  },
  {
    id: 'dc200',
    name: 'CoreCharger DC/200',
    chargerLevel: 'Level 3',
    chargerAmps: '260',
    chargerPorts: '2',
    outputKw: 200,
    necMinBreaker: 350,
    recommendedBreaker: 400,
    minConductor: '350 kcmil',
    recommendedConductor: '500 kcmil',
  },
  {
    id: 'dc220',
    name: 'CoreCharger DC/220',
    chargerLevel: 'Level 3',
    chargerAmps: '286',
    chargerPorts: '2',
    outputKw: 220,
    necMinBreaker: 400,
    recommendedBreaker: 500,
    minConductor: '500 kcmil',
    recommendedConductor: '2× 250 kcmil',
  },
  {
    id: 'dc240',
    name: 'CoreCharger DC/240',
    chargerLevel: 'Level 3',
    chargerAmps: '312',
    chargerPorts: '2',
    outputKw: 240,
    necMinBreaker: 400,
    recommendedBreaker: 500,
    minConductor: '500 kcmil',
    recommendedConductor: '2× 250 kcmil',
  },
];

export function getProfile(id: string): ChargerProfile | undefined {
  return CHARGER_PROFILES.find((p) => p.id === id);
}
