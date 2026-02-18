import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SingleLineData, MainPanel } from '../types';
import {
  breakerSpaces, totalSpacesUsed, calcKw,
  getEffectivePanelVoltage, transformerFLA,
  necDemandAmps, evChargerKw,
} from '../types';

interface Props {
  data: SingleLineData;
}

function panelLoadAmps(panel: MainPanel): number {
  return panel.breakers
    .filter((b) => b.type === 'load' || b.type === 'evcharger')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
}

function panelSubPanelFeedAmps(panel: MainPanel): number {
  return panel.breakers
    .filter((b) => b.type === 'subpanel')
    .reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
}

async function svgToPng(): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const svgEl = document.querySelector('.diagram-container svg') as SVGSVGElement | null;
  if (!svgEl) return null;

  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function addHeader(doc: jsPDF, title: string, yStart: number): number {
  let y = yStart;
  // Blue accent bar
  doc.setFillColor(30, 64, 175); // ACCENT
  doc.rect(14, y, 182, 1.5, 'F');
  y += 6;

  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  y += 4;

  // Thin line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 4;

  return y;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setTextColor(30, 64, 175);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  y += 2;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.line(14, y, 80, y);
  y += 5;
  return y;
}

function checkNewPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return 15;
  }
  return y;
}

function addLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number, labelWidth = 40): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(value || '--', x + labelWidth, y);
  return y + 5;
}

