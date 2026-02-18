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
  voltage: string;       // '120', '208', '240'
  type: 'load' | 'subpanel';
  subPanelId?: string;   // links to a MainPanel.id when type==='subpanel'
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
  parentPanelId?: string;   // if this panel is fed from a breaker on another panel
  feedBreakerId?: string;   // the breaker id on the parent that feeds this panel
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
  panelId: string;          // which panel this charger is connected to
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

/** How many breaker spaces a given voltage occupies */
export function breakerSpaces(voltage: string): number {
  switch (voltage) {
    case '208':
    case '240':
      return 2;
    case '120':
    default:
      return 1;
  }
}

/** Voltage options available for a given service voltage */
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

/** Calculate total breaker spaces used by a list of breakers */
export function totalSpacesUsed(breakers: Breaker[]): number {
  return breakers.reduce((sum, b) => sum + breakerSpaces(b.voltage), 0);
}

/** Calculate kW from volts and amps */
export function calcKw(voltage: string, amps: string): number {
  const v = Number(voltage) || 0;
  const a = Number(amps) || 0;
  return (v * a) / 1000;
}
