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
 * Binary format v4: 16-byte header + 47-byte records with telemetry data
 * Reference: https://github.com/PChild/frc-data-scripts/blob/master/dsLog.py
 */
export function parseDslog(file: File): Promise<ParsedLog> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);

      if (bytes.length < 20) {
        resolve({
          filename: file.name,
          content: `[Invalid dslog file: too small (${bytes.length} bytes)]`,
          isBinary: true,
        });
        return;
      }

      // Parse header - version is 4-byte big-endian integer at offset 0
      const version = view.getInt32(0, false); // big-endian
      let output = `# Driver Station Log Analysis\n`;
      output += `File: ${file.name}\n`;
      output += `Size: ${buffer.byteLength} bytes\n`;
      output += `Log Version: ${version}\n\n`;

      // Version 4 is the current format (2024+)
      // Version 3 was used in earlier years
      if (version !== 4 && version !== 3) {
        output += `Note: Expected version 3 or 4, got ${version}. Parsing may be incomplete.\n\n`;
      }

      // Header is 16 bytes for v4
      const headerSize = 16;
      // Each record is 47 bytes in v4 (4-byte prefix + 10-byte data + 33-byte PDP/PDH)
      const recordSize = 47;
      const dataBlockOffset = 4; // Data block starts 4 bytes into each record

      const numRecords = Math.floor((buffer.byteLength - headerSize) / recordSize);

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
      let prevBrownout = false;
      let validRecordCount = 0;

      for (let i = 0; i < numRecords && i < 50000; i++) {
        const recordOffset = headerSize + i * recordSize;
        const dataOffset = recordOffset + dataBlockOffset;

        if (dataOffset + 10 > buffer.byteLength) break;

        try {
          // Parse data block fields (10 bytes, big-endian format)
          // Byte 0: Trip time (divide by 2 for ms)
          const tripTime = bytes[dataOffset] / 2;
          // Byte 1: Packet loss (multiply by 4 for percentage)
          const lostPackets = bytes[dataOffset + 1] * 4;

          // Bytes 2-3: Voltage as 16-bit big-endian, divide by 256
          const voltageRaw = view.getUint16(dataOffset + 2, false);
          const voltage = voltageRaw / 256.0;

          // Byte 4: Rio CPU (half of byte value, then as percentage)
          const rioCpu = (bytes[dataOffset + 4] / 2) * 0.5;

          // Byte 5: Status bits (inverted)
          const statusRaw = bytes[dataOffset + 5];
          const status = ~statusRaw & 0xff;

          // Byte 6: CAN usage (half of byte value, then as percentage)
          const canUsage = (bytes[dataOffset + 6] / 2) * 0.5;

          // Status bits (after inversion):
          // Bit 1: Watchdog, Bit 0: Low voltage warning (NOT actual brownout)
          const watchdog = (status & 0x02) !== 0;

          // Brownout detection: ONLY use voltage threshold
          // The status flag bit 0 is a "low voltage warning" that triggers ~7V, not actual brownout
          // Actual brownout = voltage below roboRIO cutoff (6.3V)
          const brownout = voltage >= 5 && voltage < 6.3;

          // Track statistics (filter out invalid readings)
          if (voltage >= 5 && voltage <= 16) {
            validRecordCount++;
            if (voltage < minVoltage) minVoltage = voltage;
            if (voltage > maxVoltage) maxVoltage = voltage;
            if (voltage < 7) lowVoltageCount++;
          }

          if (rioCpu > 90) highCpuCount++;
          if (canUsage > 80) highCanCount++;
          if (watchdog) watchdogCount++;
          if (brownout && !prevBrownout) brownoutCount++;
          prevBrownout = brownout;

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
      output += `Valid Records: ${validRecordCount} / ${numRecords}\n`;

      if (minVoltage < 999 && minVoltage > 0) {
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

      if (problemRecords.length === 0 && validRecordCount > 0) {
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

// Maximum text size we'll hand to JSON.parse. Keeps the parser from blocking
// the main thread on a multi-megabyte file; the content is sliced to 8 000 chars
// before sending to the API anyway, so anything beyond this is wasteful.
const MAX_DSEVENTS_PARSE_SIZE = 1 * 1024 * 1024; // 1 MB

/**
 * Parse a Driver Station events file (.dsevents)
 * These are JSON files with timestamped events
 */
export function parseDsevents(file: File): Promise<ParsedLog> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;

      // Try to parse as JSON — but only if the text is small enough not to
      // block the main thread. Anything larger is truncated first so that
      // JSON.parse never receives an unbounded string from user input.
      const parseableText =
        text.length > MAX_DSEVENTS_PARSE_SIZE
          ? text.slice(0, MAX_DSEVENTS_PARSE_SIZE)
          : text;

      try {
        const data = JSON.parse(parseableText);
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
