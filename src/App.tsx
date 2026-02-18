import { useState } from 'react';
import { SiteInfoForm } from './components/SiteInfoForm';
import { ServiceEntranceForm } from './components/ServiceEntranceForm';
import { PanelHierarchy } from './components/PanelHierarchy';
import { EVChargerForm } from './components/EVChargerForm';
import { LoadCalculation } from './components/LoadCalculation';
import { ExportButton } from './components/ExportButton';
import type { SingleLineData, MainPanel, EVChargerInfo, Breaker } from './types';
import './App.css';

const STORAGE_KEY = 'evsingleline_data';

let nextPanelId = 1;
let nextChargerId = 1;
let nextBreakerId = 1;

function createPanel(overrides?: Partial<MainPanel>): MainPanel {
  return {
    id: String(nextPanelId++),
    panelName: '',
    panelLocation: '',
    panelMake: '',
    panelModel: '',
    mainBreakerAmps: '',
    busRatingAmps: '',
    totalSpaces: '',
    breakers: [],
    ...overrides,
  };
}

function createBreaker(overrides?: Partial<Breaker>): Breaker {
  return {
    id: String(nextBreakerId++),
    circuitNumber: '',
    label: '',
    amps: '',
    voltage: '240',
    type: 'load',
    ...overrides,
  };
}

function createCharger(overrides?: Partial<EVChargerInfo>): EVChargerInfo {
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
    panelId: '',
    ...overrides,
  };
}

