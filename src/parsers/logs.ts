/**
 * Log file parsers for FRC robot logs
 */

export interface ParsedLog {
  filename: string;
  content: string;
  isBinary: boolean;
}

interface DslogRecord {
  timestamp: number;
  tripTime: number;
  lostPackets: number;
  voltage: number;
  rioCpu: number;
  canUsage: number;
  wifiDb: number;
  bandwidth: number;
  pdpId: number;
  pdpValues: number[];
  robotDisable: boolean;
  robotAuto: boolean;
  robotTele: boolean;
  dsDisable: boolean;
  dsAuto: boolean;
  dsTele: boolean;
  watchdog: boolean;
  brownout: boolean;
}

/**
 * Parse a Driver Station log file (.dslog)
 * Binary format: version header + records with telemetry data
 */
export function parseDslog(file: File): Promise<ParsedLog> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);

      if (bytes.length < 4) {
        resolve({
          filename: file.name,
          content: `[Invalid dslog file: too small (${bytes.length} bytes)]`,
          isBinary: true,
        });
        return;
      }

      // Parse header - version is first 3 bytes
      const version = bytes[0];
      let output = `# Driver Station Log Analysis\n`;
      output += `File: ${file.name}\n`;
      output += `Size: ${buffer.byteLength} bytes\n`;
      output += `Log Version: ${version}\n\n`;

      // Version 4 is the current format
      if (version !== 4) {
        output += `Note: Expected version 4, got ${version}. Parsing may be incomplete.\n\n`;
      }

      // Parse records - each record is 10 bytes starting at offset 3
      const recordSize = 10;
      const recordStart = 3;
      const numRecords = Math.floor((buffer.byteLength - recordStart) / recordSize);

      output += `Total Records: ${numRecords}\n`;
      output += `Duration: ~${(numRecords * 0.02).toFixed(1)} seconds\n\n`;

      if (numRecords === 0) {
        resolve({
          filename: file.name,
          content: output + `[No records found in log]`,
          isBinary: true,
        });
        return;
      }

      // Parse records and collect statistics
      const records: Partial<DslogRecord>[] = [];
      let minVoltage = 999;
      let maxVoltage = 0;
      let lowVoltageCount = 0;
      let highCpuCount = 0;
      let highCanCount = 0;
      let watchdogCount = 0;
      let brownoutCount = 0;

      for (let i = 0; i < numRecords && i < 50000; i++) {
        const offset = recordStart + i * recordSize;

        if (offset + recordSize > buffer.byteLength) break;

        try {
          // Parse record fields (big-endian format)
          const tripTime = bytes[offset]; // ms
          const lostPackets = bytes[offset + 1];

          // Voltage: high byte = integer volts, low byte = fractional volts (256ths)
          const voltage = bytes[offset + 2] + bytes[offset + 3] / 256.0;

          const rioCpu = bytes[offset + 4] / 2; // 0-100%
          const status = bytes[offset + 5];
          const canUsage = bytes[offset + 6] / 2; // 0-100%

          // Status byte bits
          const brownout = (status & 0x80) !== 0;
          const watchdog = (status & 0x40) !== 0;

          // Track statistics
          if (voltage > 0 && voltage < 20) {
            if (voltage < minVoltage) minVoltage = voltage;
            if (voltage > maxVoltage) maxVoltage = voltage;
            if (voltage < 7) lowVoltageCount++;
          }

          if (rioCpu > 90) highCpuCount++;
          if (canUsage > 80) highCanCount++;
          if (watchdog) watchdogCount++;
          if (brownout) brownoutCount++;

          records.push({
            tripTime,
            lostPackets,
            voltage,
            rioCpu,
            canUsage,
            watchdog,
            brownout,
          });
        } catch {
          // Skip malformed record
        }
      }

      // Summary statistics
      output += `## Summary Statistics\n\n`;

      if (minVoltage < 999) {
        output += `Voltage Range: ${minVoltage.toFixed(2)}V - ${maxVoltage.toFixed(2)}V\n`;
      }

      if (lowVoltageCount > 0) {
        output += `⚠️ Low Voltage Events (<7V): ${lowVoltageCount}\n`;
      }

      if (highCpuCount > 0) {
        output += `⚠️ High CPU Events (>90%): ${highCpuCount}\n`;
      }

      if (highCanCount > 0) {
        output += `⚠️ High CAN Bus Events (>80%): ${highCanCount}\n`;
      }

      if (watchdogCount > 0) {
        output += `🔴 Watchdog Triggers: ${watchdogCount}\n`;
      }

      if (brownoutCount > 0) {
        output += `🔴 Brownout Events: ${brownoutCount}\n`;
      }

      // Sample of records with issues
      const problemRecords = records.filter(
        (r) => r.watchdog || r.brownout || (r.rioCpu && r.rioCpu > 90) || (r.canUsage && r.canUsage > 80)
      );

      if (problemRecords.length > 0) {
        output += `\n## Problem Events (Sample)\n\n`;
        const sample = problemRecords.slice(0, 20);
        sample.forEach((r, i) => {
          output += `Record ${i + 1}: `;
          const issues = [];
          if (r.watchdog) issues.push('WATCHDOG');
          if (r.brownout) issues.push('BROWNOUT');
          if (r.rioCpu && r.rioCpu > 90) issues.push(`CPU:${r.rioCpu.toFixed(0)}%`);
          if (r.canUsage && r.canUsage > 80) issues.push(`CAN:${r.canUsage.toFixed(0)}%`);
          if (r.voltage && r.voltage < 7) issues.push(`Voltage:${r.voltage.toFixed(2)}V`);
          output += issues.join(', ') + '\n';
        });
      }

      if (problemRecords.length === 0 && numRecords > 0) {
        output += `\n✅ No obvious problems detected in log data.\n`;
      }

      resolve({
        filename: file.name,
        content: output,
        isBinary: true,
      });
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse a Driver Station events file (.dsevents)
 * These are JSON files with timestamped events
 */
