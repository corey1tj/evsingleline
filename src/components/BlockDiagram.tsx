import type { SingleLineData, Panel } from '../types';

interface Props {
  data: SingleLineData;
}

function PanelBlock({ panel, allPanels, chargers, loads, data }: {
  panel: Panel;
  allPanels: Panel[];
  chargers: typeof data.evChargers;
  loads: typeof data.existingLoads;
  data: SingleLineData;
}) {
  const children = allPanels.filter((p) => p.parentId === panel.id);
  const panelChargers = chargers.filter((c) => c.panelId === panel.id);
  const panelLoads = loads.filter((l) => l.panelId === panel.id);
  const isMdp = panel.parentId === '';

  return (
    <div className={`block-node ${isMdp ? 'block-mdp' : 'block-sub'}`}>
      <div className={`block-box ${isMdp ? 'mdp' : 'sub-panel'}`}>
        <div className="block-header">
          {isMdp ? 'MDP' : 'SUB-PANEL'}
        </div>
        <div className="block-title">{panel.panelName || (isMdp ? 'Main Distribution Panel' : 'Sub-Panel')}</div>
        <div className="block-details">
          <span className="block-voltage">{panel.busVoltage || '?'}V</span>
          {panel.mainBreakerAmps && <span>{panel.mainBreakerAmps}A</span>}
          {panel.feedBreakerAmps && <span className="block-feed">fed {panel.feedBreakerAmps}A</span>}
        </div>
        {panel.panelMake && (
          <div className="block-make">{panel.panelMake} {panel.panelModel}</div>
        )}
        {panel.availableSpaces && (
          <div className="block-spaces">{panel.availableSpaces}/{panel.totalSpaces} spaces avail</div>
        )}
      </div>

      {/* Chargers and child panels */}
      {(panelChargers.length > 0 || children.length > 0 || panelLoads.length > 0) && (
        <div className="block-children">
          {panelChargers.map((charger) => {
            const isDcfc = charger.chargerLevel === 'Level 3 DCFC';
            const voltage = Number(charger.chargerVoltage) || 0;
            const amps = Number(charger.chargerAmps) || 0;
            const isThreePhase = isDcfc;
            const kw = voltage > 0 && amps > 0
              ? isThreePhase ? (voltage * amps * 1.732) / 1000 : (voltage * amps) / 1000
              : 0;

            return (
              <div key={charger.id} className={`block-node`}>
                <div className={`block-box charger ${isDcfc ? 'dcfc' : ''}`}>
                  <div className="block-header">{isDcfc ? 'DCFC' : charger.chargerLevel || 'CHARGER'}</div>
                  <div className="block-title">{charger.chargerLabel || 'EV Charger'}</div>
                  <div className="block-details">
                    <span className="block-voltage">{charger.chargerVoltage || '?'}V</span>
                    {charger.chargerAmps && <span>{charger.chargerAmps}A</span>}
                    {charger.breakerSize && <span>({charger.breakerSize}A brk)</span>}
                  </div>
                  {kw > 0 && <div className="block-kw">{kw.toFixed(1)} kW</div>}
                  {charger.wireSize && (
                    <div className="block-wire">{charger.wireSize} / {charger.conduitType} / {charger.wireRunFeet}ft</div>
                  )}
                </div>
              </div>
            );
          })}

          {panelLoads.length > 0 && (
            <div className="block-node">
              <div className="block-box existing-loads">
                <div className="block-header">EXISTING LOADS</div>
                <div className="block-title">{panelLoads.length} load{panelLoads.length !== 1 ? 's' : ''}</div>
                <div className="block-details">
                  <span>{panelLoads.reduce((s, l) => s + (Number(l.breakerAmps) || 0), 0)}A total</span>
                </div>
              </div>
            </div>
          )}

          {children.map((child) => (
            <PanelBlock
              key={child.id}
              panel={child}
              allPanels={allPanels}
              chargers={chargers}
              loads={loads}
              data={data}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BlockDiagram({ data }: Props) {
  if (data.services.length === 0) return <p>Add a service to generate a diagram.</p>;

  return (
    <div className="diagram-container block-diagram">
      {/* Utility */}
      <div className="block-node block-root">
        <div className="block-box utility">
          <div className="block-header">UTILITY</div>
          <div className="block-title">
            {data.services.map((s) => s.utilityProvider).filter(Boolean).join(', ') || 'Power Company'}
          </div>
        </div>

        <div className="block-children">
          {data.services.map((svc) => {
            const mdp = data.panels.find((p) => p.serviceId === svc.id && p.parentId === '');
            return (
              <div key={svc.id} className="block-node">
                <div className="block-box service">
                  <div className="block-header">SERVICE</div>
                  <div className="block-title">{svc.serviceName || 'Service'}</div>
                  <div className="block-details">
                    <span className="block-voltage">{svc.serviceVoltage || '?'}</span>
                    <span>{svc.servicePhase === 'three' ? '3\u03A6' : svc.servicePhase === 'single' ? '1\u03A6' : ''}</span>
                    {svc.serviceAmperage && <span>{svc.serviceAmperage}A</span>}
                  </div>
                  {svc.meterNumber && <div className="block-meter">Meter: {svc.meterNumber}</div>}
                </div>

                {mdp && (
                  <div className="block-children">
                    <PanelBlock
                      panel={mdp}
                      allPanels={data.panels}
                      chargers={data.evChargers}
                      loads={data.existingLoads}
                      data={data}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="block-legend">
        <span className="legend-item"><span className="legend-color utility"></span>Utility</span>
        <span className="legend-item"><span className="legend-color service"></span>Service</span>
        <span className="legend-item"><span className="legend-color mdp"></span>MDP</span>
        <span className="legend-item"><span className="legend-color sub-panel"></span>Sub-Panel</span>
        <span className="legend-item"><span className="legend-color charger"></span>L1/L2</span>
        <span className="legend-item"><span className="legend-color dcfc"></span>DCFC</span>
      </div>
    </div>
  );
}
