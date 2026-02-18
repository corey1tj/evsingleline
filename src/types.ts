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
  chargerLevel?: string;
  chargerAmps?: string;
  chargerPorts?: string;  // number of ports / connectors
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

export function breakerSpaces(voltage: string): number {
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
  return breakers.reduce((sum, b) => sum + breakerSpaces(b.voltage), 0);
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
export const STANDARD_BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];

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

/** Calculate peak kW for an EV charger breaker using charger output */
export function evChargerKw(b: Breaker): number {
  const v = Number(b.voltage) || 0;
  const a = Number(b.chargerAmps) || 0;
  return (v * a) / 1000;
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

/** Default NEC load type for common load labels */
export function defaultLoadType(label: string, type: string): LoadType {
  if (type === 'evcharger') return 'continuous';  // NEC 625.40
  // Common continuous loads per NEC
  const continuousLabels = ['lighting', 'electric furnace'];
  const lower = label.toLowerCase();
  for (const cl of continuousLabels) {
    if (lower.includes(cl)) return 'continuous';
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
