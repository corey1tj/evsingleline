import { useState } from 'react';
import { SiteInfoForm } from './components/SiteInfoForm';
import { ServiceEntranceForm } from './components/ServiceEntranceForm';
import { MainPanelForm } from './components/MainPanelForm';
import { ExistingLoadsForm } from './components/ExistingLoadsForm';
import { EVChargerForm } from './components/EVChargerForm';
import { LoadCalculation } from './components/LoadCalculation';
import { ExportButton } from './components/ExportButton';
import type { SingleLineData } from './types';
import './App.css';

const STORAGE_KEY = 'evsingleline_data';

function getInitialData(): SingleLineData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {
    siteInfo: {
      customerName: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      surveyDate: '',
      technicianName: '',
      notes: '',
    },
    serviceEntrance: {
      utilityProvider: '',
      serviceVoltage: '',
      servicePhase: '',
      serviceAmperage: '',
      meterNumber: '',
    },
    mainPanel: {
      panelLocation: '',
      panelMake: '',
      panelModel: '',
      mainBreakerAmps: '',
      busRatingAmps: '',
      totalSpaces: '',
      availableSpaces: '',
    },
    existingLoads: [],
    evCharger: {
      chargerLevel: '',
      chargerAmps: '',
      breakerSize: '',
      wireRunFeet: '',
      wireSize: '',
      conduitType: '',
      installLocation: '',
    },
  };
}

function App() {
  const [data, setData] = useState<SingleLineData>(getInitialData);

  const updateData = (patch: Partial<SingleLineData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleClear = () => {
    if (window.confirm('Clear all form data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      setData(getInitialData());
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>EV Single Line</h1>
        <p>Capture electrical one-line information for EV charger installation</p>
      </header>

      <main>
        <SiteInfoForm
          data={data.siteInfo}
          onChange={(siteInfo) => updateData({ siteInfo })}
        />

        <ServiceEntranceForm
          data={data.serviceEntrance}
          onChange={(serviceEntrance) => updateData({ serviceEntrance })}
        />

        <MainPanelForm
          data={data.mainPanel}
          onChange={(mainPanel) => updateData({ mainPanel })}
        />

        <ExistingLoadsForm
          loads={data.existingLoads}
          onChange={(existingLoads) => updateData({ existingLoads })}
        />

        <EVChargerForm
          data={data.evCharger}
          onChange={(evCharger) => updateData({ evCharger })}
        />

        <LoadCalculation data={data} />

        <div className="actions">
          <ExportButton data={data} />
          <button type="button" className="btn-clear" onClick={handleClear}>
            Clear All
          </button>
        </div>
      </main>

      <footer className="app-footer">
        <p>Data is saved locally in your browser.</p>
      </footer>
    </div>
  );
}

export default App;
