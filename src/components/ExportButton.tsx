import type { SingleLineData, MainPanel } from '../types';
import { breakerSpaces, totalSpacesUsed, getEffectivePanelVoltage, transformerFLA, necDemandAmps, evChargerKw, breakerKva } from '../types';
import { PdfExportButton } from './PdfExportButton';

interface Props {
  data: SingleLineData;
}

function formatPanel(panel: MainPanel, allPanels: MainPanel[], indent: string, serviceVoltage: string, lines: string[]) {
  const label = panel.panelName || 'Panel';
  const effectiveVoltage = getEffectivePanelVoltage(panel, allPanels, serviceVoltage);
  const voltageNote = panel.transformer ? ` [${effectiveVoltage} via Transformer]` : '';
  const conditionNote = panel.condition === 'new' ? ' [NEW]' : '';

  lines.push(`${indent}${label.toUpperCase()}${voltageNote}${conditionNote}`);
  lines.push(`${indent}${'-'.repeat(30)}`);
  lines.push(`${indent}Location: ${panel.panelLocation}`);
  lines.push(`${indent}Make/Model: ${panel.panelMake} ${panel.panelModel}`);
  lines.push(`${indent}Main Breaker: ${panel.mainBreakerAmps}A`);
  lines.push(`${indent}Bus Rating: ${panel.busRatingAmps}A`);

  // Transformer info
  if (panel.transformer) {
    const kva = Number(panel.transformer.kva) || 0;
    const primaryFLA = transformerFLA(kva, panel.transformer.primaryVoltage);
    const secondaryFLA = transformerFLA(kva, panel.transformer.secondaryVoltage);
    lines.push(`${indent}Transformer: ${kva > 0 ? `${kva} kVA` : '--'}`);
    lines.push(`${indent}  Primary: ${panel.transformer.primaryVoltage}${primaryFLA > 0 ? ` (${primaryFLA.toFixed(1)}A FLA)` : ''}`);
    lines.push(`${indent}  Secondary: ${panel.transformer.secondaryVoltage}${secondaryFLA > 0 ? ` (${secondaryFLA.toFixed(1)}A FLA)` : ''}`);
  }

  const totalSp = Number(panel.totalSpaces) || 0;
  const used = totalSpacesUsed(panel.breakers);
  const spare = Number(panel.spareSpaces) || 0;
  const accounted = used + spare;
  lines.push(`${indent}Spaces: ${accounted} of ${totalSp} accounted (${used} breakers${spare > 0 ? ` + ${spare} spare` : ''})`);

  if (panel.breakers.length > 0) {
    lines.push(`${indent}Breakers:`);
    for (const b of panel.breakers) {
      const spaces = breakerSpaces(b.voltage, b.type);
      const cond = b.condition === 'new' ? ' [NEW]' : '';
      const loadLabel = b.loadType === 'continuous' ? ' [CONT]' : '';
      if (b.type === 'subpanel') {
        lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'Sub Panel'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces}sp) [SUB PANEL FEED]${cond}`);
      } else if (b.type === 'evcharger') {
        const kw = evChargerKw(b);
        const ports = Number(b.chargerPorts) || 0;
        lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'EV Charger'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces}sp) [EV CHARGER${b.chargerLevel === 'Level 3' ? ' DCFC' : ''}]${loadLabel}${cond}`);
        if (kw > 0) lines.push(`${indent}    kW Input: ${kw.toFixed(1)} kW (${b.voltage}V × ${b.chargerAmps}A${b.chargerLevel === 'Level 3' ? ' × √3' : ''})`);
        if (b.chargerLevel) lines.push(`${indent}    Level: ${b.chargerLevel}`);
        if (ports > 0) lines.push(`${indent}    Ports: ${ports}`);
        if (b.wireSize) lines.push(`${indent}    Wire: ${b.wireSize}, ${b.wireRunFeet || '?'} ft, ${b.conduitType || '?'}`);
        if (b.installLocation) lines.push(`${indent}    Location: ${b.installLocation}`);
      } else {
        const bkw = breakerKva(b);
        lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'Unnamed'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces}sp)${bkw > 0 ? ` ${bkw.toFixed(1)}kW` : ''}${loadLabel}${cond}`);
      }
    }
  }

  lines.push('');

  const children = allPanels.filter((p) => p.parentPanelId === panel.id);
  for (const child of children) {
    formatPanel(child, allPanels, indent + '  ', serviceVoltage, lines);
  }
}

function formatData(data: SingleLineData): string {
  const lines: string[] = [];
  const sv = data.serviceEntrance.serviceVoltage;

  lines.push('EV CHARGER INSTALLATION - ELECTRICAL ONE-LINE SURVEY');
  lines.push('='.repeat(55));
  lines.push('');

  lines.push('SITE INFORMATION');
  lines.push('-'.repeat(30));
  lines.push(`Customer: ${data.siteInfo.customerName}`);
  lines.push(`Address: ${data.siteInfo.address}`);
  lines.push(`City/State/ZIP: ${data.siteInfo.city}, ${data.siteInfo.state} ${data.siteInfo.zip}`);
  lines.push(`Survey Date: ${data.siteInfo.surveyDate}`);
  lines.push(`Technician: ${data.siteInfo.technicianName}`);
  if (data.siteInfo.notes) {
    lines.push(`Notes: ${data.siteInfo.notes}`);
  }
  lines.push('');

  lines.push(`SERVICE ENTRANCE${data.serviceEntrance.condition === 'new' ? ' [NEW]' : ''}`);
  lines.push('-'.repeat(30));
  lines.push(`Utility: ${data.serviceEntrance.utilityProvider}`);
  lines.push(`Voltage: ${data.serviceEntrance.serviceVoltage}`);
  lines.push(`Phase: ${data.serviceEntrance.servicePhase}`);
  lines.push(`Service Amps: ${data.serviceEntrance.serviceAmperage}A`);
  lines.push(`Meter #: ${data.serviceEntrance.meterNumber}`);
  lines.push('');

  const rootPanels = data.panels.filter((p) => !p.parentPanelId);
  for (const panel of rootPanels) {
    formatPanel(panel, data.panels, '', sv, lines);
  }

  // NEC Demand Calculation
  const allBreakers = data.panels.flatMap((p) => p.breakers.filter((b) => b.type !== 'subpanel'));
  const demand = necDemandAmps(allBreakers);
  const allEv = allBreakers.filter((b) => b.type === 'evcharger');
  const peakKwLoads = allBreakers
    .filter((b) => b.type !== 'evcharger')
    .reduce((sum, b) => sum + ((Number(b.voltage) || 0) * (Number(b.amps) || 0)) / 1000, 0);
  const peakKwEv = allEv.reduce((sum, b) => sum + evChargerKw(b), 0);

  lines.push('NEC DEMAND CALCULATION');
  lines.push('-'.repeat(30));
  lines.push(`Continuous Loads: ${demand.continuous}A x 1.25 = ${Math.ceil(demand.continuous * 1.25)}A`);
  lines.push(`Non-Continuous Loads: ${demand.nonContinuous}A x 1.0 = ${demand.nonContinuous}A`);
  lines.push(`NEC Total Demand: ${demand.totalDemand}A`);
  lines.push('');
  lines.push('PEAK kW DEMAND');
  lines.push('-'.repeat(30));
  lines.push(`General Loads: ${peakKwLoads.toFixed(1)} kW`);
  if (allEv.length > 0) {
    lines.push(`EV Chargers (output): ${peakKwEv.toFixed(1)} kW`);
  }
  lines.push(`Total Peak Demand: ${(peakKwLoads + peakKwEv).toFixed(1)} kW`);
  lines.push('');

  return lines.join('\n');
}

export function ExportButton({ data }: Props) {
  const handleExport = () => {
    const text = formatData(data);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = data.siteInfo.customerName || 'survey';
    a.download = `${name.replace(/\s+/g, '_')}_single_line.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = data.siteInfo.customerName || 'survey';
    a.download = `${name.replace(/\s+/g, '_')}_single_line.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="export-buttons">
      <PdfExportButton data={data} />
      <button type="button" className="btn-export" onClick={handleExport}>
        Export as Text
      </button>
      <button type="button" className="btn-export btn-export-secondary" onClick={handleExportJSON}>
        Export as JSON
      </button>
    </div>
  );
}
