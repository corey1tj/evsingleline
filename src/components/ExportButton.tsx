import type { SingleLineData, MainPanel } from '../types';
import { breakerSpaces, totalSpacesUsed, calcKw, chargerVoltage } from '../types';

interface Props {
  data: SingleLineData;
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
      if (b.type === 'subpanel') {
        lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'Sub Panel'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces}sp) [SUB PANEL FEED]`);
      } else if (b.type === 'evcharger') {
        const v = chargerVoltage(b.chargerLevel || '', serviceVoltage);
        const kw = calcKw(String(v), b.chargerAmps || '');
        lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'EV Charger'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces}sp) [EV CHARGER]`);
        if (kw > 0) lines.push(`${indent}    kW Output: ${kw.toFixed(1)} kW (${v}V x ${b.chargerAmps}A)`);
        if (b.chargerLevel) lines.push(`${indent}    Level: ${b.chargerLevel}`);
        if (b.wireSize) lines.push(`${indent}    Wire: ${b.wireSize}, ${b.wireRunFeet || '?'} ft, ${b.conduitType || '?'}`);
        if (b.installLocation) lines.push(`${indent}    Location: ${b.installLocation}`);
      } else {
        lines.push(`${indent}  Ckt ${b.circuitNumber || '?'}: ${b.label || 'Unnamed'} - ${b.amps || '?'}A @ ${b.voltage}V (${spaces}sp)`);
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

  lines.push('SERVICE ENTRANCE');
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
