import { useState } from 'react';
import { SiteInfoForm } from './components/SiteInfoForm';
import { ServiceEntranceForm } from './components/ServiceEntranceForm';
import { MainPanelForm } from './components/MainPanelForm';
import { ExistingLoadsForm } from './components/ExistingLoadsForm';
import { EVChargerForm } from './components/EVChargerForm';
import { LoadCalculation } from './components/LoadCalculation';
import { ExportButton } from './components/ExportButton';
import { SingleLineDiagram } from './components/SingleLineDiagram';
import { BlockDiagram } from './components/BlockDiagram';
import type { SingleLineData, ElectricalService, Panel, EVChargerInfo } from './types';
import { busVoltageFromService } from './types';
import './App.css';

const STORAGE_KEY = 'evsingleline_data';

let nextServiceId = 1;
let nextPanelId = 1;
let nextChargerId = 1;

function createService(): ElectricalService {
  return {
    id: String(nextServiceId++),
    serviceName: '',
    utilityProvider: '',
    serviceVoltage: '',
    servicePhase: '',
    serviceAmperage: '',
    meterNumber: '',
  };
}

function createPanel(serviceId: string, parentId: string, busVoltage: string): Panel {
  return {
    id: String(nextPanelId++),
    serviceId,
    parentId,
    feedBreakerAmps: '',
    panelName: '',
    panelLocation: '',
    panelMake: '',
    panelModel: '',
    mainBreakerAmps: '',
    busRatingAmps: '',
    busVoltage,
    totalSpaces: '',
    availableSpaces: '',
  };
}

function createCharger(panelId: string): EVChargerInfo {
  return {
    id: String(nextChargerId++),
    panelId,
    chargerLabel: '',
    chargerLevel: '',
    chargerAmps: '',
    breakerSize: '',
    chargerVoltage: '',
    wireRunFeet: '',
    wireSize: '',
    conduitType: '',
    installLocation: '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateData(parsed: any): SingleLineData {
  // Already new format
  if (parsed.services) {
    // Ensure IDs don't collide
    for (const s of parsed.services) {
      const num = Number(s.id);
      if (num >= nextServiceId) nextServiceId = num + 1;
    }
    for (const p of parsed.panels) {
      const num = Number(p.id);
      if (num >= nextPanelId) nextPanelId = num + 1;
    }
    for (const c of parsed.evChargers) {
      const num = Number(c.id);
      if (num >= nextChargerId) nextChargerId = num + 1;
    }
    return parsed as SingleLineData;
  }

  // Migrate from old format (serviceEntrance + panels[] without hierarchy)
  const serviceId = String(nextServiceId++);
  const oldService = parsed.serviceEntrance || {};
  const service: ElectricalService = {
    id: serviceId,
    serviceName: 'Main Service',
    utilityProvider: oldService.utilityProvider || '',
    serviceVoltage: oldService.serviceVoltage || '',
    servicePhase: oldService.servicePhase || '',
    serviceAmperage: oldService.serviceAmperage || '',
    meterNumber: oldService.meterNumber || '',
  };

  const bv = busVoltageFromService(service.serviceVoltage);

  // Migrate old mainPanel / panels
  const oldPanels = parsed.panels || (parsed.mainPanel ? [parsed.mainPanel] : []);
  const newPanels: Panel[] = [];
  let mdpId = '';
  for (let i = 0; i < oldPanels.length; i++) {
    const op = oldPanels[i];
    const pid = op.id || String(nextPanelId++);
    const num = Number(pid);
    if (num >= nextPanelId) nextPanelId = num + 1;
    const panel: Panel = {
      id: pid,
      serviceId,
      parentId: i === 0 ? '' : mdpId,
      feedBreakerAmps: op.feedBreakerAmps || '',
      panelName: op.panelName || (i === 0 ? 'MDP' : `Panel ${i + 1}`),
      panelLocation: op.panelLocation || '',
      panelMake: op.panelMake || '',
      panelModel: op.panelModel || '',
      mainBreakerAmps: op.mainBreakerAmps || '',
      busRatingAmps: op.busRatingAmps || '',
      busVoltage: op.busVoltage || bv,
      totalSpaces: op.totalSpaces || '',
      availableSpaces: op.availableSpaces || '',
    };
    if (i === 0) mdpId = pid;
    newPanels.push(panel);
  }

  // Migrate old chargers
  const oldChargers = parsed.evChargers || (parsed.evCharger ? [parsed.evCharger] : []);
  const newChargers: EVChargerInfo[] = oldChargers.map((oc: Record<string, string>) => {
    const cid = oc.id || String(nextChargerId++);
    const num = Number(cid);
    if (num >= nextChargerId) nextChargerId = num + 1;
    return {
      id: cid,
      panelId: mdpId,
      chargerLabel: oc.chargerLabel || '',
      chargerLevel: oc.chargerLevel || '',
      chargerAmps: oc.chargerAmps || '',
      breakerSize: oc.breakerSize || '',
      chargerVoltage: oc.chargerVoltage || '',
      wireRunFeet: oc.wireRunFeet || '',
      wireSize: oc.wireSize || '',
      conduitType: oc.conduitType || '',
      installLocation: oc.installLocation || '',
    };
  });

  // Migrate existing loads
  const oldLoads = parsed.existingLoads || [];
  const newLoads = oldLoads.map((ol: Record<string, string>) => ({
    ...ol,
    panelId: ol.panelId || mdpId,
  }));

  return {
    siteInfo: parsed.siteInfo || {
      customerName: '', address: '', city: '', state: '', zip: '',
      surveyDate: '', technicianName: '', notes: '',
    },
    services: [service],
    panels: newPanels.length > 0 ? newPanels : [{ ...createPanel(serviceId, '', bv), panelName: 'MDP' }],
    existingLoads: newLoads,
    evChargers: newChargers.length > 0 ? newChargers : [{ ...createCharger(mdpId || '1'), chargerLabel: 'EV Charger 1' }],
  };
}

function getInitialData(): SingleLineData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return migrateData(JSON.parse(saved));
    }
  } catch {
    // ignore
  }
  const serviceId = String(nextServiceId++);
  const mdpId = String(nextPanelId++);
  return {
    siteInfo: {
      customerName: '', address: '', city: '', state: '', zip: '',
      surveyDate: '', technicianName: '', notes: '',
    },
    services: [{ ...createService(), id: serviceId, serviceName: 'Main Service' }],
    panels: [{ ...createPanel(serviceId, '', ''), id: mdpId, panelName: 'MDP' }],
    existingLoads: [],
    evChargers: [{ ...createCharger(mdpId), chargerLabel: 'EV Charger 1' }],
  };
}