export function parseDsevents(file: File): Promise<ParsedLog> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;

      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        let content = `# Driver Station Events\n`;
        content += `File: ${file.name}\n\n`;

        if (Array.isArray(data)) {
          content += `Total Events: ${data.length}\n\n`;

          // Group events by type if possible
          const errorEvents = data.filter((ev) =>
            ev.type?.toLowerCase().includes('error') ||
            ev.message?.toLowerCase().includes('error') ||
            ev.level === 'error'
          );
          const warningEvents = data.filter((ev) =>
            ev.type?.toLowerCase().includes('warn') ||
            ev.message?.toLowerCase().includes('warn') ||
            ev.level === 'warning'
          );

          if (errorEvents.length > 0) {
            content += `## Errors (${errorEvents.length})\n\n`;
            errorEvents.slice(0, 30).forEach((ev) => {
              content += `- ${ev.timestamp || ev.time || ''}: ${ev.message || ev.data || JSON.stringify(ev)}\n`;
            });
            content += '\n';
          }

          if (warningEvents.length > 0) {
            content += `## Warnings (${warningEvents.length})\n\n`;
            warningEvents.slice(0, 20).forEach((ev) => {
              content += `- ${ev.timestamp || ev.time || ''}: ${ev.message || ev.data || JSON.stringify(ev)}\n`;
            });
            content += '\n';
          }

          content += `## All Events (first 50)\n\n`;
          content += JSON.stringify(data.slice(0, 50), null, 2);

          if (data.length > 50) {
            content += `\n\n... and ${data.length - 50} more events`;
          }
        } else {
          content += JSON.stringify(data, null, 2);
        }

        resolve({
          filename: file.name,
          content,
          isBinary: false,
        });
      } catch {
        // Not JSON - return as plain text
        resolve({
          filename: file.name,
          content: `# Driver Station Events\nFile: ${file.name}\n\n${text}`,
          isBinary: false,
        });
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Parse a Java source file
 */
export function parseJavaFile(file: File): Promise<ParsedLog> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve({
        filename: file.name,
        content: e.target?.result as string,
        isBinary: false,
      });
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
