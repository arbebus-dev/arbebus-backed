const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');
const readline = require('readline');

const { env } = require('../config/env');
const { getPool } = require('../db/pool');

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function resolveLocalPath(input) {
  if (!input) return null;
  if (path.isAbsolute(input)) return input;
  return path.resolve(process.cwd(), input);
}

function downloadFile(url, targetPath) {
  const client = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        return resolve(downloadFile(response.headers.location, targetPath));
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`GTFS download failed: ${response.statusCode}`));
      }

      const fileStream = fs.createWriteStream(targetPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(resolve));
      fileStream.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(60000, () => {
      request.destroy(new Error('GTFS download timeout'));
    });
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseTimeToSeconds(value) {
  if (!value) return null;
  const parts = String(value).split(':').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatGtfsDate(value) {
  if (!value || value.length !== 8) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

async function streamCsvRows(filePath, onRow) {
  if (!fs.existsSync(filePath)) return;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let headers = null;

  for await (const line of rl) {
    if (!headers) {
      headers = parseCsvLine(line).map((h) => h.trim());
      continue;
    }

    if (!line.trim()) continue;

    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    await onRow(row);
  }
}

async function batchInsert(
  client,
  sqlPrefix,
  rows,
  chunkSize = 1000,
  conflictClause = 'ON CONFLICT DO NOTHING'
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const values = [];
    const params = [];

    chunk.forEach((row, rowIndex) => {
      params.push(...row);
      const offset = rowIndex * row.length;
      values.push(`(${row.map((_, j) => `$${offset + j + 1}`).join(',')})`);
    });

    await client.query(
      `${sqlPrefix} VALUES ${values.join(',')} ${conflictClause}`,
      params
    );
  }
}

async function main() {
  const sourceArg = process.argv[2] || env.GTFS_SOURCE_URL;

  if (!sourceArg) {
    throw new Error('GTFS source is missing. Pass URL/path or set GTFS_SOURCE_URL.');
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arbebus-gtfs-'));
  const zipPath = path.join(tempRoot, 'feed.zip');
  const extractDir = path.join(tempRoot, 'feed');
  fs.mkdirSync(extractDir, { recursive: true });

  if (isHttpUrl(sourceArg)) {
    console.log('Downloading GTFS...');
    await downloadFile(sourceArg, zipPath);
  } else {
    const localZip = resolveLocalPath(sourceArg);
    if (!localZip || !fs.existsSync(localZip)) {
      throw new Error(`Local GTFS file not found: ${sourceArg}`);
    }
    fs.copyFileSync(localZip, zipPath);
    console.log('Using local GTFS ZIP:', localZip);
  }

  console.log('Extracting ZIP...');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);

  const sourceHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(zipPath))
    .digest('hex');

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8')
    );

    const importRun = await client.query(
      'INSERT INTO transit.import_runs (source_url, source_hash, notes) VALUES ($1, $2, $3) RETURNING id',
      [sourceArg, sourceHash, 'Full GTFS import with shapes']
    );
    const importRunId = importRun.rows[0].id;

    console.log('Clearing old data...');
    await client.query(`
      TRUNCATE
        transit.shape_points,
        transit.shapes,
        transit.stop_times,
        transit.trips,
        transit.transfers,
        transit.calendar_dates,
        transit.calendar,
        transit.stops,
        transit.routes,
        transit.agencies
      RESTART IDENTITY CASCADE
    `);

    console.log('Importing agencies...');
    const agencies = [];
    await streamCsvRows(path.join(extractDir, 'agency.txt'), async (row) => {
      agencies.push([
        row.agency_id || 'default',
        row.agency_name || 'Agency',
        row.agency_url || null,
        row.agency_timezone || null,
        row.agency_lang || null,
        row.agency_phone || null,
        row.agency_fare_url || null,
        row.agency_email || null,
        importRunId,
      ]);
    });

    if (agencies.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.agencies
          (agency_id, agency_name, agency_url, agency_timezone, agency_lang, agency_phone, agency_fare_url, agency_email, import_run_id)`,
        agencies,
        1000
      );
    }

    console.log(`Agencies imported: ${agencies.length}`);

    console.log('Importing routes...');
    const routes = [];
    await streamCsvRows(path.join(extractDir, 'routes.txt'), async (row) => {
      routes.push([
        row.route_id,
        row.agency_id || 'default',
        row.route_short_name || null,
        row.route_long_name || null,
        row.route_desc || null,
        row.route_type !== '' ? Number(row.route_type) : null,
        row.route_color || null,
        row.route_text_color || null,
        importRunId,
      ]);
    });

    if (routes.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.routes
          (route_id, agency_id, route_short_name, route_long_name, route_desc, route_type, route_color, route_text_color, import_run_id)`,
        routes,
        1000
      );
    }

    console.log(`Routes imported: ${routes.length}`);

    console.log('Importing stops...');
    const stops = [];
    await streamCsvRows(path.join(extractDir, 'stops.txt'), async (row) => {
      const lat = Number(row.stop_lat);
      const lon = Number(row.stop_lon);

      if (!row.stop_id || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }

      stops.push([
        row.stop_id,
        row.stop_code || null,
        row.stop_name || row.stop_id,
        row.stop_desc || null,
        lat,
        lon,
        row.zone_id || null,
        row.stop_url || null,
        row.location_type !== '' ? Number(row.location_type) : null,
        row.parent_station || null,
        row.wheelchair_boarding !== '' ? Number(row.wheelchair_boarding) : null,
        importRunId,
      ]);
    });

    if (stops.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.stops
          (stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station, wheelchair_boarding, import_run_id)`,
        stops,
        1000
      );
    }

    console.log(`Stops imported: ${stops.length}`);

    console.log('Importing calendar...');
    const calendars = [];
    await streamCsvRows(path.join(extractDir, 'calendar.txt'), async (row) => {
      if (!row.service_id) return;

      calendars.push([
        row.service_id,
        row.monday === '1',
        row.tuesday === '1',
        row.wednesday === '1',
        row.thursday === '1',
        row.friday === '1',
        row.saturday === '1',
        row.sunday === '1',
        formatGtfsDate(row.start_date),
        formatGtfsDate(row.end_date),
        importRunId,
      ]);
    });

    if (calendars.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.calendar
          (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, import_run_id)`,
        calendars,
        2000
      );
    }

    console.log(`Calendar imported: ${calendars.length}`);

    console.log('Importing calendar_dates...');
    const calendarDates = [];
    await streamCsvRows(path.join(extractDir, 'calendar_dates.txt'), async (row) => {
      if (!row.service_id || !row.date) return;

      calendarDates.push([
        row.service_id,
        formatGtfsDate(row.date),
        row.exception_type !== '' ? Number(row.exception_type) : null,
        importRunId,
      ]);
    });

    if (calendarDates.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.calendar_dates
          (service_id, service_date, exception_type, import_run_id)`,
        calendarDates,
        2000,
        `ON CONFLICT (service_id, service_date) DO UPDATE
         SET exception_type = EXCLUDED.exception_type,
             import_run_id = EXCLUDED.import_run_id`
      );
    }

    console.log(`Calendar dates imported: ${calendarDates.length}`);

    console.log('Importing trips...');
    const trips = [];
    await streamCsvRows(path.join(extractDir, 'trips.txt'), async (row) => {
      if (!row.trip_id || !row.route_id || !row.service_id) return;

      trips.push([
        row.trip_id,
        row.route_id,
        row.service_id,
        row.trip_headsign || null,
        row.trip_short_name || null,
        row.direction_id !== '' ? Number(row.direction_id) : null,
        row.block_id || null,
        row.shape_id || null,
        row.wheelchair_accessible !== '' ? Number(row.wheelchair_accessible) : null,
        row.bikes_allowed !== '' ? Number(row.bikes_allowed) : null,
        importRunId,
      ]);
    });

    if (trips.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.trips
          (trip_id, route_id, service_id, trip_headsign, trip_short_name, direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed, import_run_id)`,
        trips,
        2000
      );
    }

    console.log(`Trips imported: ${trips.length}`);

    console.log('Importing stop_times...');
    const stopTimes = [];
    await streamCsvRows(path.join(extractDir, 'stop_times.txt'), async (row) => {
      if (!row.trip_id || !row.stop_id || row.stop_sequence === '') return;

      stopTimes.push([
        row.trip_id,
        row.arrival_time || null,
        row.departure_time || null,
        row.stop_id,
        Number(row.stop_sequence),
        row.pickup_type !== '' ? Number(row.pickup_type) : null,
        row.drop_off_type !== '' ? Number(row.drop_off_type) : null,
        row.shape_dist_traveled !== '' ? Number(row.shape_dist_traveled) : null,
        parseTimeToSeconds(row.arrival_time),
        parseTimeToSeconds(row.departure_time),
        importRunId,
      ]);
    });

    if (stopTimes.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.stop_times
          (trip_id, arrival_time, departure_time, stop_id, stop_sequence, pickup_type, drop_off_type, shape_dist_traveled, arrival_seconds, departure_seconds, import_run_id)`,
        stopTimes,
        3000
      );
    }

    console.log(`StopTimes imported: ${stopTimes.length}`);

    console.log('Importing transfers...');
    const transfers = [];
    await streamCsvRows(path.join(extractDir, 'transfers.txt'), async (row) => {
      if (!row.from_stop_id || !row.to_stop_id) return;

      transfers.push([
        row.from_stop_id,
        row.to_stop_id,
        row.transfer_type !== '' ? Number(row.transfer_type) : null,
        row.min_transfer_time !== '' ? Number(row.min_transfer_time) : null,
        importRunId,
      ]);
    });

    if (transfers.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.transfers
          (from_stop_id, to_stop_id, transfer_type, min_transfer_time, import_run_id)`,
        transfers,
        2000,
        `ON CONFLICT (from_stop_id, to_stop_id) DO UPDATE
         SET transfer_type = EXCLUDED.transfer_type,
             min_transfer_time = EXCLUDED.min_transfer_time,
             import_run_id = EXCLUDED.import_run_id`
      );
    }

    console.log(`Transfers imported: ${transfers.length}`);

    console.log('Importing shapes...');
    const shapeCounts = new Map();
    const shapePoints = [];

    await streamCsvRows(path.join(extractDir, 'shapes.txt'), async (row) => {
      if (!row.shape_id || row.shape_pt_sequence === '') return;

      const lat = Number(row.shape_pt_lat);
      const lon = Number(row.shape_pt_lon);
      const seq = Number(row.shape_pt_sequence);

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(seq)) {
        return;
      }

      const shapeId = row.shape_id;
      shapeCounts.set(shapeId, (shapeCounts.get(shapeId) || 0) + 1);

      shapePoints.push([
        shapeId,
        seq,
        lat,
        lon,
        row.shape_dist_traveled !== '' ? Number(row.shape_dist_traveled) : null,
        importRunId,
      ]);
    });

    if (shapeCounts.size > 0) {
      const shapes = [];
      for (const [shape_id, point_count] of shapeCounts.entries()) {
        shapes.push([shape_id, point_count, importRunId]);
      }

      await batchInsert(
        client,
        `INSERT INTO transit.shapes
          (shape_id, point_count, import_run_id)`,
        shapes,
        2000
      );
    }

    if (shapePoints.length > 0) {
      await batchInsert(
        client,
        `INSERT INTO transit.shape_points
          (shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon, shape_dist_traveled, import_run_id)`,
        shapePoints,
        3000
      );
    }

    console.log(`Shapes imported: ${shapeCounts.size}`);

    console.log('Refreshing materialized views...');
    await client.query('REFRESH MATERIALIZED VIEW transit.service_days');
    await client.query('REFRESH MATERIALIZED VIEW transit.route_stop_pairs');

    await client.query('COMMIT');
    console.log('GTFS import finished successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});