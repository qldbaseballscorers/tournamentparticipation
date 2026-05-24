const { google } = require("googleapis");

var TEMPLATE_ID = "12KWFbX5ikw-BHrrd2IwhPSbjMHhX1wtxcgZF4P0utbk";

function buildGameList(days) {
  var games = [];
  days.forEach(function(d, di) {
    for (var g = 1; g <= d.games; g++) {
      games.push({ dayIdx: di, gameNum: g, dayLabel: d.label });
    }
  });
  return games;
}

function hexToRgb(hex) {
  return {
    red:   parseInt(hex.slice(1,3),16)/255,
    green: parseInt(hex.slice(3,5),16)/255,
    blue:  parseInt(hex.slice(5,7),16)/255,
  };
}

function fmt(bg, fg, bold, align) {
  return {
    backgroundColor: hexToRgb(bg),
    textFormat: { foregroundColor: hexToRgb(fg), bold: bold||false, fontSize:10 },
    horizontalAlignment: align||"CENTER",
    verticalAlignment: "MIDDLE",
  };
}

function buildSheetRequests(sheetId, team, games, tournamentName) {
  var ROSTER_COLS = 3;
  var GAME_COLS   = 5;
  var totalCols   = ROSTER_COLS + games.length * GAME_COLS;
  var requests    = [];

  function rc(r,c)         { return { sheetId:sheetId, startRowIndex:r, endRowIndex:r+1, startColumnIndex:c, endColumnIndex:c+1 }; }
  function rr(r1,r2,c1,c2) { return { sheetId:sheetId, startRowIndex:r1, endRowIndex:r2, startColumnIndex:c1, endColumnIndex:c2 }; }

  // Freeze
  requests.push({ updateSheetProperties: {
    properties: { sheetId:sheetId, gridProperties: { frozenRowCount:3, frozenColumnCount:3 } },
    fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
  }});

  // Column widths
  var widths = [{i:0,w:110},{i:1,w:110},{i:2,w:40}];
  games.forEach(function(g,gi) {
    var base = ROSTER_COLS + gi * GAME_COLS;
    [50,45,50,80,40].forEach(function(w,j) { widths.push({i:base+j,w:w}); });
  });
  widths.forEach(function(x) {
    requests.push({ updateDimensionProperties: {
      range: { sheetId:sheetId, dimension:"COLUMNS", startIndex:x.i, endIndex:x.i+1 },
      properties: { pixelSize:x.w }, fields:"pixelSize"
    }});
  });

  // Row 1 — tournament name
  requests.push({ mergeCells: { range: rr(0,1,0,ROSTER_COLS), mergeType:"MERGE_ALL" }});
  requests.push({ updateCells: { range: rc(0,0), fields:"userEnteredValue,userEnteredFormat",
    rows:[{ values:[{ userEnteredValue:{stringValue:tournamentName}, userEnteredFormat:fmt("#0d2040","#c8a84b",true) }]}]
  }});

  // Day group headers
  var dayGroups = {};
  games.forEach(function(g,gi) {
    if (!dayGroups[g.dayIdx]) dayGroups[g.dayIdx] = { label:g.dayLabel, start:gi, count:0 };
    dayGroups[g.dayIdx].count++;
  });
  Object.values(dayGroups).forEach(function(dg) {
    var col  = ROSTER_COLS + dg.start * GAME_COLS;
    var span = dg.count * GAME_COLS;
    if (span > 1) requests.push({ mergeCells: { range: rr(0,1,col,col+span), mergeType:"MERGE_ALL" }});
    requests.push({ updateCells: { range: rc(0,col), fields:"userEnteredValue,userEnteredFormat",
      rows:[{ values:[{ userEnteredValue:{stringValue:dg.label}, userEnteredFormat:fmt("#1a2f4e","#c8a84b",true) }]}]
    }});
  });

  // Row 2 — game headers
  var r2 = [
    { userEnteredValue:{stringValue:"Surname"},    userEnteredFormat:fmt("#2a4060","#e8dcc8",true,"LEFT") },
    { userEnteredValue:{stringValue:"First Name"}, userEnteredFormat:fmt("#2a4060","#e8dcc8",true,"LEFT") },
    { userEnteredValue:{stringValue:"#"},          userEnteredFormat:fmt("#2a4060","#e8dcc8",true) },
  ];
  games.forEach(function(g,gi) {
    var col = ROSTER_COLS + gi * GAME_COLS;
    requests.push({ mergeCells: { range: rr(1,2,col,col+GAME_COLS), mergeType:"MERGE_ALL" }});
    for (var i=0; i<GAME_COLS; i++) {
      r2.push({ userEnteredValue:{stringValue: i===0 ? "Game "+g.gameNum : ""},
        userEnteredFormat:fmt("#2a4060","#e8dcc8",true) });
    }
  });
  requests.push({ updateCells: { range: rr(1,2,0,totalCols), fields:"userEnteredValue,userEnteredFormat", rows:[{values:r2}] }});

  // Row 3 — column headers
  var r3 = ["Surname","First Name","#"].map(function(h) {
    return { userEnteredValue:{stringValue:h}, userEnteredFormat:fmt("#1a3050","#8fa8c8",true) };
  });
  games.forEach(function() {
    ["DO","P","Start","STATUS","C"].forEach(function(h) {
      r3.push({ userEnteredValue:{stringValue:h}, userEnteredFormat:fmt("#1a3050","#8fa8c8",true) });
    });
  });
  requests.push({ updateCells: { range: rr(2,3,0,totalCols), fields:"userEnteredValue,userEnteredFormat", rows:[{values:r3}] }});

  // Player rows
  var playerRows = team.players.map(function(p,pi) {
    var bg = pi%2===0 ? "#0d1e30" : "#0a1628";
    var cells = [
      { userEnteredValue:{stringValue:p.surname||""},   userEnteredFormat:fmt(bg,"#e8dcc8",false,"LEFT") },
      { userEnteredValue:{stringValue:p.firstName||""}, userEnteredFormat:fmt(bg,"#e8dcc8",false,"LEFT") },
      { userEnteredValue:{stringValue:p.number||""},    userEnteredFormat:fmt(bg,"#e8dcc8") },
    ];
    games.forEach(function() {
      cells.push(
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") },
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8",true) },
        { userEnteredValue:{stringValue:""}, userEnteredFormat:fmt(bg,"#e8dcc8") }
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
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error:"Method not allowed" });
  }

  var body = req.body;
  if (!body) return res.status(400).json({ error:"No request body" });

  var tournamentName = body.tournamentName;
  var startDate      = body.startDate;
  var days           = body.days;
  var teams          = body.teams;
  var email          = body.email;

  if (!email || !tournamentName || !days || !teams) {
    return res.status(400).json({ error:"Missing required fields" });
  }

  var credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch(e) {
    return res.status(500).json({ error:"Bad service account JSON: " + e.message });
  }

  var auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  var sheets = google.sheets({ version:"v4", auth:auth });
  var drive  = google.drive({ version:"v3", auth:auth });

  try {
    var games = buildGameList(days);

    // Copy the template instead of creating from scratch
    var copied = await drive.files.copy({
      fileId: TEMPLATE_ID,
      requestBody: { name: tournamentName },
    });

    var spreadsheetId = copied.data.id;

    // Get the copied sheet's existing sheets so we can delete/add tabs
    var meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId });
    var existingSheets = meta.data.sheets;

    // Build add sheet requests for each team
    var setupRequests = [];
    teams.forEach(function(team) {
      setupRequests.push({ addSheet: { properties: { title: team.name || "Team" } } });
    });

    // Delete all existing sheets after adding new ones
    existingSheets.forEach(function(s) {
      setupRequests.push({ deleteSheet: { sheetId: s.properties.sheetId } });
    });

    var setupResult = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: { requests: setupRequests }
    });

    // Get the new sheet IDs from the response
    var newSheetIds = setupResult.data.replies
      .filter(function(r) { return r.addSheet; })
      .map(function(r) { return r.addSheet.properties.sheetId; });

    // Build formatting requests for each team
    var allRequests = [];
    teams.forEach(function(team, ti) {
      var reqs = buildSheetRequests(newSheetIds[ti], team, games, tournamentName);
      allRequests = allRequests.concat(reqs);
    });

    // Send in batches of 50
    for (var i = 0; i < allRequests.length; i += 50) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: { requests: allRequests.slice(i, i+50) }
      });
    }

    // Share to user
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type:"user", role:"writer", emailAddress:email },
      sendNotificationEmail: true,
      emailMessage: "Your " + tournamentName + " pitcher tracking spreadsheet is ready.",
    });

    var url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit";
    return res.status(200).json({ url:url, spreadsheetId:spreadsheetId });

  } catch(err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
