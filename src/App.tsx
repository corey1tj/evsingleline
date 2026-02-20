import { useState } from 'react';
import { SiteInfoForm } from './components/SiteInfoForm';
import { ServiceEntranceForm } from './components/ServiceEntranceForm';
import { PanelHierarchy } from './components/PanelHierarchy';
import { LoadCalculation } from './components/LoadCalculation';
import { ExportButton } from './components/ExportButton';
import { SingleLineDiagram } from './components/SingleLineDiagram';
import type { SingleLineData, MainPanel, Breaker } from './types';
import { breakerSpaces, nextCircuitNumber, chargerVoltage } from './types';
import { getProfile } from './chargerProfiles';
import './App.css';

const STORAGE_KEY = 'evsingleline_data';

let nextPanelId = 1;
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
    spareSpaces: '',
    condition: 'existing',
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
    condition: 'existing',
    loadType: 'noncontinuous',
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
    parsed.evChargers = [{ ...parsed.evCharger, id: 'legacy_1', chargerLabel: 'EV Charger 1' }];
    delete parsed.evCharger;
  }
  // Ensure panels have breakers array and condition fields
  if (parsed.panels) {
    for (const p of parsed.panels) {
      if (!p.breakers) p.breakers = [];
      if (!p.condition) p.condition = 'existing';
      if (p.spareSpaces === undefined) p.spareSpaces = '';
      for (const b of p.breakers) {
        if (!b.condition) b.condition = b.type === 'evcharger' ? 'new' : 'existing';
        if (!b.loadType) b.loadType = b.type === 'evcharger' ? 'continuous' : 'noncontinuous';
      }
    }
  }
  // Ensure service entrance has condition
  if (parsed.serviceEntrance && !parsed.serviceEntrance.condition) {
    parsed.serviceEntrance.condition = 'existing';
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
  // Migrate old evChargers array into panel breakers
  if (parsed.evChargers && parsed.evChargers.length > 0 && parsed.panels?.length > 0) {
    for (const c of parsed.evChargers) {
      const targetPanel = parsed.panels.find((p: any) => p.id === c.panelId) || parsed.panels[0];
      let circNum = targetPanel.breakers.length + 1;
      // Check if we already migrated (avoid duplicates on re-migrate)
      const alreadyMigrated = targetPanel.breakers.some(
        (b: any) => b.type === 'evcharger' && b.label === (c.chargerLabel || c.label)
      );
      if (!alreadyMigrated) {
        targetPanel.breakers.push({
          id: String(nextBreakerId++),
          circuitNumber: String(circNum++),
          label: c.chargerLabel || '',
          amps: c.breakerSize || '',
          voltage: '240',
          type: 'evcharger',
          chargerLevel: c.chargerLevel || '',
          chargerAmps: c.chargerAmps || '',
          wireRunFeet: c.wireRunFeet || '',
          wireSize: c.wireSize || '',
          conduitType: c.conduitType || '',
          installLocation: c.installLocation || '',
        });
      }
    }
    delete parsed.evChargers;
  }
  // Remove availableSpaces (now computed from breakers)
  if (parsed.panels) {
    for (const p of parsed.panels) {
      delete p.availableSpaces;
    }
  }
  // Ensure evChargers is empty array (all migrated into breakers)
  if (!parsed.evChargers) {
    parsed.evChargers = [];
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
      condition: 'existing',
    },
    panels: [mdp],
    evChargers: [],
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

    if (parentPanelId) {
      const parentPanel = data.panels.find((p) => p.id === parentPanelId);
      const feedCircuitNumber = parentPanel ? nextCircuitNumber(parentPanel.breakers, breakerSpaces('240')) : '';
      const feedBreaker = createBreaker({
        label: panel.panelName,
        type: 'subpanel',
        circuitNumber: feedCircuitNumber,
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

    const toRemove = new Set<string>();
    const collectDescendants = (panelId: string) => {
      toRemove.add(panelId);
      for (const p of data.panels) {
        if (p.parentPanelId === panelId) collectDescendants(p.id);
      }
    };
    collectDescendants(id);

    const panel = data.panels.find((p) => p.id === id);

    let updatedPanels = data.panels.filter((p) => !toRemove.has(p.id));
    if (panel?.parentPanelId && panel?.feedBreakerId) {
      updatedPanels = updatedPanels.map((p) =>
        p.id === panel.parentPanelId
          ? { ...p, breakers: p.breakers.filter((b) => b.id !== panel.feedBreakerId) }
          : p
      );
    }

    updateData({ panels: updatedPanels });
  };

  const updatePanel = (id: string, updated: MainPanel) => {
    let updatedPanels = data.panels.map((p) => (p.id === id ? updated : p));

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
    // Default voltage is 240V (2-pole); use standard panel numbering (N,N+2)
    const defaultSpaces = breakerSpaces('240');
    const circuitNumber = nextCircuitNumber(panel.breakers, defaultSpaces);
    const breaker = createBreaker({ circuitNumber });
    updatePanel(panelId, { ...panel, breakers: [...panel.breakers, breaker] });
  };

  const addEvCharger = (panelId: string, profileId?: string) => {
    const panel = data.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const evCount = data.panels.reduce(
      (sum, p) => sum + p.breakers.filter((b) => b.type === 'evcharger').length,
      0
    );

    const profile = profileId && profileId !== 'custom' ? getProfile(profileId) : undefined;
    const level = profile?.chargerLevel || 'Level 2';
    const autoVoltage = String(chargerVoltage(level, data.serviceEntrance.serviceVoltage));
    const spaces = breakerSpaces(autoVoltage, 'evcharger');

    const breaker = createBreaker({
      circuitNumber: nextCircuitNumber(panel.breakers, spaces),
      label: profile
        ? `${profile.name} #${data.panels.reduce(
            (sum, p) => sum + p.breakers.filter((b) => b.chargerProfileId === profile.id).length, 0
          ) + 1}`
        : `EV Charger ${evCount + 1}`,
      type: 'evcharger',
      condition: 'new',
      loadType: 'continuous',  // NEC 625.40
      voltage: autoVoltage,
      chargerLevel: level,
      ...(profile && {
        chargerProfileId: profile.id,
        chargerAmps: profile.chargerAmps,
        chargerPorts: profile.chargerPorts,
        amps: String(profile.recommendedBreaker),
        chargerOutputKw: profile.outputKw ? String(profile.outputKw) : undefined,
        recommendedBreakerAmps: String(profile.recommendedBreaker),
        minConductor: profile.minConductor,
        recommendedConductor: profile.recommendedConductor,
        wireSize: profile.recommendedConductor || '',
      }),
    });
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

    if (breaker?.type === 'subpanel' && breaker.subPanelId) {
      removePanel(breaker.subPanelId);
      return;
    }

    updatePanel(panelId, {
      ...panel,
      breakers: panel.breakers.filter((b) => b.id !== breakerId),
    });
  };

  // ---- Clear ----

  const handleClear = () => {
    if (window.confirm('Clear all form data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      nextPanelId = 1;
      nextBreakerId = 1;
      setData(getInitialData());
    }
  };

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
              onAddEvCharger={addEvCharger}
              onUpdateBreaker={updateBreaker}
              onRemoveBreaker={removeBreaker}
              onAddSubPanel={(parentId) => addPanel(parentId)}
              depth={0}
            />
          ))}
        </section>

        <LoadCalculation data={data} />

        <SingleLineDiagram data={data} />

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
