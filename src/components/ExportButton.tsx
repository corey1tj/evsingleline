import type { SingleLineData, Panel } from '../types';
import { minBreakerForContinuousLoad } from '../types';

interface Props {
  data: SingleLineData;
}

function formatData(data: SingleLineData): string {
  const lines: string[] = [];

  lines.push('EV CHARGER INSTALLATION - ELECTRICAL ONE-LINE SURVEY');
  lines.push('='.repeat(60));
  lines.push('');

  // Site info
  lines.push('SITE INFORMATION');
  lines.push('-'.repeat(40));
  lines.push(`Customer: ${data.siteInfo.customerName}`);
  lines.push(`Address: ${data.siteInfo.address}`);
  lines.push(`City/State/ZIP: ${data.siteInfo.city}, ${data.siteInfo.state} ${data.siteInfo.zip}`);
  lines.push(`Survey Date: ${data.siteInfo.surveyDate}`);
  lines.push(`Technician: ${data.siteInfo.technicianName}`);
  if (data.siteInfo.notes) {
    lines.push(`Notes: ${data.siteInfo.notes}`);
  }
  lines.push('');

  // Per-service hierarchy
  for (const svc of data.services) {
    lines.push(`SERVICE: ${svc.serviceName || 'Unnamed Service'}`);
    lines.push('='.repeat(40));
    lines.push(`  Utility: ${svc.utilityProvider}`);
    lines.push(`  Voltage: ${svc.serviceVoltage}`);
    lines.push(`  Phase: ${svc.servicePhase === 'three' ? 'Three Phase' : svc.servicePhase === 'single' ? 'Single Phase' : svc.servicePhase}`);
    lines.push(`  Service Amps: ${svc.serviceAmperage}A`);
    lines.push(`  Meter #: ${svc.meterNumber}`);
    lines.push('');

    // Recursive panel output
    const printPanel = (panel: Panel, indent: string) => {
      const isMdp = panel.parentId === '';
      const prefix = isMdp ? 'MDP' : 'SUB-PANEL';
      lines.push(`${indent}${prefix}: ${panel.panelName || '(unnamed)'}`);
      lines.push(`${indent}${'─'.repeat(35)}`);
      lines.push(`${indent}  Location: ${panel.panelLocation}`);
      lines.push(`${indent}  Make/Model: ${panel.panelMake} ${panel.panelModel}`);
      lines.push(`${indent}  Bus Voltage: ${panel.busVoltage}V`);
      lines.push(`${indent}  Main Breaker: ${panel.mainBreakerAmps}A`);
      lines.push(`${indent}  Bus Rating: ${panel.busRatingAmps}A`);
      lines.push(`${indent}  Spaces: ${panel.availableSpaces} available / ${panel.totalSpaces} total`);
      if (panel.feedBreakerAmps) {
        lines.push(`${indent}  Feed Breaker: ${panel.feedBreakerAmps}A`);
      }

      // Chargers in this panel
      const panelChargers = data.evChargers.filter((c) => c.panelId === panel.id);
      if (panelChargers.length > 0) {
        lines.push('');
        for (const charger of panelChargers) {
          const label = charger.chargerLabel || 'EV Charger';
          lines.push(`${indent}  CHARGER: ${label}`);
          lines.push(`${indent}    Level: ${charger.chargerLevel}`);
          lines.push(`${indent}    Voltage: ${charger.chargerVoltage}V`);
          lines.push(`${indent}    Charger Amps: ${charger.chargerAmps}A (continuous)`);
          lines.push(`${indent}    Breaker Size: ${charger.breakerSize}A`);
          const cAmps = Number(charger.chargerAmps) || 0;
          if (cAmps > 0) {
            const minB = minBreakerForContinuousLoad(cAmps);
            lines.push(`${indent}    80% Rule Min Breaker: ${minB}A`);
          }
          lines.push(`${indent}    Wire Run: ${charger.wireRunFeet} ft`);
          lines.push(`${indent}    Wire Size: ${charger.wireSize}`);
          lines.push(`${indent}    Conduit: ${charger.conduitType}`);
          lines.push(`${indent}    Install Location: ${charger.installLocation}`);
        }
      }

      // Existing loads in this panel
      const panelLoads = data.existingLoads.filter((l) => l.panelId === panel.id);
      if (panelLoads.length > 0) {
        lines.push('');
        lines.push(`${indent}  EXISTING LOADS:`);
        for (const load of panelLoads) {
          lines.push(`${indent}    ${load.name}: ${load.breakerAmps}A @ ${load.voltage}V`);
        }
        const totalAmps = panelLoads.reduce((s, l) => s + (Number(l.breakerAmps) || 0), 0);
        lines.push(`${indent}    TOTAL: ${totalAmps}A`);
      }

      lines.push('');

      // Child panels
      const children = data.panels.filter((p) => p.parentId === panel.id);
      for (const child of children) {
        printPanel(child, indent + '    ');
      }
    };

    // Find MDP for this service
    const mdp = data.panels.find((p) => p.serviceId === svc.id && p.parentId === '');
    if (mdp) {
      printPanel(mdp, '  ');
    }
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
