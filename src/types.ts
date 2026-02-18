export interface ElectricalService {
  id: string;
  serviceName: string;
  utilityProvider: string;
  serviceVoltage: string;   // "120/240V", "120/208V", "277/480V"
  servicePhase: string;     // "single", "three"
  serviceAmperage: string;
  meterNumber: string;
}

export interface Panel {
  id: string;
  serviceId: string;         // which service this panel belongs to
  parentId: string;          // "" = MDP (root panel for its service), otherwise parent panel id
  feedBreakerAmps: string;   // breaker in parent panel that feeds this sub-panel
  panelName: string;
  panelLocation: string;
  panelMake: string;
  panelModel: string;
  mainBreakerAmps: string;
  busRatingAmps: string;
  busVoltage: string;        // derived from service/parent: "240", "208", "480"
  totalSpaces: string;
  availableSpaces: string;
}

export interface ExistingLoad {
  id: string;
  panelId: string;           // which panel this load is in
  name: string;
  breakerAmps: string;
  voltage: string;
}

export interface EVChargerInfo {
  id: string;
  panelId: string;           // which panel this charger's breaker is in
  chargerLabel: string;
  chargerLevel: string;      // "Level 1", "Level 2", "Level 3 DCFC"
  chargerAmps: string;       // actual continuous draw
  breakerSize: string;       // must be >= chargerAmps * 1.25 (80% rule)
  chargerVoltage: string;    // "120", "208", "240", "480"
  wireRunFeet: string;
  wireSize: string;
  conduitType: string;
  installLocation: string;
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
  services: ElectricalService[];
  panels: Panel[];
  existingLoads: ExistingLoad[];
  evChargers: EVChargerInfo[];
}

// ── Helpers ──

/** Derive bus voltage string from service voltage string */
export function busVoltageFromService(serviceVoltage: string): string {
  if (serviceVoltage.includes('480')) return '480';
  if (serviceVoltage.includes('208')) return '208';
  if (serviceVoltage.includes('240')) return '240';
  return '';
}

/** Get the available load voltages for a given bus voltage */
export function loadVoltagesForBus(busVoltage: string): string[] {
  switch (busVoltage) {
    case '480': return ['277', '480'];
    case '208': return ['120', '208'];
    case '240': return ['120', '240'];
    default: return ['120', '240'];
  }
}

/** Get available charger levels for a given bus voltage */
export function chargerLevelsForBus(busVoltage: string): { value: string; label: string }[] {
  switch (busVoltage) {
    case '480':
      return [{ value: 'Level 3 DCFC', label: 'Level 3 DCFC (480V)' }];
    case '208':
      return [
        { value: 'Level 1', label: 'Level 1 (120V)' },
        { value: 'Level 2', label: 'Level 2 (208V)' },
      ];
    case '240':
      return [
        { value: 'Level 1', label: 'Level 1 (120V)' },
        { value: 'Level 2', label: 'Level 2 (240V)' },
      ];
    default:
      return [
        { value: 'Level 1', label: 'Level 1 (120V)' },
        { value: 'Level 2', label: 'Level 2 (240V)' },
      ];
  }
}

/** Get charger voltage from level + bus voltage */
export function chargerVoltageForLevel(level: string, busVoltage: string): string {
  if (level === 'Level 1') return '120';
  if (level === 'Level 2') return busVoltage === '208' ? '208' : '240';
  if (level === 'Level 3 DCFC') return '480';
  return '';
}

/** Standard breaker sizes (amps) */
export const STANDARD_BREAKER_SIZES = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100,
  110, 125, 150, 175, 200, 225, 250, 300, 350, 400,
  450, 500, 600, 700, 800,
];

/** Minimum breaker size for 80% continuous load rule: breaker >= amps * 1.25 */
export function minBreakerForContinuousLoad(chargerAmps: number): number {
  const min = chargerAmps * 1.25;
  const size = STANDARD_BREAKER_SIZES.find((s) => s >= min);
  return size ?? STANDARD_BREAKER_SIZES[STANDARD_BREAKER_SIZES.length - 1];
}

/** Available bus voltages for a sub-panel given parent bus voltage */
export function availableBusVoltages(parentBusVoltage: string): { value: string; label: string }[] {
  switch (parentBusVoltage) {
    case '480':
      return [
        { value: '480', label: '480V' },
        { value: '208', label: '208V (transformer)' },
        { value: '240', label: '240V (transformer)' },
      ];
    case '208':
      return [{ value: '208', label: '208V' }];
    case '240':
      return [{ value: '240', label: '240V' }];
    default:
      return [
        { value: '240', label: '240V' },
        { value: '208', label: '208V' },
        { value: '480', label: '480V' },
      ];
  }
}
