export type Condition = 'existing' | 'new';
export type LoadType = 'continuous' | 'noncontinuous';

export interface ServiceEntrance {
  utilityProvider: string;
  serviceVoltage: string;
  servicePhase: string;
  serviceAmperage: string;
  meterNumber: string;
  condition: Condition;
}

export interface Transformer {
  kva: string;
  primaryVoltage: string;   // system voltage of primary side, e.g. '277/480V'
  secondaryVoltage: string; // system voltage of secondary side, e.g. '120/208V'
}

export interface Breaker {
  id: string;
  circuitNumber: string;
  label: string;
  amps: string;
  voltage: string;       // '120', '208', '240', '277', '480'
  type: 'load' | 'subpanel' | 'evcharger';
  condition: Condition;
  loadType: LoadType;    // NEC continuous vs non-continuous classification
  subPanelId?: string;   // links to a MainPanel.id when type==='subpanel'
  // EV charger fields (populated when type === 'evcharger')
  chargerProfileId?: string;       // selected charger profile ID
  chargerLevel?: string;
  chargerAmps?: string;
  chargerPorts?: string;           // number of ports / connectors
  chargerOutputKw?: string;        // rated DC output kW (DCFC)
  recommendedBreakerAmps?: string; // manufacturer recommended breaker
  minConductor?: string;           // min conductor @ 75°C Cu
  recommendedConductor?: string;   // recommended conductor @ 75°C Cu
  wireRunFeet?: string;
  wireSize?: string;
  conduitType?: string;
  installLocation?: string;
}

export interface MainPanel {
  id: string;
  panelName: string;
  panelLocation: string;
  panelMake: string;
  panelModel: string;
  mainBreakerAmps: string;
  busRatingAmps: string;
  totalSpaces: string;
  spareSpaces: string;       // unused / blank breaker spaces (user-entered)
  condition: Condition;
  parentPanelId?: string;
  feedBreakerId?: string;
  breakers: Breaker[];
  transformer?: Transformer;
  panelVoltage?: string;  // overrides inherited voltage (set when fed via transformer)
}

export interface EVChargerInfo {
  id: string;
  chargerLabel: string;
  chargerLevel: string;
  chargerAmps: string;
  breakerSize: string;
  wireRunFeet: string;
  wireSize: string;
  conduitType: string;
  installLocation: string;
  panelId: string;
}

export interface SiteInfo {
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  surveyDate: string;
  technicianName: string;
  notes: string;
}

export interface SingleLineData {
  siteInfo: SiteInfo;
  serviceEntrance: ServiceEntrance;
  panels: MainPanel[];
  evChargers: EVChargerInfo[];
}

// Helpers

export function breakerSpaces(voltage: string, type?: string): number {
  // Level 3 DCFC: 3-phase 480V requires 3-pole breaker
  if (type === 'evcharger' && voltage === '480') return 3;
  switch (voltage) {
    case '208':
    case '240':
    case '480':
      return 2;
    case '120':
    case '277':
    default:
      return 1;
  }
}

export function voltageOptionsForService(serviceVoltage: string): { value: string; label: string }[] {
  switch (serviceVoltage) {
    case '120/208V':
      return [
        { value: '120', label: '120V (1-pole)' },
        { value: '208', label: '208V (2-pole)' },
      ];
    case '277/480V':
      return [
        { value: '277', label: '277V (1-pole)' },
        { value: '480', label: '480V (2-pole)' },
      ];
    case '120/240V':
    default:
      return [
        { value: '120', label: '120V (1-pole)' },
        { value: '240', label: '240V (2-pole)' },
      ];
  }
}

export function totalSpacesUsed(breakers: Breaker[]): number {
  return breakers.reduce((sum, b) => sum + breakerSpaces(b.voltage, b.type), 0);
}

export function calcKw(voltage: string, amps: string): number {
  const v = Number(voltage) || 0;
  const a = Number(amps) || 0;
  return (v * a) / 1000;
}

/** Get the default breaker voltage for a given charger level and panel voltage system.
 *  Used to auto-set breaker voltage when the charger level changes. */
export function chargerVoltage(level: string, serviceVoltage: string): number {
  if (level === 'Level 1') return 120;
  if (level === 'Level 3') return 480;
  // Level 2: 208 or 240 depending on infrastructure
  switch (serviceVoltage) {
    case '120/208V': return 208;
    case '120/240V':
    default: return 240;
  }
}

/** Standard breaker sizes (amps) */
export const STANDARD_BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500];

