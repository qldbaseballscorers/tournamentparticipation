// api/create-sheet.js  —  Vercel serverless function
// Place this file at:  /api/create-sheet.js  in your repo root

const { google } = require("googleapis");

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcLeagueAge(dobStr, startDateStr) {
  if (!dobStr) return null;
  try {
    const dob      = new Date(dobStr);
    const seasonYr = new Date(startDateStr || new Date()).getFullYear();
    const cutoff   = new Date(seasonYr, 7, 31); // 31 Aug
    let age        = seasonYr - dob.getFullYear();
    if (new Date(seasonYr, dob.getMonth(), dob.getDate()) > cutoff) age--;
    return age;
  } catch { return null; }
}

function getLeagueDefaultAge(league) {
  return league==="LL" ? 12 : league==="IL" ? 13 : league==="JL" ? 15 : 17;
}

function getPitchSmart(age) {
  if (age <= 14) return [{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}];
  if (age <= 16) return [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:75,rest:3},{max:95,rest:4}];
  return             [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:80,rest:3},{max:105,rest:4}];
}

function buildGameList(days) {
  const games = [];
  days.forEach((d, di) => {
    for (let g = 1; g <= d.games; g++) {
      games.push({ dayIdx: di, gameNum: g, dayLabel: d.label });
    }
  });
  return games;
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return { red:r, green:g, blue:b };
};
const color  = (hex) => ({ red: hexToRgb(hex).red, green: hexToRgb(hex).green, blue: hexToRgb(hex).blue });
const WHITE  = color("#ffffff");
const BLACK  = color("#000000");

