import type { SingleLineData } from '../types';

interface Props {
  data: SingleLineData;
}

function formatData(data: SingleLineData): string {
  const lines: string[] = [];

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

  lines.push('MAIN PANEL');
  lines.push('-'.repeat(30));
  lines.push(`Location: ${data.mainPanel.panelLocation}`);
  lines.push(`Make/Model: ${data.mainPanel.panelMake} ${data.mainPanel.panelModel}`);
  lines.push(`Main Breaker: ${data.mainPanel.mainBreakerAmps}A`);
  lines.push(`Bus Rating: ${data.mainPanel.busRatingAmps}A`);
  lines.push(`Spaces: ${data.mainPanel.availableSpaces} available of ${data.mainPanel.totalSpaces} total`);
  lines.push('');

  if (data.existingLoads.length > 0) {
    lines.push('EXISTING LOADS');
    lines.push('-'.repeat(30));
    for (const load of data.existingLoads) {
      lines.push(`  ${load.name}: ${load.breakerAmps}A @ ${load.voltage}V`);
    }
    const totalAmps = data.existingLoads.reduce((s, l) => s + (Number(l.breakerAmps) || 0), 0);
    lines.push(`  TOTAL: ${totalAmps}A`);
    lines.push('');
  }

  lines.push('PROPOSED EV CHARGER');
  lines.push('-'.repeat(30));
  lines.push(`Level: ${data.evCharger.chargerLevel}`);
  lines.push(`Charger Amps: ${data.evCharger.chargerAmps}A`);
  lines.push(`Breaker Size: ${data.evCharger.breakerSize}A`);
  lines.push(`Wire Run: ${data.evCharger.wireRunFeet} ft`);
  lines.push(`Wire Size: ${data.evCharger.wireSize}`);
  lines.push(`Conduit: ${data.evCharger.conduitType}`);
  lines.push(`Install Location: ${data.evCharger.installLocation}`);

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