export function PdfExportButton({ data }: Props) {
  const handleExportPdf = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const sv = data.serviceEntrance;
    const serviceVoltage = sv.serviceVoltage;

    // ===== PAGE 1: COVER & SITE INFO =====
    let y = 15;

    // Title
    y = addHeader(doc, 'Electrical One-Line Survey Report', y);

    // Subtitle with date
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    const dateStr = data.siteInfo.surveyDate || new Date().toLocaleDateString();
    doc.text(`Survey Date: ${dateStr}`, 14, y);
    y += 8;

    // Site Information
    y = addSectionTitle(doc, 'Site Information', y);
    y = addLabelValue(doc, 'Customer:', data.siteInfo.customerName, 14, y);
    y = addLabelValue(doc, 'Address:', data.siteInfo.address, 14, y);
    y = addLabelValue(doc, 'City/State/ZIP:', `${data.siteInfo.city}, ${data.siteInfo.state} ${data.siteInfo.zip}`, 14, y);
    y = addLabelValue(doc, 'Technician:', data.siteInfo.technicianName, 14, y);
    if (data.siteInfo.notes) {
      y = addLabelValue(doc, 'Notes:', data.siteInfo.notes, 14, y);
    }
    y += 4;

    // Service Entrance
    y = addSectionTitle(doc, 'Service Entrance', y);
    y = addLabelValue(doc, 'Utility:', sv.utilityProvider, 14, y);
    y = addLabelValue(doc, 'Voltage:', sv.serviceVoltage, 14, y);
    y = addLabelValue(doc, 'Phase:', sv.servicePhase === 'three' ? 'Three Phase' : sv.servicePhase === 'single' ? 'Single Phase' : '--', 14, y);
    y = addLabelValue(doc, 'Service Amps:', sv.serviceAmperage ? `${sv.serviceAmperage}A` : '--', 14, y);
    y = addLabelValue(doc, 'Meter #:', sv.meterNumber, 14, y);
    y += 4;

    // ===== PANELS =====
    const rootPanels = data.panels.filter((p) => !p.parentPanelId);

    function renderPanelPdf(panel: MainPanel, indent: number) {
      const effectiveVoltage = getEffectivePanelVoltage(panel, data.panels, serviceVoltage);
      const label = panel.panelName || 'Panel';
      const isTransformerPanel = !!panel.transformer;

      y = checkNewPage(doc, y, 30);
      const condLabel = panel.condition === 'new' ? ' [NEW]' : '';
      y = addSectionTitle(doc, `${'\u00A0'.repeat(indent * 4)}${label}${isTransformerPanel ? ` [${effectiveVoltage} via Transformer]` : ''}${condLabel}`, y);

      // Panel info row
      const infoItems = [
        panel.panelLocation ? `Location: ${panel.panelLocation}` : '',
        panel.panelMake ? `Make: ${panel.panelMake}` : '',
        panel.panelModel ? `Model: ${panel.panelModel}` : '',
        panel.mainBreakerAmps ? `Main Breaker: ${panel.mainBreakerAmps}A` : '',
        panel.busRatingAmps ? `Bus Rating: ${panel.busRatingAmps}A` : '',
      ].filter(Boolean);

      if (infoItems.length > 0) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(infoItems.join('  |  '), 14 + indent * 4, y);
        y += 5;
      }

      // Transformer details
      if (isTransformerPanel) {
        const xfmr = panel.transformer!;
        const kva = Number(xfmr.kva) || 0;
        const primaryFLA = transformerFLA(kva, xfmr.primaryVoltage);
        const secondaryFLA = transformerFLA(kva, xfmr.secondaryVoltage);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(180, 83, 9); // amber
        const xfmrInfo = [
          `Transformer: ${kva > 0 ? `${kva} kVA` : '--'}`,
          `${xfmr.primaryVoltage} -> ${xfmr.secondaryVoltage}`,
          primaryFLA > 0 ? `Primary: ${primaryFLA.toFixed(1)}A` : '',
          secondaryFLA > 0 ? `Secondary: ${secondaryFLA.toFixed(1)}A` : '',
        ].filter(Boolean).join('  |  ');
        doc.text(xfmrInfo, 14 + indent * 4, y);
        y += 5;
      }

      // Spaces
      const totalSp = Number(panel.totalSpaces) || 0;
      const used = totalSpacesUsed(panel.breakers);
      if (totalSp > 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Spaces: ${used}/${totalSp} used (${totalSp - used} available)`, 14 + indent * 4, y);
        y += 5;
      }

      // Breakers table
      if (panel.breakers.length > 0) {
        y = checkNewPage(doc, y, 15);

        const breakerRows = panel.breakers.map((b) => {
          const spaces = breakerSpaces(b.voltage);
          let typeLabel = 'Load';
          let extra = '';

          if (b.type === 'subpanel') {
            typeLabel = 'Sub Panel';
          } else if (b.type === 'evcharger') {
            const v = Number(b.voltage) || 0;
            const kw = calcKw(String(v), b.chargerAmps || '');
            const ports = Number(b.chargerPorts) || 0;
            typeLabel = b.chargerLevel === 'Level 3' ? 'DCFC' : 'EV Charger';
            const parts: string[] = [];
            if (kw > 0) parts.push(`${kw.toFixed(1)}kW`);
            if (ports > 0) parts.push(`${ports}port${ports > 1 ? 's' : ''}`);
            extra = parts.join(', ');
          }

          const loadTypeLabel = b.type === 'subpanel' ? '--' : (b.loadType === 'continuous' ? 'Cont' : 'Non-C');

          return [
            b.circuitNumber || '--',
            b.label || '--',
            b.amps ? `${b.amps}A` : '--',
            `${b.voltage}V`,
            String(spaces),
            typeLabel,
            loadTypeLabel,
            b.condition === 'new' ? 'NEW' : 'Existing',
            extra,
          ];
        });

        autoTable(doc, {
          startY: y,
          margin: { left: 14 + indent * 4 },
          head: [['Ckt', 'Label', 'Breaker', 'Voltage', 'Sp', 'Type', 'Load', 'Status', 'Notes']],
          body: breakerRows,
          theme: 'striped',
          styles: {
            fontSize: 7.5,
            cellPadding: 1.5,
          },
          headStyles: {
            fillColor: [30, 64, 175],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
          },
          alternateRowStyles: {
            fillColor: [241, 245, 249],
          },
          columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 30 },
            2: { cellWidth: 14 },
            3: { cellWidth: 14 },
            4: { cellWidth: 8 },
            5: { cellWidth: 18 },
            6: { cellWidth: 12 },
            7: { cellWidth: 16 },
            8: { cellWidth: 18 },
          },
        });

        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Recurse for child panels
      const children = data.panels.filter((p) => p.parentPanelId === panel.id);
      for (const child of children) {
        renderPanelPdf(child, indent + 1);
      }
    }

    for (const rp of rootPanels) {
      renderPanelPdf(rp, 0);
    }

    // ===== LOAD CALCULATION SUMMARY =====
    y = checkNewPage(doc, y, 40);
    y = addSectionTitle(doc, 'Load Calculation Summary', y);

    const serviceAmps = Number(sv.serviceAmperage) || 0;
    const mdp = rootPanels[0];
    const mdpBreakerAmps = mdp ? Number(mdp.mainBreakerAmps) || 0 : 0;
    const panelRating = Math.min(serviceAmps, mdpBreakerAmps) || serviceAmps || mdpBreakerAmps;

    const totalLoadAmps = data.panels.reduce((sum, p) => sum + panelLoadAmps(p), 0);
    const allEvBreakers = data.panels.flatMap((p) => p.breakers.filter((b) => b.type === 'evcharger'));
    const totalEvBreakerAmps = allEvBreakers.reduce((sum, b) => sum + (Number(b.amps) || 0), 0);
    const existingLoadAmps = totalLoadAmps - totalEvBreakerAmps;
    const capacityUsed = panelRating > 0 ? Math.round((totalLoadAmps / panelRating) * 100) : 0;

    const totalEvKw = allEvBreakers.reduce((sum, b) => {
      const v = Number(b.voltage) || 0;
      return sum + calcKw(String(v), b.chargerAmps || '');
    }, 0);

    const loadRows: string[][] = [
      ['Service / MDP Rating', panelRating > 0 ? `${panelRating}A` : '--'],
      ['Existing Breaker Loads', `${existingLoadAmps}A`],
    ];

    // Per-panel breakdown
    for (const p of data.panels) {
      const la = panelLoadAmps(p);
      const sf = panelSubPanelFeedAmps(p);
      const effV = getEffectivePanelVoltage(p, data.panels, serviceVoltage);
      const voltNote = p.transformer ? ` [${effV}]` : '';
      const xfNote = p.transformer && Number(p.transformer.kva) > 0 ? ` (${p.transformer.kva}kVA xfmr)` : '';
      loadRows.push([
        `  ${p.panelName || 'Panel'}${voltNote}${xfNote}`,
        `${la}A${sf > 0 ? ` + ${sf}A feeds` : ''}`,
      ]);
    }

    if (allEvBreakers.length > 0) {
      loadRows.push([`EV Chargers (${allEvBreakers.length})`, `${totalEvBreakerAmps}A`]);
      if (totalEvKw > 0) {
        loadRows.push(['Total EV Output', `${totalEvKw.toFixed(1)} kW`]);
      }
    }

    loadRows.push(['Total Load', `${totalLoadAmps}A`]);
    if (panelRating > 0) {
      loadRows.push(['Capacity Used', `${capacityUsed}%`]);
    }

    // NEC demand
    const allNonSubBreakers = data.panels.flatMap((p) => p.breakers.filter((b) => b.type !== 'subpanel'));
    const necDemand = necDemandAmps(allNonSubBreakers);
    loadRows.push(['', '']);
    loadRows.push(['NEC Demand Calculation', '']);
    loadRows.push([`  Continuous (x1.25)`, `${necDemand.continuous}A x 1.25 = ${Math.ceil(necDemand.continuous * 1.25)}A`]);
    loadRows.push([`  Non-Continuous (x1.0)`, `${necDemand.nonContinuous}A`]);
    loadRows.push(['NEC Total Demand', `${necDemand.totalDemand}A`]);

    // Peak kW
    const peakKwLoads = allNonSubBreakers
      .filter((b) => b.type !== 'evcharger')
      .reduce((sum, b) => sum + ((Number(b.voltage) || 0) * (Number(b.amps) || 0)) / 1000, 0);
    const peakKwEv = allEvBreakers.reduce((sum, b) => sum + evChargerKw(b), 0);
    const totalPeakKw = peakKwLoads + peakKwEv;

    loadRows.push(['', '']);
    loadRows.push(['Peak kW Demand', '']);
    loadRows.push(['  General Loads', `${peakKwLoads.toFixed(1)} kW`]);
    if (allEvBreakers.length > 0) {
      loadRows.push(['  EV Chargers (output)', `${peakKwEv.toFixed(1)} kW`]);
    }
    loadRows.push(['Total Peak Demand', `${totalPeakKw.toFixed(1)} kW`]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14 },
      body: loadRows,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold', textColor: [71, 85, 105] },
        1: { cellWidth: 50, halign: 'right' },
      },
      didParseCell: (hookData) => {
        const row = hookData.row.raw as string[];
        if (!row) return;
        const label = row[0];
        // Bold total/summary rows
        if (label === 'Total Load' || label === 'NEC Total Demand' || label === 'Total Peak Demand') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fontSize = 10;
        }
        // Bold section headers
        if (label === 'NEC Demand Calculation' || label === 'Peak kW Demand') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.textColor = [30, 64, 175];
        }
        // Red for capacity > 100%
        if (label === 'Capacity Used' && capacityUsed > 100) {
          hookData.cell.styles.textColor = [220, 38, 38];
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Caution for 80-100%
        if (label === 'Capacity Used' && capacityUsed > 80 && capacityUsed <= 100) {
          hookData.cell.styles.textColor = [217, 119, 6];
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Red for NEC demand exceeding service rating
        if (label === 'NEC Total Demand' && panelRating > 0 && necDemand.totalDemand > panelRating) {
          hookData.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    // Capacity warnings
    if (capacityUsed > 100) {
      doc.setFontSize(8.5);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('WARNING: Total breaker load exceeds panel rating.', 14, y);
      y += 5;
    } else if (capacityUsed > 80) {
      doc.setFontSize(8.5);
      doc.setTextColor(217, 119, 6);
      doc.setFont('helvetica', 'bold');
      doc.text('CAUTION: Panel is above 80% capacity.', 14, y);
      y += 5;
    }

    // ===== SINGLE LINE DIAGRAM =====
    try {
      const imgResult = await svgToPng();
      if (imgResult) {
        doc.addPage();
        y = 15;
        y = addSectionTitle(doc, 'Single Line Diagram', y);

        const pageWidth = 182; // usable width (210 - 2*14)
        const aspectRatio = imgResult.height / imgResult.width;
        let imgW = pageWidth;
        let imgH = imgW * aspectRatio;

        // If too tall, scale down
        const maxH = 250;
        if (imgH > maxH) {
          imgH = maxH;
          imgW = imgH / aspectRatio;
        }

        const imgX = 14 + (pageWidth - imgW) / 2;

        doc.addImage(imgResult.dataUrl, 'PNG', imgX, y, imgW, imgH);
        y += imgH + 6;
      }
    } catch {
      // Diagram export failed, skip
    }

    // ===== FOOTER on each page =====
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // Footer line
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(14, 287, 196, 287);
      // Footer text
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${data.siteInfo.customerName || 'EV Single Line Survey'} | ${dateStr}`,
        14, 291
      );
      doc.text(`Page ${i} of ${totalPages}`, 196, 291, { align: 'right' });
    }

    // Save
    const name = data.siteInfo.customerName || 'survey';
    doc.save(`${name.replace(/\s+/g, '_')}_report.pdf`);
  };

  return (
    <button type="button" className="btn-export btn-pdf" onClick={handleExportPdf}>
      Export PDF Report
    </button>
  );
}
