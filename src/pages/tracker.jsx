import { useState, useCallback } from "react";

// Little League league age rules:
// League age = age as of 31 Aug of the CURRENT season year
// (i.e. how old the player is between 1 Sep prev year and 31 Aug current year)
// Season year = the calendar year of the tournament start date

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LEAGUES = ["LL","IL","JL","SL"];

// League full names (display only, no age hints)
const LEAGUE_NAMES = {
  LL: "Little League",
  IL: "Intermediate League",
  JL: "Junior League",
  SL: "Senior League",
};

const uid = () => Math.random().toString(36).slice(2,8);
const emptyPlayer = () => ({ id: uid(), surname: "", firstName: "", number: "", dob: "" });
const emptyTeam   = () => ({ id: uid(), name: "", league: "LL", players: [emptyPlayer()] });
const emptyDay    = (i) => ({ id: uid(), label: DAYS_OF_WEEK[i % 7], games: 2 });

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    minHeight:"100vh", background:"#0a1628",
    fontFamily:"'Georgia', 'Times New Roman', serif",
    color:"#e8dcc8", padding:"0 0 80px",
  },
  hero: {
    background:"linear-gradient(135deg,#0a1628 0%,#1a2f4e 50%,#0d2040 100%)",
    borderBottom:"3px solid #c8a84b",
    padding:"40px 32px 32px", textAlign:"center",
    position:"relative", overflow:"hidden",
  },
  heroTitle: {
    fontSize:"2.4rem", fontWeight:"bold", color:"#c8a84b",
    letterSpacing:"0.12em", textTransform:"uppercase",
    textShadow:"0 2px 12px rgba(200,168,75,0.4)", margin:"0 0 6px",
  },
  heroSub: { fontSize:"0.95rem", color:"#8fa8c8", letterSpacing:"0.05em" },
  container: { maxWidth:1100, margin:"0 auto", padding:"0 20px" },
  section: {
    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(200,168,75,0.25)",
    borderRadius:12, padding:"24px", marginTop:24,
  },
  sectionTitle: {
    fontSize:"1rem", fontWeight:"bold", color:"#c8a84b",
    textTransform:"uppercase", letterSpacing:"0.1em",
    marginBottom:16, display:"flex", alignItems:"center", gap:8,
  },
  row: { display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end", marginBottom:10 },
  label: { fontSize:"0.78rem", color:"#8fa8c8", marginBottom:4, display:"block", letterSpacing:"0.04em" },
  input: {
    background:"rgba(255,255,255,0.07)", border:"1px solid rgba(200,168,75,0.3)",
    borderRadius:6, padding:"8px 10px", color:"#e8dcc8", fontSize:"0.9rem",
    outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit",
  },
  select: {
    background:"#0d2040", border:"1px solid rgba(200,168,75,0.3)",
    borderRadius:6, padding:"8px 10px", color:"#e8dcc8", fontSize:"0.9rem",
    outline:"none", width:"100%", cursor:"pointer", fontFamily:"inherit",
  },
  btn: (variant="primary") => ({
    padding: variant==="small" ? "5px 12px" : "10px 20px",
    borderRadius:6, border:"none", cursor:"pointer", fontWeight:"bold",
    fontSize: variant==="small" ? "0.78rem" : "0.88rem",
    letterSpacing:"0.05em", transition:"all 0.2s",
    background: variant==="danger"    ? "rgba(180,50,50,0.7)"
      : variant==="secondary" ? "rgba(255,255,255,0.08)"
      : "linear-gradient(135deg,#c8a84b,#a07830)",
    color: variant==="secondary" ? "#8fa8c8" : "#0a1628",
    border: variant==="secondary" ? "1px solid rgba(200,168,75,0.2)" : "none",
  }),
  playerRow: {
    display:"grid",
    gridTemplateColumns:"1fr 1fr 55px 115px 28px",
    gap:8, alignItems:"end", marginBottom:6,
  },
  playerHdr: {
    display:"grid",
    gridTemplateColumns:"1fr 1fr 55px 115px 28px",
    gap:8, marginBottom:4, padding:"0 0 4px",
    borderBottom:"1px solid rgba(200,168,75,0.15)",
  },
  dayCard: {
    background:"rgba(200,168,75,0.06)", border:"1px solid rgba(200,168,75,0.2)",
    borderRadius:8, padding:"12px 16px", marginBottom:8,
    display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
  },
  teamCard: {
    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(200,168,75,0.2)",
    borderRadius:10, padding:"16px", marginBottom:16,
  },
  subText: { fontSize:"0.72rem", color:"#5a7a9a", marginTop:3, fontStyle:"italic" },
  codeBox: {
    background:"#050e1a", border:"1px solid rgba(200,168,75,0.3)",
    borderRadius:8, padding:"16px", fontFamily:"'Courier New',monospace",
    fontSize:"0.78rem", color:"#a8e8a8", whiteSpace:"pre-wrap",
    maxHeight:400, overflowY:"auto", marginTop:12,
  },
  stepList: {
    background:"rgba(200,168,75,0.06)", border:"1px solid rgba(200,168,75,0.2)",
    borderRadius:10, padding:"20px 24px", marginTop:16,
    listStyle:"none",
  },
  infoBox: {
    background:"rgba(80,160,80,0.1)", border:"1px solid rgba(80,160,80,0.3)",
    borderRadius:8, padding:"12px 16px", marginTop:12,
    fontSize:"0.82rem", color:"#a8d8a8", lineHeight:1.7,
  },
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function App() {
  const [tourneyName, setTourneyName] = useState("Summer Tournament 2025");
  const [startDate,   setStartDate]   = useState("");
  const [numDays,     setNumDays]     = useState(3);
  const [days,        setDays]        = useState([emptyDay(0),emptyDay(1),emptyDay(2)]);
  const [teams,       setTeams]       = useState([emptyTeam(), emptyTeam()]);
  const [generated,   setGenerated]   = useState("");
  const [copied,      setCopied]      = useState(false);

  const setDayCount = (n) => {
    n = Math.max(1, Math.min(10, Number(n)));
    setNumDays(n);
    setDays(prev => {
      const next = [...prev];
      while (next.length < n) next.push(emptyDay(next.length));
      return next.slice(0, n);
    });
  };
  const updateDay    = (i,f,v) => setDays(p => p.map((d,j) => j===i ? {...d,[f]:v} : d));
  const addTeam      = () => setTeams(p => p.length < 20 ? [...p, emptyTeam()] : p);
  const removeTeam   = (id) => setTeams(p => p.filter(t => t.id !== id));
  const updateTeam   = (id,f,v) => setTeams(p => p.map(t => t.id===id ? {...t,[f]:v} : t));
  const addPlayer    = (tid) => setTeams(p => p.map(t =>
    t.id===tid && t.players.length < 16 ? {...t, players:[...t.players, emptyPlayer()]} : t));
  const removePlayer = (tid,pid) => setTeams(p => p.map(t =>
    t.id===tid ? {...t, players: t.players.filter(pl => pl.id!==pid)} : t));
  const updatePlayer = (tid,pid,f,v) => setTeams(p => p.map(t =>
    t.id===tid ? {...t, players: t.players.map(pl => pl.id===pid ? {...pl,[f]:v} : pl)} : t));

  const generate = useCallback(() => {
    const teamsJson = JSON.stringify(teams.map(t => ({
      name:    t.name || "Team",
      league:  t.league,
      players: t.players.map(p => ({
        surname:   p.surname   || "Surname",
        firstName: p.firstName || "FirstName",
        number:    p.number    || "",
        dob:       p.dob       || "",
      })),
    })), null, 2);
    const daysJson = JSON.stringify(days.map(d => ({ label: d.label, games: d.games })));
    setGenerated(buildScript(tourneyName, startDate, daysJson, teamsJson));
  }, [tourneyName, startDate, days, teams]);

  const copy = () => {
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={S.wrap}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={{fontSize:"2.5rem",marginBottom:8}}>⚾</div>
        <h1 style={S.heroTitle}>Baseball Tournament Tracker</h1>
        <p style={S.heroSub}>Apps Script Builder · PitchSmart Rules · Little League · Intermediate · Junior · Senior</p>
      </div>

      <div style={S.container}>

        {/* Tournament Info */}
        <div style={S.section}>
          <div style={S.sectionTitle}>⚙️ Tournament Info</div>
          <div style={S.row}>
            <div style={{flex:2}}>
              <label style={S.label}>Tournament Name</label>
              <input style={S.input} value={tourneyName}
                onChange={e => setTourneyName(e.target.value)} placeholder="e.g. Summer Cup 2025"/>
            </div>
            <div style={{flex:1}}>
              <label style={S.label}>Tournament Start Date</label>
              <input style={S.input} type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}/>
              <div style={S.subText}>
                Sets the season year for calculating Little League ages (1 Sep – 31 Aug)
              </div>
            </div>
          </div>
        </div>

        {/* Days */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📅 Tournament Days</div>
          <div style={S.row}>
            <div style={{width:130}}>
              <label style={S.label}>Number of Days</label>
              <input style={S.input} type="number" min={1} max={10} value={numDays}
                onChange={e => setDayCount(e.target.value)}/>
            </div>
          </div>
          {days.map((d,i) => (
            <div key={d.id} style={S.dayCard}>
              <span style={{color:"#c8a84b", fontWeight:"bold", minWidth:52, fontSize:"0.85rem"}}>Day {i+1}</span>
              <div style={{flex:1}}>
                <label style={S.label}>Day Name</label>
                <select style={S.select} value={d.label}
                  onChange={e => updateDay(i,"label",e.target.value)}>
                  {DAYS_OF_WEEK.map(dn => <option key={dn}>{dn}</option>)}
                </select>
              </div>
              <div style={{width:140}}>
                <label style={S.label}>Games this day</label>
                <select style={S.select} value={d.games}
                  onChange={e => updateDay(i,"games",Number(e.target.value))}>
                  <option value={1}>1 Game</option>
                  <option value={2}>2 Games</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Teams */}
        <div style={S.section}>
          <div style={{...S.sectionTitle, justifyContent:"space-between"}}>
            <span>🧢 Teams ({teams.length}/20)</span>
            {teams.length < 20 &&
              <button style={S.btn("secondary")} onClick={addTeam}>+ Add Team</button>}
          </div>

          {teams.map((team, ti) => (
            <div key={team.id} style={S.teamCard}>
              <div style={{...S.row, marginBottom:10}}>
                <div style={{flex:2}}>
                  <label style={S.label}>Team Name</label>
                  <input style={S.input} value={team.name}
                    onChange={e => updateTeam(team.id,"name",e.target.value)}
                    placeholder={`Team ${ti+1}`}/>
                </div>
                <div style={{flex:1}}>
                  <label style={S.label}>League</label>
                  <select style={S.select} value={team.league}
                    onChange={e => updateTeam(team.id,"league",e.target.value)}>
                    {LEAGUES.map(l =>
                      <option key={l} value={l}>{LEAGUE_NAMES[l]} ({l})</option>)}
                  </select>
                </div>
                <div style={{alignSelf:"center", paddingTop:18}}>
                  {teams.length > 1 &&
                    <button style={S.btn("danger")} onClick={() => removeTeam(team.id)}>✕ Remove</button>}
                </div>
              </div>

              {/* Player column headers */}
              <div style={S.playerHdr}>
                {["Surname","First Name","#","Date of Birth",""].map((h,i) => (
                  <span key={i} style={{fontSize:"0.72rem",color:"#5a7a9a",letterSpacing:"0.04em"}}>{h}</span>
                ))}
              </div>

              {/* Players */}
              {team.players.map(pl => (
                <div key={pl.id} style={S.playerRow}>
                  <input style={S.input} placeholder="Surname" value={pl.surname}
                    onChange={e => updatePlayer(team.id,pl.id,"surname",e.target.value)}/>
                  <input style={S.input} placeholder="First name" value={pl.firstName}
                    onChange={e => updatePlayer(team.id,pl.id,"firstName",e.target.value)}/>
                  <input style={S.input} placeholder="#" value={pl.number}
                    onChange={e => updatePlayer(team.id,pl.id,"number",e.target.value)}/>
                  <input style={{...S.input, fontSize:"0.8rem"}} type="date" value={pl.dob}
                    onChange={e => updatePlayer(team.id,pl.id,"dob",e.target.value)}/>
                  <button style={{...S.btn("danger"), padding:"6px 8px", fontSize:"0.8rem"}}
                    onClick={() => removePlayer(team.id, pl.id)}>✕</button>
                </div>
              ))}

              {team.players.length < 16 &&
                <button style={{...S.btn("secondary"), marginTop:8, fontSize:"0.78rem"}}
                  onClick={() => addPlayer(team.id)}>+ Add Player</button>}
              <div style={{...S.subText, marginTop:6}}>
                {team.players.length}/16 players · Date of birth determines PitchSmart pitch limits
              </div>
            </div>
          ))}
        </div>

        {/* Generate */}
        <div style={{textAlign:"center", marginTop:28}}>
          <button style={{...S.btn(), padding:"14px 40px", fontSize:"1rem", letterSpacing:"0.08em"}}
            onClick={generate}>
            ⚾ Generate Apps Script
          </button>
        </div>

        {/* Output */}
        {generated && (<>
          <div style={S.section}>
            <div style={{...S.sectionTitle, justifyContent:"space-between"}}>
              <span>📋 Generated Script</span>
              <button style={S.btn()} onClick={copy}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button>
            </div>
            <div style={S.codeBox}>{generated}</div>
          </div>

          {/* Install guide */}
          <div style={S.section}>
            <div style={S.sectionTitle}>🚀 How to Install (Step by Step)</div>
            <ol style={S.stepList}>
              {[
                <>Open <strong style={{color:"#c8a84b"}}>Google Sheets</strong> at <em>sheets.google.com</em> and click <strong style={{color:"#c8a84b"}}>+ Blank</strong> to start a new spreadsheet.</>,
                <>Click the menu <strong style={{color:"#c8a84b"}}>Extensions</strong> at the top, then click <strong style={{color:"#c8a84b"}}>Apps Script</strong>. A new tab opens — this is the code editor.</>,
                <>You'll see some default text already there. Click inside it, press <strong style={{color:"#c8a84b"}}>Ctrl+A</strong> (Windows) or <strong style={{color:"#c8a84b"}}>Cmd+A</strong> (Mac) to select all, then press <strong style={{color:"#c8a84b"}}>Delete</strong> to clear it.</>,
                <>Go back to this page and click <strong style={{color:"#c8a84b"}}>Copy to Clipboard</strong> above. Then switch back to Apps Script and press <strong style={{color:"#c8a84b"}}>Ctrl+V</strong> (or <strong style={{color:"#c8a84b"}}>Cmd+V</strong>) to paste.</>,
                <>Press <strong style={{color:"#c8a84b"}}>Ctrl+S</strong> (or <strong style={{color:"#c8a84b"}}>Cmd+S</strong>) to save. If it asks for a project name, type anything and click OK.</>,
                <>Find the dropdown near the top that says <strong style={{color:"#c8a84b"}}>"Select function"</strong>. Click it and choose <strong style={{color:"#c8a84b"}}>setupTournament</strong>.</>,
                <>Click the <strong style={{color:"#c8a84b"}}>▶ Run button</strong>. Google will ask for permission — click <strong style={{color:"#c8a84b"}}>Review Permissions</strong>, select your Google account, then click <strong style={{color:"#c8a84b"}}>Allow</strong>.</>,
                <>Switch back to your spreadsheet tab. You'll see a tab for each team and a <strong style={{color:"#c8a84b"}}>⚾ Tournament</strong> menu at the top.</>,
                <>Enter pitches, catch innings and DO (yes/no) for each player in each game. Colours and status update automatically.</>,
                <>If anything looks off, go to <strong style={{color:"#c8a84b"}}>⚾ Tournament → Recalculate All Sheets</strong> to refresh everything.</>
              ].map((step,i) => (
                <li key={i} style={{
                  paddingLeft:38, position:"relative", marginBottom:14,
                  fontSize:"0.88rem", lineHeight:1.65, color:"#c8d8e8", listStyle:"none",
                }}>
                  <span style={{
                    position:"absolute", left:0, top:1,
                    background:"rgba(200,168,75,0.2)", color:"#c8a84b",
                    borderRadius:"50%", width:24, height:24,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.75rem", fontWeight:"bold",
                  }}>{i+1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <div style={S.infoBox}>
              <strong>ℹ️ How league ages are calculated:</strong> Little League uses a "league age" system —
              a player's league age is how old they turn between <strong>1 September of the previous year
              and 31 August of the current season year</strong>. The season year is taken from the tournament
              start date you entered. This is used to select the correct PitchSmart pitch limits for each player.
              Players without a date of birth entered will use a safe default for their league.
              <br/><br/>
              <strong>ℹ️ Column guide:</strong> <strong>DO</strong> = Designated Opener (Yes/No) ·
              <strong> P</strong> = Total pitches thrown · <strong>Start</strong> = First batter faced number ·
              <strong> STATUS</strong> = Rest requirement (auto-calculated) · <strong>C</strong> = Innings caught
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Script builder ─────────────────────────────────────────────────────────────
function buildScript(tourneyName, startDate, daysJson, teamsJson) {
  return `// ═══════════════════════════════════════════════════════════════════════
// ${tourneyName} — Tournament Pitcher Tracker
// Generated by Tournament Script Builder
// ═══════════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────────────────
var CONFIG = {
  tournamentName: ${JSON.stringify(tourneyName)},
  startDate: ${JSON.stringify(startDate || "")},  // YYYY-MM-DD — used to derive season year for league age
  days: ${daysJson},
  teams: ${teamsJson},
};

// ── League Age (Little League system) ────────────────────────────────────────
// League age = how old the player turns between 1 Sep (prev year) and 31 Aug (season year)
// Season year = calendar year of the tournament start date
function calcLeagueAge(dobStr, startDateStr) {
  if (!dobStr) return null;
  try {
    var dob      = new Date(dobStr);
    var ref      = startDateStr ? new Date(startDateStr) : new Date();
    var seasonYr = ref.getFullYear();
    // Cutoff: 31 Aug of season year. If born on or before that date, league age = seasonYr - birthYear
    var cutoff   = new Date(seasonYr, 7, 31); // Aug = month 7 (0-indexed)
    var age      = cutoff.getFullYear() - dob.getFullYear();
    // If birthday is after 31 Aug in the same year, they haven't had that birthday yet within the window
    var dobThisYear = new Date(seasonYr, dob.getMonth(), dob.getDate());
    if (dobThisYear > cutoff) age--;
    return age;
  } catch(e) { return null; }
}

function getLeagueDefaultAge(league) {
  if (league === "LL") return 12;
  if (league === "IL") return 13;
  if (league === "JL") return 15;
  return 17; // SL
}

// ── PitchSmart limits by league age ──────────────────────────────────────────
function getPitchSmartForLeagueAge(leagueAge) {
  if (leagueAge <= 12) return {
    dailyMax: 85,
    tiers: [{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}]
  };
  if (leagueAge <= 14) return {
    dailyMax: 85,
    tiers: [{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}]
  };
  if (leagueAge <= 16) return {
    dailyMax: 95,
    tiers: [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:75,rest:3},{max:95,rest:4}]
  };
  // 17-18
  return {
    dailyMax: 105,
    tiers: [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:80,rest:3},{max:105,rest:4}]
  };
}

// ── Column layout ─────────────────────────────────────────────────────────────
// Roster: Surname | FirstName | # | then per-game blocks
// Each game block: DO | P | Start | STATUS | C
var ROSTER_COLS = 3;
var GAME_COLS   = 5;
var GAME_HDR    = ["DO","P","Start","STATUS","C"];

function buildGameList() {
  var games = [];
  CONFIG.days.forEach(function(d, di) {
    for (var g = 1; g <= d.games; g++) {
      games.push({ dayIdx: di, gameNum: g, dayLabel: d.label });
    }
  });
  return games;
}

// ── Main setup ────────────────────────────────────────────────────────────────
function setupTournament() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setName(CONFIG.tournamentName);

  var existing = ss.getSheets();
  existing.forEach(function(sh) {
    if (sh.getName() !== "Sheet1") ss.deleteSheet(sh);
  });

  CONFIG.teams.forEach(function(team, ti) {
    var sh = ss.insertSheet(team.name || ("Team " + (ti+1)));
    buildTeamSheet(sh, team);
  });

  var blank = ss.getSheetByName("Sheet1");
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  SpreadsheetApp.getUi().createMenu("⚾ Tournament")
    .addItem("Recalculate All Sheets", "recalcAll")
    .addItem("Re-run Setup (clears data)", "setupTournament")
    .addToUi();

  SpreadsheetApp.getUi().alert("✅ Setup complete — " + CONFIG.teams.length + " team sheets created.");
}

function recalcAll() {
  CONFIG.teams.forEach(function(team) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(team.name || "Team");
    if (sh) recalcSheet(sh, team);
  });
}

// ── Build a team sheet ────────────────────────────────────────────────────────
function buildTeamSheet(sh, team) {
  var games     = buildGameList();
  var totalCols = ROSTER_COLS + games.length * GAME_COLS;

  sh.clearContents();
  sh.clearFormats();

  // Row 1: Day group headers
  var dayGroups = {};
  games.forEach(function(g, gi) {
    var key = g.dayIdx;
    if (!dayGroups[key]) dayGroups[key] = { label: g.dayLabel, start: gi, count: 0 };
    dayGroups[key].count++;
  });

  sh.getRange(1,1,1,ROSTER_COLS).merge().setValue(CONFIG.tournamentName)
    .setBackground("#0d2040").setFontColor("#c8a84b").setFontWeight("bold");

  Object.keys(dayGroups).forEach(function(key) {
    var dg = dayGroups[key];
    var startCol = ROSTER_COLS + dg.start * GAME_COLS + 1;
    var spanCols = dg.count * GAME_COLS;
    var cell = sh.getRange(1, startCol, 1, spanCols);
    if (spanCols > 1) cell.merge();
    cell.setValue(dg.label).setBackground("#1a2f4e").setFontColor("#c8a84b")
        .setFontWeight("bold").setHorizontalAlignment("center");
  });

  // Row 2: Game headers
  sh.getRange(2, 1).setValue("Surname");
  sh.getRange(2, 2).setValue("First Name");
  sh.getRange(2, 3).setValue("#");
  games.forEach(function(g, gi) {
    var col = ROSTER_COLS + gi * GAME_COLS + 1;
    sh.getRange(2, col, 1, GAME_COLS).merge()
      .setValue("Game " + g.gameNum)
      .setBackground("#2a4060").setFontColor("#e8dcc8")
      .setHorizontalAlignment("center").setFontWeight("bold");
  });
  sh.getRange(2, 1, 1, ROSTER_COLS).setBackground("#2a4060").setFontColor("#e8dcc8").setFontWeight("bold");

  // Row 3: Column headers
  sh.getRange(3, 1).setValue("Surname");
  sh.getRange(3, 2).setValue("First Name");
  sh.getRange(3, 3).setValue("#");
  games.forEach(function(g, gi) {
    GAME_HDR.forEach(function(h, hi) {
      sh.getRange(3, ROSTER_COLS + gi * GAME_COLS + hi + 1).setValue(h);
    });
  });
  sh.getRange(3, 1, 1, totalCols).setBackground("#1a3050").setFontColor("#8fa8c8")
    .setFontWeight("bold").setHorizontalAlignment("center");

  // Rows 4+: Players
  team.players.forEach(function(p, pi) {
    var row = 4 + pi;
    sh.getRange(row, 1).setValue(p.surname);
    sh.getRange(row, 2).setValue(p.firstName);
    sh.getRange(row, 3).setValue(p.number);

    // Store DOB in cell note for runtime use
    if (p.dob) sh.getRange(row, 1).setNote("DOB:" + p.dob);

    var bg = pi % 2 === 0 ? "#0d1e30" : "#0a1628";
    sh.getRange(row, 1, 1, totalCols).setBackground(bg).setFontColor("#e8dcc8");

    games.forEach(function(g, gi) {
      var baseCol = ROSTER_COLS + gi * GAME_COLS + 1;
      sh.getRange(row, baseCol).setHorizontalAlignment("center");   // DO
      sh.getRange(row, baseCol+1).setHorizontalAlignment("center"); // P
      sh.getRange(row, baseCol+2).setHorizontalAlignment("center"); // Start
      sh.getRange(row, baseCol+3).setHorizontalAlignment("center").setFontWeight("bold"); // STATUS
      sh.getRange(row, baseCol+4).setHorizontalAlignment("center"); // C
    });
  });

  // Column widths
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 40);
  games.forEach(function(g, gi) {
    var base = ROSTER_COLS + gi * GAME_COLS + 1;
    sh.setColumnWidth(base,   50);
    sh.setColumnWidth(base+1, 45);
    sh.setColumnWidth(base+2, 50);
    sh.setColumnWidth(base+3, 80);
    sh.setColumnWidth(base+4, 40);
  });

  sh.freezeRows(3);
  sh.freezeColumns(3);
}

// ── onEdit trigger ────────────────────────────────────────────────────────────
function onEdit(e) {
  var sh   = e.range.getSheet();
  var team = null;
  for (var i = 0; i < CONFIG.teams.length; i++) {
    if (CONFIG.teams[i].name === sh.getName()) { team = CONFIG.teams[i]; break; }
  }
  if (!team) return;
  recalcSheet(sh, team);
}

// ── Recalculate all rules for a sheet ────────────────────────────────────────
function recalcSheet(sh, team) {
  var games   = buildGameList();
  var players = team.players;

  players.forEach(function(p, pi) {
    var row = 4 + pi;

    // Retrieve DOB from cell note, fall back to config value
    var note     = sh.getRange(row, 1).getNote() || "";
    var dobMatch = note.match(/DOB:([\d-]+)/);
    var dob      = dobMatch ? dobMatch[1] : (p.dob || "");
    var leagueAge = calcLeagueAge(dob, CONFIG.startDate) || getLeagueDefaultAge(team.league);
    var ps        = getPitchSmartForLeagueAge(leagueAge);

    // Read all game data for this player
    var gameData = games.map(function(g, gi) {
      var base = ROSTER_COLS + gi * GAME_COLS + 1;
      return {
        gi:      gi,
        g:       g,
        doVal:   (sh.getRange(row, base).getValue()   || "").toString().toUpperCase().trim(),
        p:       Number(sh.getRange(row, base+1).getValue()) || 0,
        start:   Number(sh.getRange(row, base+2).getValue()) || 0,
        c:       Number(sh.getRange(row, base+4).getValue()) || 0,
        baseCol: base,
      };
    });

    // Colour DO cells
    gameData.forEach(function(gd) {
      var doCell = sh.getRange(row, gd.baseCol);
      if (gd.doVal === "YES" || gd.doVal === "Y") {
        doCell.setBackground("#c8f0c8").setFontColor("#1a7a1a").setFontWeight("bold");
      } else if (gd.doVal === "NO" || gd.doVal === "N") {
        doCell.setBackground("#f08080").setFontColor("#ffffff").setFontWeight("bold");
      } else {
        doCell.setBackground(null).setFontColor(null).setFontWeight("normal");
      }
    });

    // Group games by day
    var gamesByDay = {};
    gameData.forEach(function(gd) {
      var di = gd.g.dayIdx;
      if (!gamesByDay[di]) gamesByDay[di] = [];
      gamesByDay[di].push(gd);
    });

    // Daily pitch totals and days pitched
    var pitchesByDay = {};
    var pitchedDays  = [];
    Object.keys(gamesByDay).forEach(function(di) {
      di = Number(di);
      var total = 0;
      gamesByDay[di].forEach(function(gd) { total += gd.p; });
      pitchesByDay[di] = total;
      if (total > 0) pitchedDays.push(di);
    });
    pitchedDays.sort(function(a,b){ return a-b; });

    // Determine blackout days from rest requirements
    var blackoutDays = {};
    pitchedDays.forEach(function(di) {
      var total       = pitchesByDay[di];
      var restNeeded  = 0;
      for (var t = 0; t < ps.tiers.length; t++) {
        if (total <= ps.tiers[t].max) { restNeeded = ps.tiers[t].rest; break; }
      }
      for (var r = 1; r <= restNeeded; r++) {
        blackoutDays[di + r] = "Rest " + restNeeded + "d";
      }
    });

    // Consecutive 3-day rule
    for (var i = 0; i < pitchedDays.length - 1; i++) {
      if (pitchedDays[i+1] === pitchedDays[i] + 1) {
        blackoutDays[pitchedDays[i] + 2] = "3rd Day";
      }
    }

    // Process each game cell
    gameData.forEach(function(gd) {
      var statusCell = sh.getRange(row, gd.baseCol + 3);
      var pCell      = sh.getRange(row, gd.baseCol + 1);
      var startCell  = sh.getRange(row, gd.baseCol + 2);
      var di         = gd.g.dayIdx;
      var gn         = gd.g.gameNum;

      // Full day blacked out (rest or 3-day rule)
      if (blackoutDays[di]) {
        [pCell, startCell, statusCell].forEach(function(c) {
          c.setBackground("#000000").setFontColor("#444444");
        });
        statusCell.setValue(blackoutDays[di]);
        return;
      }

      // LL only: pitched in Game 1 → Game 2 blacked out silently
      if (team.league === "LL" && gn === 2) {
        var g1 = gamesByDay[di] ? gamesByDay[di].filter(function(x){ return x.g.gameNum===1; })[0] : null;
        if (g1 && g1.p > 0) {
          [pCell, startCell, statusCell].forEach(function(c) {
            c.setBackground("#000000").setFontColor("#444444");
          });
          statusCell.setValue("");
          return;
        }
      }

      // Rule violation flags (human review required)
      var flags = [];

      if (gn === 2) {
        var g1r = gamesByDay[di] ? gamesByDay[di].filter(function(x){ return x.g.gameNum===1; })[0] : null;
        if (g1r) {
          if (g1r.p >= 21 && gd.p > 0)  flags.push("⚠️ Pitched ≥21 in G1");
          if (g1r.c >= 4  && gd.p > 0)  flags.push("⚠️ Caught ≥4 inn G1");
        }
      }
      if (gd.c >= 4 && gd.p > 0) flags.push("⚠️ C+P same game");

      if (flags.length > 0) {
        statusCell.setValue(flags.join(" | ")).setBackground("#cc2222").setFontColor("#ffffff");
        pCell.setBackground("#330000");
        return;
      }

      // Normal: calculate rest from pitches
      if (gd.p > 0) {
        var rest = 0;
        for (var t = 0; t < ps.tiers.length; t++) {
          if (gd.p <= ps.tiers[t].max) { rest = ps.tiers[t].rest; break; }
        }
        if (rest === 0) {
          statusCell.setValue("Nil").setBackground("#c8f0c8").setFontColor("#1a7a1a");
        } else {
          statusCell.setValue(rest + " Day" + (rest > 1 ? "s" : ""))
            .setBackground("#f5c842").setFontColor("#5a3d00");
        }
        pCell.setBackground(null).setFontColor("#e8dcc8");
        startCell.setBackground(null).setFontColor("#e8dcc8");
      } else {
        statusCell.setValue("").setBackground(null).setFontColor(null);
        pCell.setBackground(null).setFontColor(null);
        startCell.setBackground(null).setFontColor(null);
      }
    });
  });
}

// ── onOpen: restore menu ──────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu("⚾ Tournament")
    .addItem("Recalculate All Sheets", "recalcAll")
    .addItem("Re-run Setup (clears data)", "setupTournament")
    .addToUi();
}
`;
}
