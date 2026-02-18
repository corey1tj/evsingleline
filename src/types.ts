export interface ServiceEntrance {
  utilityProvider: string;
  serviceVoltage: string;
  servicePhase: string;
  serviceAmperage: string;
  meterNumber: string;
}

export interface Breaker {
  id: string;
  circuitNumber: string;
  label: string;
  amps: string;
  voltage: string;       // '120', '208', '240', '277', '480'
  type: 'load' | 'subpanel' | 'evcharger';
  subPanelId?: string;   // links to a MainPanel.id when type==='subpanel'
  // EV charger fields (populated when type === 'evcharger')
  chargerLevel?: string;
  chargerAmps?: string;
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
  parentPanelId?: string;
  feedBreakerId?: string;
  breakers: Breaker[];
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

/** Get the line-to-line voltage for a given charger level and service type */
export function chargerVoltage(level: string, serviceVoltage: string): number {
  if (level === 'Level 1') return 120;
  switch (serviceVoltage) {
    case '120/208V': return 208;
    case '277/480V': return 480;
    case '120/240V':
    default: return 240;
  }
}

/** Standard breaker sizes (amps) */
export const STANDARD_BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];