/** NEC Table 310.16 — Allowable ampacities of insulated conductors, 75°C Cu (THWN-2) */
export const WIRE_SIZES: { label: string; ampacity: number }[] = [
  { label: '14 AWG', ampacity: 20 },
  { label: '12 AWG', ampacity: 25 },
  { label: '10 AWG', ampacity: 35 },
  { label: '8 AWG', ampacity: 50 },
  { label: '6 AWG', ampacity: 65 },
  { label: '4 AWG', ampacity: 85 },
  { label: '#3 AWG', ampacity: 100 },
  { label: '2 AWG', ampacity: 115 },
  { label: '1 AWG', ampacity: 130 },
  { label: '1/0 AWG', ampacity: 150 },
  { label: '2/0 AWG', ampacity: 175 },
  { label: '3/0 AWG', ampacity: 200 },
  { label: '4/0 AWG', ampacity: 230 },
  { label: '250 kcmil', ampacity: 255 },
  { label: '300 kcmil', ampacity: 285 },
  { label: '350 kcmil', ampacity: 310 },
  { label: '400 kcmil', ampacity: 335 },
  { label: '500 kcmil', ampacity: 380 },
  { label: '2× 3/0 AWG', ampacity: 400 },
  { label: '2× 4/0 AWG', ampacity: 460 },
  { label: '2× 250 kcmil', ampacity: 510 },
];

/** Find the index of a wire size in the WIRE_SIZES array.
 *  Handles common label variants (e.g. '3 AWG' matches '#3 AWG'). */
export function wireSizeIndex(size: string): number {
  const normalized = size.trim();
  let idx = WIRE_SIZES.findIndex((w) => w.label === normalized);
  if (idx >= 0) return idx;
  // Try with '#' prefix for bare number AWG (e.g. '3 AWG' -> '#3 AWG')
  if (/^\d+ AWG$/.test(normalized)) {
    idx = WIRE_SIZES.findIndex((w) => w.label === `#${normalized}`);
  }
  // Try without '#' prefix
  if (idx < 0 && normalized.startsWith('#')) {
    idx = WIRE_SIZES.findIndex((w) => w.label === normalized.substring(1));
  }
  return idx;
}

/** Minimum wire size for a given charger amps per NEC 625.40 (125% continuous) + Table 310.16 */
export function minWireSizeForAmps(chargerAmps: number): string | undefined {
  const required = chargerAmps * 1.25;  // NEC 625.40 continuous load
  const entry = WIRE_SIZES.find((w) => w.ampacity >= required);
  return entry?.label;
}

/** Check if a selected wire size is smaller than the required minimum */
export function isWireUndersized(selected: string, minimum: string): boolean {
  const selIdx = wireSizeIndex(selected);
  const minIdx = wireSizeIndex(minimum);
  if (selIdx < 0 || minIdx < 0) return false;  // unknown sizes, don't flag
  return selIdx < minIdx;
}

/** NEC 625.40 – minimum breaker amps for continuous EV load (125% of charger amps) */
export function minBreakerAmpsForEv(chargerAmps: number): number {
  return Math.ceil(chargerAmps * 1.25);
}

/** Next standard breaker size >= the given minimum amps */
export function nextBreakerSize(minAmps: number): number {
  for (const s of STANDARD_BREAKER_SIZES) {
    if (s >= minAmps) return s;
  }
  return minAmps;  // beyond standard sizes
}

/** Get all occupied circuit positions from breakers */
export function getOccupiedPositions(breakers: Breaker[]): Set<number> {
  const occupied = new Set<number>();
  for (const b of breakers) {
    const nums = b.circuitNumber.split(',').map(s => Number(s.trim())).filter(n => n > 0);
    for (const n of nums) {
      occupied.add(n);
    }
  }
  return occupied;
}

/** Calculate the next circuit number for a breaker based on occupied positions.
 *  Standard panel numbering: odd numbers on left, even on right.
 *  For 2-pole breakers, returns "N,N+2" (e.g. "1,3" or "2,4").
 *  For 3-pole breakers (DCFC), returns "N,N+2,N+4" (e.g. "1,3,5"). */
export function nextCircuitNumber(breakers: Breaker[], spaces: number): string {
  const occupied = getOccupiedPositions(breakers);

  if (spaces === 1) {
    let n = 1;
    while (occupied.has(n)) n++;
    return String(n);
  }

  if (spaces === 3) {
    // 3-pole: find N where N, N+2, and N+4 are all available
    let n = 1;
    while (occupied.has(n) || occupied.has(n + 2) || occupied.has(n + 4)) n++;
    return `${n},${n + 2},${n + 4}`;
  }

  // 2-pole: find N where both N and N+2 are available
  let n = 1;
  while (occupied.has(n) || occupied.has(n + 2)) n++;
  return `${n},${n + 2}`;
}

