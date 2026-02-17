export interface ServiceEntrance {
  utilityProvider: string;
  serviceVoltage: string;
  servicePhase: string;
  serviceAmperage: string;
  meterNumber: string;
}

export interface MainPanel {
  panelLocation: string;
  panelMake: string;
  panelModel: string;
  mainBreakerAmps: string;
  busRatingAmps: string;
  totalSpaces: string;
  availableSpaces: string;
}

export interface ExistingLoad {
  id: string;
  name: string;
  breakerAmps: string;
  voltage: string;
}

export interface EVChargerInfo {
  chargerLevel: string;
  chargerAmps: string;
  breakerSize: string;
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
  serviceEntrance: ServiceEntrance;
  mainPanel: MainPanel;
  existingLoads: ExistingLoad[];
  evCharger: EVChargerInfo;
}