function syncIds(data: SingleLineData) {
  for (const p of data.panels) {
    const num = Number(p.id);
    if (num >= nextPanelId) nextPanelId = num + 1;
    if (p.breakers) {
      for (const b of p.breakers) {
        const bnum = Number(b.id);
        if (bnum >= nextBreakerId) nextBreakerId = bnum + 1;
      }
    }
  }
  for (const c of data.evChargers) {
    const num = Number(c.id);
    if (num >= nextChargerId) nextChargerId = num + 1;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateData(parsed: any): SingleLineData {
  // Migrate old single-panel format
  if (parsed.mainPanel && !parsed.panels) {
    parsed.panels = [{ ...parsed.mainPanel, id: String(nextPanelId++), panelName: 'MDP' }];
    delete parsed.mainPanel;
  }
  // Migrate old single-charger format
  if (parsed.evCharger && !parsed.evChargers) {
    parsed.evChargers = [{ ...parsed.evCharger, id: String(nextChargerId++), chargerLabel: 'EV Charger 1' }];
    delete parsed.evCharger;
  }
  // Ensure panels have breakers array
  if (parsed.panels) {
    for (const p of parsed.panels) {
      if (!p.breakers) p.breakers = [];
    }
  }
  // Migrate old existingLoads into the first panel's breakers
  if (parsed.existingLoads && parsed.existingLoads.length > 0 && parsed.panels?.length > 0) {
    const firstPanel = parsed.panels[0];
    let circNum = firstPanel.breakers.length + 1;
    for (const load of parsed.existingLoads) {
      firstPanel.breakers.push({
        id: String(nextBreakerId++),
        circuitNumber: String(circNum++),
        label: load.name || '',
        amps: load.breakerAmps || '',
        voltage: load.voltage || '240',
        type: 'load',
      });
    }
    delete parsed.existingLoads;
  }
  // Ensure evChargers have panelId
  if (parsed.evChargers) {
    const firstPanelId = parsed.panels?.[0]?.id || '';
    for (const c of parsed.evChargers) {
      if (!c.panelId) c.panelId = firstPanelId;
    }
  }
  // Remove availableSpaces (now computed from breakers)
  if (parsed.panels) {
    for (const p of parsed.panels) {
      delete p.availableSpaces;
    }
  }
  return parsed as SingleLineData;
}

function getInitialData(): SingleLineData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const data = migrateData(parsed);
      syncIds(data);
      return data;
    }
  } catch {
    // ignore
  }
  const mdp = createPanel({ panelName: 'MDP' });
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
    panels: [mdp],
    evChargers: [createCharger({ chargerLabel: 'EV Charger 1', panelId: mdp.id })],
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

  // ---- Panel CRUD ----

  const addPanel = (parentPanelId?: string) => {
    const panel = createPanel({
      panelName: parentPanelId ? `Sub Panel ${data.panels.length}` : `Panel ${data.panels.length + 1}`,
      parentPanelId,
    });

    let updatedPanels = [...data.panels, panel];

    // If adding as a sub-panel, create a breaker on the parent that feeds it
    if (parentPanelId) {
      const feedBreaker = createBreaker({
        label: panel.panelName,
        type: 'subpanel',
        subPanelId: panel.id,
      });
      panel.feedBreakerId = feedBreaker.id;
      updatedPanels = updatedPanels.map((p) =>
        p.id === parentPanelId
          ? { ...p, breakers: [...p.breakers, feedBreaker] }
          : p.id === panel.id
            ? { ...panel }
            : p
      );
    }

    updateData({ panels: updatedPanels });
  };

  const removePanel = (id: string) => {
    if (data.panels.length <= 1) return;

    // Collect all descendant panel ids
    const toRemove = new Set<string>();
    const collectDescendants = (panelId: string) => {
      toRemove.add(panelId);
      for (const p of data.panels) {
        if (p.parentPanelId === panelId) collectDescendants(p.id);
      }
    };
    collectDescendants(id);

    const panel = data.panels.find((p) => p.id === id);

    // Remove the feed breaker from parent
    let updatedPanels = data.panels.filter((p) => !toRemove.has(p.id));
    if (panel?.parentPanelId && panel?.feedBreakerId) {
      updatedPanels = updatedPanels.map((p) =>
        p.id === panel.parentPanelId
          ? { ...p, breakers: p.breakers.filter((b) => b.id !== panel.feedBreakerId) }
          : p
      );
    }

    // Reassign any chargers on removed panels to first remaining panel
    const firstRemainingId = updatedPanels[0]?.id || '';
    const updatedChargers = data.evChargers.map((c) =>
      toRemove.has(c.panelId) ? { ...c, panelId: firstRemainingId } : c
    );

    updateData({ panels: updatedPanels, evChargers: updatedChargers });
  };

  const updatePanel = (id: string, updated: MainPanel) => {
    let updatedPanels = data.panels.map((p) => (p.id === id ? updated : p));

    // If panel name changed, also update the feed breaker label on parent
    if (updated.parentPanelId && updated.feedBreakerId) {
      updatedPanels = updatedPanels.map((p) =>
        p.id === updated.parentPanelId
          ? {
              ...p,
              breakers: p.breakers.map((b) =>
                b.id === updated.feedBreakerId ? { ...b, label: updated.panelName } : b
              ),
            }
          : p
      );
    }

    updateData({ panels: updatedPanels });
  };

  // ---- Breaker CRUD ----

  const addBreaker = (panelId: string) => {
    const panel = data.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const nextCircuit = panel.breakers.length > 0
      ? String(Math.max(...panel.breakers.map((b) => Number(b.circuitNumber) || 0)) + 1)
      : '1';
    const breaker = createBreaker({ circuitNumber: nextCircuit });
    updatePanel(panelId, { ...panel, breakers: [...panel.breakers, breaker] });
  };

  const updateBreaker = (panelId: string, breakerId: string, updated: Breaker) => {
    const panel = data.panels.find((p) => p.id === panelId);
    if (!panel) return;
    updatePanel(panelId, {
      ...panel,
      breakers: panel.breakers.map((b) => (b.id === breakerId ? updated : b)),
    });
  };

  const removeBreaker = (panelId: string, breakerId: string) => {
    const panel = data.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const breaker = panel.breakers.find((b) => b.id === breakerId);

    // If the breaker feeds a sub-panel, remove the sub-panel too
    if (breaker?.type === 'subpanel' && breaker.subPanelId) {
      removePanel(breaker.subPanelId);
      return; // removePanel already removes the breaker
    }

    updatePanel(panelId, {
      ...panel,
      breakers: panel.breakers.filter((b) => b.id !== breakerId),
    });
  };

  // ---- Charger CRUD ----

  const addCharger = () => {
    const charger = createCharger({
      chargerLabel: `EV Charger ${data.evChargers.length + 1}`,
      panelId: data.panels[0]?.id || '',
    });
    updateData({ evChargers: [...data.evChargers, charger] });
  };

  const removeCharger = (id: string) => {
    if (data.evChargers.length <= 1) return;
    updateData({ evChargers: data.evChargers.filter((c) => c.id !== id) });
  };

  const updateCharger = (id: string, updated: EVChargerInfo) => {
    updateData({ evChargers: data.evChargers.map((c) => (c.id === id ? updated : c)) });
  };

  // ---- Clear ----

  const handleClear = () => {
    if (window.confirm('Clear all form data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      nextPanelId = 1;
      nextChargerId = 1;
      nextBreakerId = 1;
      setData(getInitialData());
    }
  };

  // Build hierarchy: get root panels (no parent)
  const rootPanels = data.panels.filter((p) => !p.parentPanelId);

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
            <h2>Panels & Breakers</h2>
            <button type="button" className="btn-add" onClick={() => addPanel()}>
              + Add Panel
            </button>
          </div>
          {rootPanels.map((panel, idx) => (
            <PanelHierarchy
              key={panel.id}
              panel={panel}
              index={idx}
              allPanels={data.panels}
              serviceVoltage={data.serviceEntrance.serviceVoltage}
              canRemove={data.panels.length > 1}
              onUpdatePanel={updatePanel}
              onRemovePanel={removePanel}
              onAddBreaker={addBreaker}
              onUpdateBreaker={updateBreaker}
              onRemoveBreaker={removeBreaker}
              onAddSubPanel={(parentId) => addPanel(parentId)}
              depth={0}
            />
          ))}
        </section>

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
              panels={data.panels}
              serviceVoltage={data.serviceEntrance.serviceVoltage}
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