/** Standard transformer kVA sizes */
export const STANDARD_KVA_SIZES = [15, 25, 30, 37.5, 45, 50, 75, 100, 112.5, 150, 167, 200, 225, 250, 300, 500, 750, 1000];

/** Get the line-to-line voltage for a voltage system */
export function systemLineLine(systemVoltage: string): number {
  switch (systemVoltage) {
    case '277/480V': return 480;
    case '120/208V': return 208;
    case '120/240V': return 240;
    default: return 240;
  }
}

/** Whether a voltage system is 3-phase */
export function isThreePhaseSystem(systemVoltage: string): boolean {
  return systemVoltage === '120/208V' || systemVoltage === '277/480V';
}

/** Calculate transformer full-load amps for a given side */
export function transformerFLA(kva: number, systemVoltage: string): number {
  const vLL = systemLineLine(systemVoltage);
  if (vLL <= 0 || kva <= 0) return 0;
  if (isThreePhaseSystem(systemVoltage)) {
    return (kva * 1000) / (vLL * Math.sqrt(3));
  }
  return (kva * 1000) / vLL;
}

/** Get the effective voltage system for a panel (considering transformers and parent chain) */
export function getEffectivePanelVoltage(panel: MainPanel, allPanels: MainPanel[], serviceVoltage: string): string {
  if (panel.panelVoltage) return panel.panelVoltage;
  if (panel.parentPanelId) {
    const parent = allPanels.find((p) => p.id === panel.parentPanelId);
    if (parent) return getEffectivePanelVoltage(parent, allPanels, serviceVoltage);
  }
  return serviceVoltage;
}

/** Calculate peak kVA for a breaker */
export function breakerKva(b: Breaker): number {
  const v = Number(b.voltage) || 0;
  const a = Number(b.amps) || 0;
  return (v * a) / 1000;
}

/** Calculate peak kW (AC input) for an EV charger breaker.
 *  Uses 3-phase formula (V × I × √3) for 480V DCFC chargers. */
export function evChargerKw(b: Breaker): number {
  const v = Number(b.voltage) || 0;
  const a = Number(b.chargerAmps) || 0;
  const phaseFactor = v === 480 ? Math.sqrt(3) : 1;
  return (v * a * phaseFactor) / 1000;
}

/** NEC demand: continuous loads at 125%, non-continuous at 100% */
export function necDemandAmps(breakers: Breaker[]): { continuous: number; nonContinuous: number; totalDemand: number } {
  let continuous = 0;
  let nonContinuous = 0;
  for (const b of breakers) {
    if (b.type === 'subpanel') continue;
    const amps = Number(b.amps) || 0;
    if (b.loadType === 'continuous') {
      continuous += amps;
    } else {
      nonContinuous += amps;
    }
  }
  // NEC 210.20(A) / 215.3: continuous loads × 1.25 + non-continuous × 1.0
  const totalDemand = Math.ceil(continuous * 1.25) + nonContinuous;
  return { continuous, nonContinuous, totalDemand };
}

/** Default NEC load type for common load labels.
 *  NEC 210.2 defines continuous load as one where the maximum current
 *  is expected to continue for 3 hours or more. */
export function defaultLoadType(label: string, type: string): LoadType {
  if (type === 'evcharger') return 'continuous';  // NEC 625.40
  const lower = label.toLowerCase();
  // Continuous loads per NEC (expected to run >= 3 hours)
  const continuousPatterns = [
    'lighting', 'emergency lighting', 'exterior lighting', 'parking lot lighting',
    'sign', 'signage',
    'electric furnace', 'unit heater',
    'walk-in cooler', 'walk-in freezer',
    'fire alarm', 'security system', 'bms', 'building automation',
    'access control', 'smoke detection', 'pa / intercom',
    'server', 'it equipment', 'ups',
  ];
  for (const pattern of continuousPatterns) {
    if (lower.includes(pattern)) return 'continuous';
  }
  return 'noncontinuous';
}

/** Step-down voltage options available from a given parent voltage system */
export function stepDownOptions(parentVoltage: string): { value: string; label: string }[] {
  switch (parentVoltage) {
    case '277/480V':
      return [
        { value: '120/208V', label: '120/208V 3\u03C6 (via Transformer)' },
        { value: '120/240V', label: '120/240V 1\u03C6 (via Transformer)' },
      ];
    default:
      return [];
  }
}
