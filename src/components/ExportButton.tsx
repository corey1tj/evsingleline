import type { SingleLineData, MainPanel } from '../types';
import { breakerSpaces, totalSpacesUsed, calcKw } from '../types';

interface Props {
  data: SingleLineData;
}

function chargerVoltage(level: string, serviceVoltage: string): number {
  if (level === 'Level 1') return 120;
  switch (serviceVoltage) {
    case '120/208V': return 208;
    case '277/480V': return 480;
    default: return 240;
  }
}

function formatPanel(panel: MainPanel, allPanels: MainPanel[], indent: string, serviceVoltage: string, lines: string[]) {
  const label = panel.panelName || 'Panel';
  lines.push(`${indent}${label.toUpperCase()}`);
  lines.push(`${indent}${'-'.repeat(30)}`);
  lines.push(`${indent}Location: ${panel.panelLocation}`);
  lines.push(`${indent}Make/Model: ${panel.panelMake} ${panel.panelModel}`);
  lines.push(`${indent}Main Breaker: ${panel.mainBreakerAmps}A`);
  lines.push(`${indent}Bus Rating: ${panel.busRatingAmps}A`);

  const totalSp = Number(panel.totalSpaces) || 0;
  const used = totalSpacesUsed(panel.breakers);
  const available = totalSp - used;
  lines.push(`${indent}Spaces: ${used} used / ${available} available of ${totalSp} total`);

  if (panel.breakers.length > 0) {
    lines.push(`${indent}Breakers:`);
    for (const b of panel.breakers) {
      const spaces = breakerSpaces(b.voltage);
      const typeTag = b.type === 'subpanel' ? ' [SUB PANEL FEED]' : '';
      lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'Unnamed'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces} space${spaces > 1 ? 's' : ''})${typeTag}`);
    }
  }

  lines.push('');

  // Recurse into child panels
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

  lines.push('SERVICE ENTRANCE');
  lines.push('-'.repeat(30));
  lines.push(`Utility: ${data.serviceEntrance.utilityProvider}`);
  lines.push(`Voltage: ${data.serviceEntrance.serviceVoltage}`);
  lines.push(`Phase: ${data.serviceEntrance.servicePhase}`);
  lines.push(`Service Amps: ${data.serviceEntrance.serviceAmperage}A`);
  lines.push(`Meter #: ${data.serviceEntrance.meterNumber}`);
  lines.push('');

  // Render panel hierarchy starting from root panels
  const rootPanels = data.panels.filter((p) => !p.parentPanelId);
  for (const panel of rootPanels) {
    formatPanel(panel, data.panels, '', sv, lines);
  }

  for (let i = 0; i < data.evChargers.length; i++) {
    const charger = data.evChargers[i];
    const label = charger.chargerLabel || `EV Charger ${i + 1}`;
    const panelName = data.panels.find((p) => p.id === charger.panelId)?.panelName || '';
    const voltage = chargerVoltage(charger.chargerLevel, sv);
    const kw = calcKw(String(voltage), charger.chargerAmps);

    lines.push(`PROPOSED ${label.toUpperCase()}`);
    lines.push('-'.repeat(30));
    lines.push(`Level: ${charger.chargerLevel}`);
    lines.push(`Charger Amps: ${charger.chargerAmps}A`);
    lines.push(`Breaker Size: ${charger.breakerSize}A`);
    if (kw > 0) {
      lines.push(`kW Output: ${kw.toFixed(1)} kW (${voltage}V x ${charger.chargerAmps}A)`);
    }
    if (panelName) {
      lines.push(`Connected Panel: ${panelName}`);
    }
    lines.push(`Wire Run: ${charger.wireRunFeet} ft`);
    lines.push(`Wire Size: ${charger.wireSize}`);
    lines.push(`Conduit: ${charger.conduitType}`);
    lines.push(`Install Location: ${charger.installLocation}`);
    lines.push('');
  }

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
      <button type="button" className="btn-export" onClick={handleExport}>
        Export as Text
      </button>
      <button type="button" className="btn-export" onClick={handleExportJSON}>
        Export as JSON
      </button>
    </div>
  );
}
