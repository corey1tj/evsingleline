import { useState } from 'react';
import { SiteInfoForm } from './components/SiteInfoForm';
import { ServiceEntranceForm } from './components/ServiceEntranceForm';
import { MainPanelForm } from './components/MainPanelForm';
import { ExistingLoadsForm } from './components/ExistingLoadsForm';
import { EVChargerForm } from './components/EVChargerForm';
import { LoadCalculation } from './components/LoadCalculation';
import { ExportButton } from './components/ExportButton';
import type { SingleLineData, MainPanel, EVChargerInfo } from './types';
import './App.css';

const STORAGE_KEY = 'evsingleline_data';

let nextPanelId = 1;
let nextChargerId = 1;

function createPanel(): MainPanel {
  return {
    id: String(nextPanelId++),
    panelName: '',
    panelLocation: '',
    panelMake: '',
    panelModel: '',
    mainBreakerAmps: '',
    busRatingAmps: '',
    totalSpaces: '',
    availableSpaces: '',
  };
}

function createCharger(): EVChargerInfo {
  return {
    id: String(nextChargerId++),
    chargerLabel: '',
    chargerLevel: '',
    chargerAmps: '',
    breakerSize: '',
    wireRunFeet: '',
    wireSize: '',
    conduitType: '',
    installLocation: '',
  };
}

function getInitialData(): SingleLineData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old format: mainPanel -> panels, evCharger -> evChargers
      if (parsed.mainPanel && !parsed.panels) {
        parsed.panels = [{ ...parsed.mainPanel, id: String(nextPanelId++), panelName: 'Main Panel' }];
        delete parsed.mainPanel;
      }
      if (parsed.evCharger && !parsed.evChargers) {
        parsed.evChargers = [{ ...parsed.evCharger, id: String(nextChargerId++), chargerLabel: 'EV Charger 1' }];
        delete parsed.evCharger;
      }
      // Ensure IDs don't collide
      if (parsed.panels) {
        for (const p of parsed.panels) {
          const num = Number(p.id);
          if (num >= nextPanelId) nextPanelId = num + 1;
        }
      }
      if (parsed.evChargers) {
        for (const c of parsed.evChargers) {
          const num = Number(c.id);
          if (num >= nextChargerId) nextChargerId = num + 1;
        }
      }
      return parsed;
    }
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
    panels: [{ ...createPanel(), panelName: 'Main Panel' }],
    existingLoads: [],
    evChargers: [{ ...createCharger(), chargerLabel: 'EV Charger 1' }],
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

  const addPanel = () => {
    const panel = createPanel();
    panel.panelName = `Panel ${data.panels.length + 1}`;
    updateData({ panels: [...data.panels, panel] });
  };

  const removePanel = (id: string) => {
    if (data.panels.length <= 1) return;
    updateData({ panels: data.panels.filter((p) => p.id !== id) });
  };

  const updatePanel = (id: string, updated: MainPanel) => {
    updateData({ panels: data.panels.map((p) => (p.id === id ? updated : p)) });
  };

  const addCharger = () => {
    const charger = createCharger();
    charger.chargerLabel = `EV Charger ${data.evChargers.length + 1}`;
    updateData({ evChargers: [...data.evChargers, charger] });
  };

  const removeCharger = (id: string) => {
    if (data.evChargers.length <= 1) return;
    updateData({ evChargers: data.evChargers.filter((c) => c.id !== id) });
  };

  const updateCharger = (id: string, updated: EVChargerInfo) => {
    updateData({ evChargers: data.evChargers.map((c) => (c.id === id ? updated : c)) });
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

        <section className="multi-section">
          <div className="multi-section-header">
            <h2>Panels</h2>
            <button type="button" className="btn-add" onClick={addPanel}>
              + Add Panel
            </button>
          </div>
          {data.panels.map((panel, idx) => (
            <MainPanelForm
              key={panel.id}
              data={panel}
              index={idx}
              canRemove={data.panels.length > 1}
              onChange={(updated) => updatePanel(panel.id, updated)}
              onRemove={() => removePanel(panel.id)}
            />
          ))}
        </section>

        <ExistingLoadsForm
          loads={data.existingLoads}
          onChange={(existingLoads) => updateData({ existingLoads })}
        />

        <section className="multi-section">
          <div className="multi-section-header">
            <h2>Proposed EV Chargers</h2>
            <button type="button" className="btn-add" onClick={addCharger}>
              + Add Charger
            </button>
          </div>
          {data.evChargers.map((charger, idx) => (
            <EVChargerForm
              key={charger.id}
              data={charger}
              index={idx}
              canRemove={data.evChargers.length > 1}
              onChange={(updated) => updateCharger(charger.id, updated)}
              onRemove={() => removeCharger(charger.id)}
            />
          ))}
        </section>

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