function App() {
  const [data, setData] = useState<SingleLineData>(getInitialData);
  const [diagramView, setDiagramView] = useState<'none' | 'svg' | 'block'>('none');

  const updateData = (patch: Partial<SingleLineData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ── Service CRUD ──
  const addService = () => {
    const svc = createService();
    svc.serviceName = `Service ${data.services.length + 1}`;
    const mdp = createPanel(svc.id, '', '');
    mdp.panelName = `MDP (${svc.serviceName})`;
    const charger = createCharger(mdp.id);
    charger.chargerLabel = `EV Charger ${data.evChargers.length + 1}`;
    updateData({
      services: [...data.services, svc],
      panels: [...data.panels, mdp],
      evChargers: [...data.evChargers, charger],
    });
  };

  const removeService = (id: string) => {
    if (data.services.length <= 1) return;
    const panelIds = data.panels.filter((p) => p.serviceId === id).map((p) => p.id);
    updateData({
      services: data.services.filter((s) => s.id !== id),
      panels: data.panels.filter((p) => p.serviceId !== id),
      existingLoads: data.existingLoads.filter((l) => !panelIds.includes(l.panelId)),
      evChargers: data.evChargers.filter((c) => !panelIds.includes(c.panelId)),
    });
  };

  const updateService = (id: string, updated: ElectricalService) => {
    // When service voltage changes, cascade bus voltage to MDP
    const old = data.services.find((s) => s.id === id);
    let panels = data.panels;
    if (old && old.serviceVoltage !== updated.serviceVoltage) {
      const newBv = busVoltageFromService(updated.serviceVoltage);
      panels = panels.map((p) => {
        if (p.serviceId === id && p.parentId === '') {
          return { ...p, busVoltage: newBv };
        }
        return p;
      });
    }
    updateData({
      services: data.services.map((s) => (s.id === id ? updated : s)),
      panels,
    });
  };

  // ── Panel CRUD ──
  const addPanel = (serviceId: string, parentId: string, parentBusVoltage: string) => {
    const panel = createPanel(serviceId, parentId, parentBusVoltage);
    panel.panelName = `Panel ${data.panels.length + 1}`;
    updateData({ panels: [...data.panels, panel] });
  };

  const removePanel = (id: string) => {
    // Don't allow removing the only MDP for a service
    const panel = data.panels.find((p) => p.id === id);
    if (!panel) return;
    if (panel.parentId === '') {
      const serviceMdps = data.panels.filter((p) => p.serviceId === panel.serviceId && p.parentId === '');
      if (serviceMdps.length <= 1) return;
    }
    // Collect this panel and all descendant panels
    const toRemove = new Set<string>();
    const collect = (pid: string) => {
      toRemove.add(pid);
      data.panels.filter((p) => p.parentId === pid).forEach((p) => collect(p.id));
    };
    collect(id);
    updateData({
      panels: data.panels.filter((p) => !toRemove.has(p.id)),
      existingLoads: data.existingLoads.filter((l) => !toRemove.has(l.panelId)),
      evChargers: data.evChargers.filter((c) => !toRemove.has(c.panelId)),
    });
  };

  const updatePanel = (id: string, updated: Panel) => {
    updateData({ panels: data.panels.map((p) => (p.id === id ? updated : p)) });
  };

  // ── Charger CRUD ──
  const addCharger = (panelId: string) => {
    const charger = createCharger(panelId);
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
      nextServiceId = 1;
      nextPanelId = 1;
      nextChargerId = 1;
      setData(getInitialData());
    }
  };

  // ── Helpers for rendering ──
  const getMdp = (serviceId: string) => data.panels.find((p) => p.serviceId === serviceId && p.parentId === '');
  const getChildPanels = (parentId: string) => data.panels.filter((p) => p.parentId === parentId);
  const getPanelChargers = (panelId: string) => data.evChargers.filter((c) => c.panelId === panelId);
  const canRemoveMdp = (serviceId: string) =>
    data.panels.filter((p) => p.serviceId === serviceId && p.parentId === '').length > 1;

  // Render panel tree recursively
  const renderPanelTree = (panel: Panel, depth: number) => {
    const children = getChildPanels(panel.id);
    const chargers = getPanelChargers(panel.id);
    const canRemove = panel.parentId !== '' || canRemoveMdp(panel.serviceId);

    return (
      <div key={panel.id} className={`panel-tree-node depth-${Math.min(depth, 3)}`}>
        <MainPanelForm
          data={panel}
          isMdp={panel.parentId === ''}
          canRemove={canRemove}
          allPanels={data.panels}
          services={data.services}
          onChange={(updated) => updatePanel(panel.id, updated)}
          onRemove={() => removePanel(panel.id)}
        />

        {/* Chargers in this panel */}
        {chargers.length > 0 && (
          <div className="panel-chargers">
            {chargers.map((charger, idx) => (
              <EVChargerForm
                key={charger.id}
                data={charger}
                index={idx}
                panelBusVoltage={panel.busVoltage}
                canRemove={data.evChargers.length > 1}
                onChange={(updated) => updateCharger(charger.id, updated)}
                onRemove={() => removeCharger(charger.id)}
              />
            ))}
          </div>
        )}

        <div className="panel-actions">
          <button type="button" className="btn-add btn-sm" onClick={() => addCharger(panel.id)}>
            + Charger
          </button>
          <button
            type="button"
            className="btn-add btn-sm btn-sub"
            onClick={() => addPanel(panel.serviceId, panel.id, panel.busVoltage)}
          >
            + Sub-Panel
          </button>
        </div>

        {/* Child panels (sub-panels) */}
        {children.map((child) => renderPanelTree(child, depth + 1))}
      </div>
    );
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

        {/* Services + Hierarchical Panels */}
        {data.services.map((svc) => {
          const mdp = getMdp(svc.id);
          return (
            <section key={svc.id} className="service-section">
              <ServiceEntranceForm
                data={svc}
                canRemove={data.services.length > 1}
                onChange={(updated) => updateService(svc.id, updated)}
                onRemove={() => removeService(svc.id)}
              />
              {mdp && (
                <div className="service-panels">
                  {renderPanelTree(mdp, 0)}
                </div>
              )}
            </section>
          );
        })}

        <div className="multi-section-header">
          <h2>Services</h2>
          <button type="button" className="btn-add" onClick={addService}>
            + Add Service
          </button>
        </div>

        <ExistingLoadsForm
          loads={data.existingLoads}
          panels={data.panels}
          onChange={(existingLoads) => updateData({ existingLoads })}
        />

        <LoadCalculation data={data} />

        {/* Diagram toggle */}
        <fieldset>
          <legend>Electrical Diagram</legend>
          <div className="diagram-toggle">
            <button
              type="button"
              className={`btn-diagram ${diagramView === 'svg' ? 'active' : ''}`}
              onClick={() => setDiagramView(diagramView === 'svg' ? 'none' : 'svg')}
            >
              SVG Single-Line Diagram
            </button>
            <button
              type="button"
              className={`btn-diagram ${diagramView === 'block' ? 'active' : ''}`}
              onClick={() => setDiagramView(diagramView === 'block' ? 'none' : 'block')}
            >
              Block Diagram
            </button>
          </div>
          {diagramView === 'svg' && <SingleLineDiagram data={data} />}
          {diagramView === 'block' && <BlockDiagram data={data} />}
        </fieldset>

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
