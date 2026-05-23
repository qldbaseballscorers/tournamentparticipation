// api/create-sheet.cjs — Vercel serverless function (CommonJS)

const { google } = require("googleapis");

function calcLeagueAge(dobStr, startDateStr) {
  if (!dobStr) return null;
  try {
    const dob      = new Date(dobStr);
    const seasonYr = new Date(startDateStr || new Date()).getFullYear();
    const cutoff   = new Date(seasonYr, 7, 31);
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

const hexToRgb = (hex) => ({
  red:   parseInt(hex.slice(1,3),16)/255,
  green: parseInt(hex.slice(3,5),16)/255,
  blue:  parseInt(hex.slice(5,7),16)/255,
});
const color = (hex) => hexToRgb(hex);

function buildSheetRequests(sheetId, team, games, tournamentName) {
  const ROSTER_COLS = 3;
  const GAME_COLS   = 5;
  const totalCols   = ROSTER_COLS + games.length * GAME_COLS;
  const requests    = [];

  const rc  = (r,c)         => ({ sheetId, startRowIndex:r, endRowIndex:r+1, startColumnIndex:c, endColumnIndex:c+1 });
  const rr  = (r1,r2,c1,c2) => ({ sheetId, startRowIndex:r1, endRowIndex:r2, startColumnIndex:c1, endColumnIndex:c2 });
  const fmt = (bg, fg, bold=false, align="CENTER") => ({
    backgroundColor: color(bg),
    textFormat: { foregroundColor: color(fg), bold, fontSize: 10 },
    horizontalAlignment: align,
    verticalAlignment: "MIDDLE",
  });

  // Freeze
  requests.push({ updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount:3, frozenColumnCount:3 } },
    fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
  }});

  // Column widths
  const widths = [{i:0,w:110},{i:1,w:110},{i:2,w:40}];
  games.forEach((g,gi) => {
    const base = ROSTER_COLS + gi * GAME_COLS;
    [50,45,50,80,40].forEach((w,j) => widths.push({i:base+j, w}));
  });
  widths.forEach(({i,w}) => requests.push({ updateDimensionProperties: {
    range: { sheetId, dimension:"COLUMNS", startIndex:i, endIndex:i+1 },
    properties: { pixelSize:w }, fields:"pixelSize"
  }}));

  // Row 1 — Tournament name
  requests.push({ mergeCells: { range: rr(0,1,0,ROSTER_COLS), mergeType:"MERGE_ALL" }});
  requests.push({ updateCells: { range: rc(0,0), fields:"userEnteredValue,userEnteredFormat",
    rows:[{ values:[{ userEnteredValue:{stringValue:tournamentName}, userEnteredFormat:fmt("#0d2040","#c8a84b",true) }]}]
  }});

  // Day group headers
  const dayGroups = {};
  games.forEach((g,gi) => {
    if (!dayGroups[g.dayIdx]) dayGroups[g.dayIdx] = { label:g.dayLabel, start:gi, count:0 };
    dayGroups[g.dayIdx].count++;
  });
  Object.values(dayGroups).forEach(dg => {
    const col  = ROSTER_COLS + dg.start * GAME_COLS;
    const span = dg.count * GAME_COLS;
    if (span > 1) requests.push({ mergeCells: { range: rr(0,1,col,col+span), mergeType:"MERGE_ALL" }});
    requests.push({ updateCells: { range: rc(0,col), fields:"userEnteredValue,userEnteredFormat",
      rows:[{ values:[{ userEnteredValue:{stringValue:dg.label}, userEnteredFormat:fmt("#1a2f4e","#c8a84b",true) }]}]
    }});
  });

  // Row 2 — Game headers
  const r2 = [
    { userEnteredValue:{stringValue:"Surname"},    userEnteredFormat:fmt("#2a4060","#e8dcc8",true,"LEFT") },
    { userEnteredValue:{stringValue:"First Name"}, userEnteredFormat:fmt("#2a4060","#e8dcc8",true,"LEFT") },
    { userEnteredValue:{stringValue:"#"},          userEnteredFormat:fmt("#2a4060","#e8dcc8",true) },
  ];
  games.forEach((g,gi) => {
    const col = ROSTER_COLS + gi * GAME_COLS;
    requests.push({ mergeCells: { range: rr(1,2,col,col+GAME_COLS), mergeType:"MERGE_ALL" }});
    for (let i=0; i<GAME_COLS; i++) {
      r2.push({ userEnteredValue:{stringValue: i===0 ? "Game "+g.gameNum : ""},
        userEnteredFormat:fmt("#2a4060","#e8dcc8",true) });
    }
  });
  requests.push({ updateCells: { range: rr(1,2,0,totalCols), fields:"userEnteredValue,userEnteredFormat", rows:[{values:r2}] }});

  // Row 3 — Column headers
  const r3 = ["Surname","First Name","#"].map(h => ({
    userEnteredValue:{stringValue:h}, userEnteredFormat:fmt("#1a3050","#8fa8c8",true)
  }));
  games.forEach(() => {
    ["DO","P","Start","STATUS","C"].forEach(h => {
      r3.push({ userEnteredValue:{stringValue:h}, userEnteredFormat:fmt("#1a3050","#8fa8c8",true) });
    });
  });
  requests.push({ updateCells: { range: rr(2,3,0,totalCols), fields:"userEnteredValue,userEnteredFormat", rows:[{values:r3}] }});

  // Player rows
  const playerRows = team.players.map((p,pi) => {
    const bg = pi%2===0 ? "#0d1e30" : "#0a1628";
    const cells = [
      { userEnteredValue:{stringValue:p.surname||""},    userEnteredFormat:fmt(bg,"#e8dcc8",false,"LEFT") },
      { userEnteredValue:{stringValue:p.firstName||""},  userEnteredFormat:fmt(bg,"#e8dcc8",false,"LEFT") },
      { userEnteredValue:{stringValue:p.number||""},     userEnteredFormat:fmt(bg,"#e8dcc8") },
    ];
    games.forEach(() => {
      cells.push(
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },       // DO
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },       // P
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },       // Start
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8",true) },  // STATUS bold
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },       // C
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const { tournamentName, startDate, days, teams, email } = req.body;

  if (!email || !tournamentName || !days || !teams) {
    return res.status(400).json({ error:"Missing required fields" });
  }

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch(e) {
    return res.status(500).json({ error:"Server config error: bad service account JSON. " + e.message });
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
    const games = buildGameList(days);

    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: tournamentName },
        sheets: teams.map(t => ({ properties: { title: t.name || "Team" } })),
      }
    });

    const spreadsheetId = created.data.spreadsheetId;
    const sheetMeta     = created.data.sheets;

    let allRequests = [];
    teams.forEach((team, ti) => {
      const sheetId = sheetMeta[ti].properties.sheetId;
      allRequests   = allRequests.concat(buildSheetRequests(sheetId, team, games, tournamentName));
    });

    // Batch in chunks of 50
    for (let i = 0; i < allRequests.length; i += 50) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: allRequests.slice(i, i+50) }
      });
    }

    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type:"user", role:"writer", emailAddress:email },
      sendNotificationEmail: true,
      emailMessage: `Your ${tournamentName} pitcher tracking spreadsheet is ready.`,
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return res.status(200).json({ url, spreadsheetId });

  } catch(err) {
    console.error("Sheet creation error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to create spreadsheet" });
  }
};