// ── Build requests for one team sheet ────────────────────────────────────────
function buildSheetRequests(sheetId, team, games, tournamentName, startDate) {
  const ROSTER_COLS = 3;
  const GAME_COLS   = 5;
  const totalCols   = ROSTER_COLS + games.length * GAME_COLS;
  const requests    = [];

  const rc = (r,c) => ({ sheetId, startRowIndex:r, endRowIndex:r+1, startColumnIndex:c, endColumnIndex:c+1 });
  const rr = (r1,r2,c1,c2) => ({ sheetId, startRowIndex:r1, endRowIndex:r2, startColumnIndex:c1, endColumnIndex:c2 });

  // ── Freeze rows/cols ──────────────────────────────────────────────────────
  requests.push({ updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount:3, frozenColumnCount:3 } },
    fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
  }});

  // ── Column widths ─────────────────────────────────────────────────────────
  requests.push({ updateDimensionProperties: {
    range: { sheetId, dimension:"COLUMNS", startIndex:0, endIndex:1 },
    properties: { pixelSize:110 }, fields:"pixelSize"
  }});
  requests.push({ updateDimensionProperties: {
    range: { sheetId, dimension:"COLUMNS", startIndex:1, endIndex:2 },
    properties: { pixelSize:110 }, fields:"pixelSize"
  }});
  requests.push({ updateDimensionProperties: {
    range: { sheetId, dimension:"COLUMNS", startIndex:2, endIndex:3 },
    properties: { pixelSize:40 }, fields:"pixelSize"
  }});
  games.forEach((g, gi) => {
    const base = ROSTER_COLS + gi * GAME_COLS;
    [50,45,50,80,40].forEach((w, i) => {
      requests.push({ updateDimensionProperties: {
        range: { sheetId, dimension:"COLUMNS", startIndex:base+i, endIndex:base+i+1 },
        properties: { pixelSize:w }, fields:"pixelSize"
      }});
    });
  });

  // ── Row 1: Tournament name + day headers ──────────────────────────────────
  // Merge roster columns
  requests.push({ mergeCells: { range: rr(0,1,0,ROSTER_COLS), mergeType:"MERGE_ALL" }});
  requests.push({ updateCells: { range: rc(0,0), fields:"userEnteredValue,userEnteredFormat",
    rows:[{ values:[{ userEnteredValue:{ stringValue: tournamentName },
      userEnteredFormat:{ backgroundColor:color("#0d2040"), textFormat:{ foregroundColor:color("#c8a84b"), bold:true, fontSize:11 },
        horizontalAlignment:"CENTER", verticalAlignment:"MIDDLE" }}]}]
  }});

  // Day group headers
  const dayGroups = {};
  games.forEach((g, gi) => {
    if (!dayGroups[g.dayIdx]) dayGroups[g.dayIdx] = { label:g.dayLabel, start:gi, count:0 };
    dayGroups[g.dayIdx].count++;
  });
  Object.values(dayGroups).forEach(dg => {
    const col  = ROSTER_COLS + dg.start * GAME_COLS;
    const span = dg.count * GAME_COLS;
    if (span > 1) requests.push({ mergeCells: { range: rr(0,1,col,col+span), mergeType:"MERGE_ALL" }});
    requests.push({ updateCells: { range: rc(0,col), fields:"userEnteredValue,userEnteredFormat",
      rows:[{ values:[{ userEnteredValue:{ stringValue: dg.label },
        userEnteredFormat:{ backgroundColor:color("#1a2f4e"), textFormat:{ foregroundColor:color("#c8a84b"), bold:true, fontSize:11 },
          horizontalAlignment:"CENTER", verticalAlignment:"MIDDLE" }}]}]
    }});
  });

  // ── Row 2: Game headers ───────────────────────────────────────────────────
  const r2cells = [
    { userEnteredValue:{stringValue:"Surname"},    userEnteredFormat:{backgroundColor:color("#2a4060"),textFormat:{foregroundColor:color("#e8dcc8"),bold:true},horizontalAlignment:"CENTER"}},
    { userEnteredValue:{stringValue:"First Name"}, userEnteredFormat:{backgroundColor:color("#2a4060"),textFormat:{foregroundColor:color("#e8dcc8"),bold:true},horizontalAlignment:"CENTER"}},
    { userEnteredValue:{stringValue:"#"},          userEnteredFormat:{backgroundColor:color("#2a4060"),textFormat:{foregroundColor:color("#e8dcc8"),bold:true},horizontalAlignment:"CENTER"}},
  ];
  games.forEach((g, gi) => {
    const col = ROSTER_COLS + gi * GAME_COLS;
    requests.push({ mergeCells: { range: rr(1,2,col,col+GAME_COLS), mergeType:"MERGE_ALL" }});
    for (let i = 0; i < GAME_COLS; i++) {
      r2cells.push({ userEnteredValue: i===0 ? {stringValue:"Game "+g.gameNum} : {stringValue:""},
        userEnteredFormat:{ backgroundColor:color("#2a4060"), textFormat:{foregroundColor:color("#e8dcc8"),bold:true}, horizontalAlignment:"CENTER" }});
    }
  });
  requests.push({ updateCells: { range: rr(1,2,0,totalCols), fields:"userEnteredValue,userEnteredFormat",
    rows:[{ values: r2cells }]
  }});

  // ── Row 3: Column headers ─────────────────────────────────────────────────
  const hdrCells = ["Surname","First Name","#"].map(h => ({
    userEnteredValue:{stringValue:h},
    userEnteredFormat:{backgroundColor:color("#1a3050"),textFormat:{foregroundColor:color("#8fa8c8"),bold:true},horizontalAlignment:"CENTER"}
  }));
  games.forEach(() => {
    ["DO","P","Start","STATUS","C"].forEach(h => {
      hdrCells.push({ userEnteredValue:{stringValue:h},
        userEnteredFormat:{backgroundColor:color("#1a3050"),textFormat:{foregroundColor:color("#8fa8c8"),bold:true},horizontalAlignment:"CENTER"}});
    });
  });
  requests.push({ updateCells: { range: rr(2,3,0,totalCols), fields:"userEnteredValue,userEnteredFormat",
    rows:[{ values: hdrCells }]
  }});

  // ── Player rows ───────────────────────────────────────────────────────────
  const playerRows = team.players.map((p, pi) => {
    const bg  = color(pi % 2 === 0 ? "#0d1e30" : "#0a1628");
    const fmt = (bold=false) => ({ backgroundColor:bg, textFormat:{foregroundColor:color("#e8dcc8"),bold}, horizontalAlignment:"CENTER" });
    const cells = [
      { userEnteredValue:{stringValue:p.surname},    userEnteredFormat:{...fmt(), horizontalAlignment:"LEFT"} },
      { userEnteredValue:{stringValue:p.firstName},  userEnteredFormat:{...fmt(), horizontalAlignment:"LEFT"} },
      { userEnteredValue:{stringValue:p.number||""}, userEnteredFormat:fmt() },
    ];
    games.forEach(() => {
      cells.push(
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt() },        // DO
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt() },        // P
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt() },        // Start
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(true) },    // STATUS bold
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt() },        // C
      );
    });
    return { values: cells };
  });

  if (playerRows.length > 0) {
    requests.push({ updateCells: {
      range: rr(3, 3+team.players.length, 0, totalCols),
      fields:"userEnteredValue,userEnteredFormat",
      rows: playerRows
    }});
  }

  return requests;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const { tournamentName, startDate, days, teams, email } = req.body;

  if (!email || !tournamentName || !days || !teams) {
    return res.status(400).json({ error:"Missing required fields" });
  }

  // ── Auth via service account ──────────────────────────────────────────────
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    return res.status(500).json({ error:"Server configuration error: invalid service account" });
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const sheets = google.sheets({ version:"v4", auth });
  const drive  = google.drive({ version:"v3", auth });

  try {
    // ── Create the spreadsheet ──────────────────────────────────────────────
    const games = buildGameList(days);

    // Build sheet stubs for batchUpdate
    const sheetsConfig = teams.map(t => ({
      properties: { title: t.name || "Team" }
    }));

    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: tournamentName },
        sheets: sheetsConfig,
      }
    });

    const spreadsheetId = created.data.spreadsheetId;
    const sheetMeta     = created.data.sheets;

    // ── Build all formatting requests ───────────────────────────────────────
    let allRequests = [];

    teams.forEach((team, ti) => {
      const sheetId = sheetMeta[ti].properties.sheetId;
      const reqs    = buildSheetRequests(sheetId, team, games, tournamentName, startDate);
      allRequests   = allRequests.concat(reqs);
    });

    // Execute in batches of 100 to stay within API limits
    const BATCH = 100;
    for (let i = 0; i < allRequests.length; i += BATCH) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: allRequests.slice(i, i+BATCH) }
      });
    }

    // ── Share to user's email ───────────────────────────────────────────────
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: "user",
        role: "writer",
        emailAddress: email,
      },
      sendNotificationEmail: true,
      emailMessage: `Your ${tournamentName} pitcher tracking spreadsheet is ready.`,
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return res.status(200).json({ url, spreadsheetId });

  } catch (err) {
    console.error("Sheet creation error:", err);
    return res.status(500).json({ error: err.message || "Failed to create spreadsheet" });
  }
}
