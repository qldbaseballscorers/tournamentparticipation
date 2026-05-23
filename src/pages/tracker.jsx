import { useState, useCallback } from "react";

// ── PitchSmart tables keyed by age ────────────────────────────────────────────
const PITCHSMART = {
  "U12": { dailyMax: 85, tiers: [{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}] },
  "U13": { dailyMax: 85, tiers: [{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}] },
  "U14": { dailyMax: 85, tiers: [{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}] },
  "U15": { dailyMax: 95, tiers: [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:75,rest:3},{max:95,rest:4}] },
  "U16": { dailyMax: 95, tiers: [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:75,rest:3},{max:95,rest:4}] },
  "U17": { dailyMax:105, tiers: [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:80,rest:3},{max:105,rest:4}] },
  "U18": { dailyMax:105, tiers: [{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:80,rest:3},{max:105,rest:4}] },
};

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LEAGUES = ["LL","IL","JL","SL"];

// Age group derived from DOB + tournament start date (calculated in Apps Script)
// League mapping to typical age groups (informational only - DOB drives actual rules)
const LEAGUE_AGE_HINT = {
  LL: "Typically U12 (Little League, ages 9-12)",
  IL: "Typically U13-U14 (Intermediate League, ages 11-13)",
  JL: "Typically U15-U16 (Junior League, ages 12-14)",
  SL: "Typically U17-U18 (Senior League, ages 13-16)",
};

const uid = () => Math.random().toString(36).slice(2,8);

const emptyPlayer = () => ({ id: uid(), surname: "", firstName: "", number: "", dob: "" });
const emptyTeam  = () => ({ id: uid(), name: "", league: "LL", players: [emptyPlayer()] });
const emptyDay   = (i) => ({ id: uid(), label: DAYS_OF_WEEK[i % 7], games: 2 });

// ── Styles ────────────────────────────────────────────────────────────────────
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
    outline:"none", width:"100%", boxSizing:"border-box",
    fontFamily:"inherit",
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
    background: variant==="danger" ? "rgba(180,50,50,0.7)"
      : variant==="secondary" ? "rgba(255,255,255,0.08)"
      : "linear-gradient(135deg,#c8a84b,#a07830)",
    color: variant==="secondary" ? "#8fa8c8" : "#0a1628",
    border: variant==="secondary" ? "1px solid rgba(200,168,75,0.2)" : "none",
  }),
  playerRow: {
    display:"grid",
    gridTemplateColumns:"1fr 1fr 60px 110px 28px",
    gap:8, alignItems:"end", marginBottom:6,
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
  leagueHint: {
    fontSize:"0.72rem", color:"#5a7a9a", marginTop:3, fontStyle:"italic",
  },
  codeBox: {
    background:"#050e1a", border:"1px solid rgba(200,168,75,0.3)",
    borderRadius:8, padding:"16px", fontFamily:"'Courier New',monospace",
    fontSize:"0.78rem", color:"#a8e8a8", whiteSpace:"pre-wrap",
    maxHeight:400, overflowY:"auto", marginTop:12,
  },
  stepList: {
    background:"rgba(200,168,75,0.06)", border:"1px solid rgba(200,168,75,0.2)",
    borderRadius:10, padding:"20px 24px", marginTop:16,
    listStyle:"none", counterReset:"steps",
  },
  step: {
    counterIncrement:"steps", paddingLeft:36,
    position:"relative", marginBottom:12, fontSize:"0.88rem", lineHeight:1.6,
    color:"#c8d8e8",
  },
  badge: (color) => ({
    display:"inline-block", padding:"2px 8px", borderRadius:4,
    fontSize:"0.72rem", fontWeight:"bold", letterSpacing:"0.05em",
    background: color==="gold" ? "rgba(200,168,75,0.2)" : "rgba(100,180,100,0.2)",
    color: color==="gold" ? "#c8a84b" : "#80d880",
    border:`1px solid ${color==="gold" ? "rgba(200,168,75,0.4)" : "rgba(100,180,100,0.3)"}`,
    marginLeft:6,
  }),
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Tracker() {
  const [tourneyName, setTourneyName] = useState("Summer Tournament 2025");
  const [startDate,   setStartDate]   = useState("");
  const [numDays,     setNumDays]     = useState(3);
  const [days,        setDays]        = useState([emptyDay(0),emptyDay(1),emptyDay(2)]);
  const [teams,       setTeams]       = useState([emptyTeam(), emptyTeam()]);
  const [generated,   setGenerated]   = useState("");
  const [copied,      setCopied]      = useState(false);

  // ── Day helpers ──────────────────────────────────────────────────────────────
  const setDayCount = (n) => {
    n = Math.max(1, Math.min(10, Number(n)));
    setNumDays(n);
    setDays(prev => {
      const next = [...prev];
      while (next.length < n) next.push(emptyDay(next.length));
      return next.slice(0, n);
    });
  };
  const updateDay = (i, field, val) => setDays(p => p.map((d,j) => j===i ? {...d,[field]:val} : d));

  // ── Team helpers ─────────────────────────────────────────────────────────────
  const addTeam    = () => setTeams(p => p.length < 20 ? [...p, emptyTeam()] : p);
  const removeTeam = (id) => setTeams(p => p.filter(t => t.id !== id));
  const updateTeam = (id, field, val) => setTeams(p => p.map(t => t.id===id ? {...t,[field]:val} : t));

  const addPlayer = (tid) => setTeams(p => p.map(t =>
    t.id===tid && t.players.length < 16
      ? {...t, players:[...t.players, emptyPlayer()]} : t));
  const removePlayer = (tid, pid) => setTeams(p => p.map(t =>
    t.id===tid ? {...t, players: t.players.filter(pl => pl.id!==pid)} : t));
  const updatePlayer = (tid, pid, field, val) => setTeams(p => p.map(t =>
    t.id===tid ? {...t, players: t.players.map(pl =>
      pl.id===pid ? {...pl,[field]:val} : pl)} : t));

  // ── Code generation ──────────────────────────────────────────────────────
  const generate = useCallback(() => {
    const teamsJson = JSON.stringify(teams.map(t => ({
      name: t.name || "Team",
      league: t.league,
      players: t.players.map(p => ({
        surname:   p.surname   || "Surname",
        firstName: p.firstName || "FirstName",
        number:    p.number    || "",
        dob:       p.dob       || "",
      })),
    })), null, 2);

    const daysJson = JSON.stringify(days.map(d => ({
      label: d.label,
      games: d.games,
    })));

    const code = buildScript(tourneyName, startDate, daysJson, teamsJson);
    setGenerated(code);
  }, [tourneyName, startDate, days, teams]);

  const copy = () => {
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={{fontSize:"2.5rem",marginBottom:8}}>⚾</div>
        <h1 style={S.heroTitle}>Baseball Tournament Tracker</h1>
        <p style={S.heroSub}>Apps Script Builder · PitchSmart Rules · LL / IL / JL / SL Leagues</p>
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
              <div style={S.leagueHint}>Used to calculate player ages from DOB for PitchSmart rules</div>
            </div>
          </div>
        </div>

        {/* Days */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📅 Tournament Days</div>
          <div style={S.row}>
            <div style={{width:120}}>
              <label style={S.label}>Number of Days</label>
              <input style={S.input} type="number" min={1} max={10} value={numDays}
                onChange={e => setDayCount(e.target.value)}/>
            </div>
          </div>
          {days.map((d,i) => (
            <div key={d.id} style={S.dayCard}>
              <span style={{color:"#c8a84b", fontWeight:"bold", minWidth:60, fontSize:"0.85rem"}}>Day {i+1}</span>
              <div style={{flex:1}}>
                <label style={S.label}>Day Label</label>
                <select style={S.select} value={d.label}
                  onChange={e => updateDay(i,"label",e.target.value)}>
                  {DAYS_OF_WEEK.map(dn => <option key={dn}>{dn}</option>)}
                </select>
              </div>
              <div style={{width:130}}>
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
              {/* Team header */}
              <div style={{...S.row, marginBottom:8}}>
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
                    {LEAGUES.map(l => <option key={l}>{l}</option>)}
                  </select>
                  <div style={S.leagueHint}>{LEAGUE_AGE_HINT[team.league]}</div>
                </div>
                <div style={{alignSelf:"center"}}>
                  {teams.length > 1 &&
                    <button style={S.btn("danger")} onClick={() => removeTeam(team.id)}>✕ Remove</button>}
                </div>
              </div>

              {/* League info banner */}
              {team.league === "LL" && (
                <div style={{
                  background:"rgba(200,168,75,0.1)", border:"1px solid rgba(200,168,75,0.25)",
                  borderRadius:6, padding:"6px 12px", marginBottom:10,
                  fontSize:"0.78rem", color:"#c8a84b",
                }}>
                  ⚠️ LL Rule: Pitchers may not pitch in both games on a double-header day.
                  Game 2 pitch cells will be blacked out automatically.
                </div>
              )}

              {/* Player column headers */}
              <div style={{
                display:"grid", gridTemplateColumns:"1fr 1fr 60px 110px 28px",
                gap:8, marginBottom:4, padding:"0 0 4px",
                borderBottom:"1px solid rgba(200,168,75,0.15)",
              }}>
                {["Surname","First Name","#","DOB",""].map((h,i) => (
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
                  <input style={{...S.input, fontSize:"0.78rem"}} type="date" value={pl.dob}
                    onChange={e => updatePlayer(team.id,pl.id,"dob",e.target.value)}/>
                  <button style={{...S.btn("danger"), padding:"6px 8px", fontSize:"0.8rem"}}
                    onClick={() => removePlayer(team.id, pl.id)}>✕</button>
                </div>
              ))}

              {team.players.length < 16 &&
                <button style={{...S.btn("secondary"), marginTop:6, fontSize:"0.78rem"}}
                  onClick={() => addPlayer(team.id)}>+ Add Player</button>}
              <div style={{fontSize:"0.72rem", color:"#5a7a9a", marginTop:4}}>
                {team.players.length}/16 players · DOB used to determine PitchSmart age bracket
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
        {generated && (
          <>
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
                  <>Open <strong style={{color:"#c8a84b"}}>Google Sheets</strong> at <em>sheets.google.com</em> and click <strong style={{color:"#c8a84b"}}>+ Blank</strong> to create a new spreadsheet.</>,
                  <>At the top, click the menu <strong style={{color:"#c8a84b"}}>Extensions</strong>, then click <strong style={{color:"#c8a84b"}}>Apps Script</strong>. A new tab will open — this is the code editor.</>,
                  <>You'll see a box with some default text (usually starting with "function myFunction"). <strong style={{color:"#c8a84b"}}>Select all of it</strong> (Ctrl+A on Windows, Cmd+A on Mac) and <strong style={{color:"#c8a84b"}}>delete it</strong>.</>,
                  <>Go back to this page and click <strong style={{color:"#c8a84b"}}>Copy to Clipboard</strong> above. Then go back to the Apps Script tab and <strong style={{color:"#c8a84b"}}>paste</strong> (Ctrl+V or Cmd+V).</>,
                  <>Click the <strong style={{color:"#c8a84b"}}>floppy disk icon 💾</strong> (or press Ctrl+S / Cmd+S) to save. Name the project anything you like.</>,
                  <>At the top, there's a dropdown that says <strong style={{color:"#c8a84b"}}>"Select function"</strong>. Click it and choose <strong style={{color:"#c8a84b"}}>setupTournament</strong>.</>,
                  <>Click the <strong style={{color:"#c8a84b"}}>▶ Run button</strong>. Google will ask for permission — click <strong style={{color:"#c8a84b"}}>Review Permissions</strong>, choose your Google account, then click <strong style={{color:"#c8a84b"}}>Allow</strong>.</>,
                  <>Go back to your spreadsheet tab. You'll see a sheet tab for each team plus a <strong style={{color:"#c8a84b"}}>⚾ Tournament</strong> menu at the top.</>,
                  <>Enter player data in each team's sheet. The <strong style={{color:"#c8a84b"}}>DO</strong> column, <strong style={{color:"#c8a84b"}}>STATUS</strong> colours, and blackout cells all update automatically as you type.</>,
                  <>If something looks wrong, use the <strong style={{color:"#c8a84b"}}>⚾ Tournament → Recalculate All Sheets</strong> menu item to refresh everything.</>
                ].map((step,i) => (
                  <li key={i} style={{
                    ...S.step, paddingLeft:36, marginBottom:14,
                  }}>
                    <span style={{
                      position:"absolute", left:0, top:0,
                      background:"rgba(200,168,75,0.2)", color:"#c8a84b",
                      borderRadius:"50%", width:22, height:22,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"0.75rem", fontWeight:"bold",
                    }}>{i+1}</span>
                    {step}
                  </li>
                ))}
              </ol>

              <div style={{
                background:"rgba(80,160,80,0.1)", border:"1px solid rgba(80,160,80,0.3)",
                borderRadius:8, padding:"12px 16px", marginTop:12,
                fontSize:"0.82rem", color:"#a8d8a8", lineHeight:1.7,
              }}>
                <strong>ℹ️ How PitchSmart ages work:</strong> Each player's age is calculated from their DOB against the
                tournament start date you entered. The script automatically applies the correct pitch limits
                (U12/U13/U14 share one table; U15-U16 another; U17-U18 another). Players without a DOB entered
                will use their league's default limits.
                <br/><br/>
                <strong>ℹ️ LL Two-game rule:</strong> Only Little League (LL) teams enforce the rule that a pitcher
                cannot appear in both games of a double-header. IL, JL, and SL teams are not subject to this restriction.
              </div>
            </div>
          </>
        )}
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
const CONFIG = {
  tournamentName: ${JSON.stringify(tourneyName)},
  startDate: ${JSON.stringify(startDate || "")},   // YYYY-MM-DD; used to calculate player ages
  days: ${daysJson},
  teams: ${teamsJson},
};

// ── PitchSmart tables by age (derived from DOB at runtime) ───────────────────
function getPitchSmartForAge(age) {
  if (age <= 12) return { dailyMax:85, tiers:[{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}] };
  if (age <= 14) return { dailyMax:85, tiers:[{max:20,rest:0},{max:35,rest:1},{max:50,rest:2},{max:65,rest:3},{max:85,rest:4}] };
  if (age <= 16) return { dailyMax:95, tiers:[{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:75,rest:3},{max:95,rest:4}] };
  return               { dailyMax:105,tiers:[{max:30,rest:0},{max:45,rest:1},{max:60,rest:2},{max:80,rest:3},{max:105,rest:4}] };
}

function getLeagueDefaultAge(league) {
  if (league === "LL") return 12;
  if (league === "IL") return 13;
  if (league === "JL") return 15;
  return 17; // SL
}

function calcAge(dobStr, refDateStr) {
  if (!dobStr) return null;
  try {
    var dob = new Date(dobStr);
    var ref = refDateStr ? new Date(refDateStr) : new Date();
    var age = ref.getFullYear() - dob.getFullYear();
    var m   = ref.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
    return age;
  } catch(e) { return null; }
}

// ── Column layout ─────────────────────────────────────────────────────────────
// Roster: Surname | FirstName | # | then per-game blocks
// Each game block: DO | P | Start | STATUS | C
// (DO=Designated Opener checkbox, P=total pitches, Start=first batter #, STATUS=rest calc, C=innings caught)
const ROSTER_COLS = 3; // Surname, FirstName, #
const GAME_COLS   = 5; // DO, P, Start, STATUS, C
const GAME_HDR    = ["DO","P","Start","STATUS","C"];

function gameColOffset(gameIndex) {
  return ROSTER_COLS + gameIndex * GAME_COLS;
}

// Build flat list of games: [{dayIdx, gameNum, dayLabel}]
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

  // Remove old team sheets (keep Sheet1 as home if needed)
  var existing = ss.getSheets();
  existing.forEach(function(sh) {
    if (sh.getName() !== "Sheet1") ss.deleteSheet(sh);
  });

  CONFIG.teams.forEach(function(team, ti) {
    var sh = ss.insertSheet(team.name || ("Team " + (ti+1)));
    buildTeamSheet(sh, team);
  });

  // Remove blank Sheet1 if still there
  var blank = ss.getSheetByName("Sheet1");
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  // Add custom menu
  SpreadsheetApp.getUi().createMenu("⚾ Tournament")
    .addItem("Recalculate All Sheets", "recalcAll")
    .addItem("Re-run Setup (clears data)", "setupTournament")
    .addToUi();

  SpreadsheetApp.getUi().alert("✅ Tournament set up! " + CONFIG.teams.length + " team sheets created.");
}

function recalcAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  CONFIG.teams.forEach(function(team) {
    var sh = ss.getSheetByName(team.name || "Team");
    if (sh) recalcSheet(sh, team);
  });
}

// ── Build a team sheet ────────────────────────────────────────────────────────
function buildTeamSheet(sh, team) {
  var games = buildGameList();
  var totalCols = ROSTER_COLS + games.length * GAME_COLS;

  sh.clearContents();
  sh.clearFormats();

  // ── Row 1: Day headers (merged per day) ──────────────────────────────────
  var dayGroups = {};
  games.forEach(function(g, gi) {
    var key = g.dayIdx;
    if (!dayGroups[key]) dayGroups[key] = { label: g.dayLabel, start: gi, count: 0 };
    dayGroups[key].count++;
  });

  var row1 = sh.getRange(1, 1, 1, totalCols);
  row1.setBackground("#1a2f4e").setFontColor("#c8a84b").setFontWeight("bold")
      .setHorizontalAlignment("center");

  // Roster header
  sh.getRange(1,1,1,ROSTER_COLS).merge().setValue(CONFIG.tournamentName)
    .setBackground("#0d2040").setFontColor("#c8a84b");

  Object.keys(dayGroups).forEach(function(key) {
    var dg = dayGroups[key];
    var startCol = ROSTER_COLS + dg.start * GAME_COLS + 1;
    var spanCols = dg.count * GAME_COLS;
    var cell = sh.getRange(1, startCol, 1, spanCols);
    if (spanCols > 1) cell.merge();
    cell.setValue(dg.label).setBackground("#1a2f4e").setFontColor("#c8a84b")
        .setHorizontalAlignment("center");
  });

  // ── Row 2: Game headers ─────────────────────────────────────────────────
  sh.getRange(2, 1).setValue("Surname");
  sh.getRange(2, 2).setValue("First Name");
  sh.getRange(2, 3).setValue("#");

  games.forEach(function(g, gi) {
    var col = ROSTER_COLS + gi * GAME_COLS + 1;
    var label = "Game " + g.gameNum;
    sh.getRange(2, col, 1, GAME_COLS).merge().setValue(label)
      .setBackground("#2a4060").setFontColor("#e8dcc8")
      .setHorizontalAlignment("center").setFontWeight("bold");
  });

  sh.getRange(2, 1, 1, totalCols).setBackground("#2a4060").setFontColor("#e8dcc8")
    .setFontWeight("bold").setHorizontalAlignment("center");

  // ── Row 3: Column headers ───────────────────────────────────────────────
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

  // ── Rows 4+: Players ────────────────────────────────────────────────────
  team.players.forEach(function(p, pi) {
    var row = 4 + pi;
    sh.getRange(row, 1).setValue(p.surname);
    sh.getRange(row, 2).setValue(p.firstName);
    sh.getRange(row, 3).setValue(p.number);

    // Store DOB as a note on column 1 (not visible in grid, accessible to script)
    if (p.dob) sh.getRange(row, 1).setNote("DOB:" + p.dob);

    // Alternate row shading
    var bg = pi % 2 === 0 ? "#0d1e30" : "#0a1628";
    sh.getRange(row, 1, 1, totalCols).setBackground(bg).setFontColor("#e8dcc8");

    // Style each game block
    games.forEach(function(g, gi) {
      var baseCol = ROSTER_COLS + gi * GAME_COLS + 1;
      // DO col
      sh.getRange(row, baseCol).setHorizontalAlignment("center");
      // P, Start, C — number columns
      sh.getRange(row, baseCol+1).setHorizontalAlignment("center");
      sh.getRange(row, baseCol+2).setHorizontalAlignment("center");
      sh.getRange(row, baseCol+4).setHorizontalAlignment("center");
      // STATUS
      sh.getRange(row, baseCol+3).setHorizontalAlignment("center").setFontWeight("bold");
    });
  });

  // ── Column widths ────────────────────────────────────────────────────────
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 40);
  games.forEach(function(g, gi) {
    var base = ROSTER_COLS + gi * GAME_COLS + 1;
    sh.setColumnWidth(base,   50);  // DO
    sh.setColumnWidth(base+1, 45);  // P
    sh.setColumnWidth(base+2, 50);  // Start
    sh.setColumnWidth(base+3, 80);  // STATUS
    sh.setColumnWidth(base+4, 40);  // C
  });

  sh.freezeRows(3);
  sh.freezeColumns(3);
}

// ── onEdit trigger ────────────────────────────────────────────────────────────
function onEdit(e) {
  var sh   = e.range.getSheet();
  var team = CONFIG.teams.find(function(t) { return t.name === sh.getName(); });
  if (!team) return;
  recalcSheet(sh, team);
}

// ── Recalculate all rules for a sheet ────────────────────────────────────────
function recalcSheet(sh, team) {
  var games   = buildGameList();
  var players = team.players;

  players.forEach(function(p, pi) {
    var row = 4 + pi;

    // Get player age from DOB note
    var note = sh.getRange(row, 1).getNote() || "";
    var dobMatch = note.match(/DOB:(\S+)/);
    var dob  = dobMatch ? dobMatch[1] : (p.dob || "");
    var age  = calcAge(dob, CONFIG.startDate) || getLeagueDefaultAge(team.league);
    var ps   = getPitchSmartForAge(age);

    // Read all game data for this player
    var gameData = games.map(function(g, gi) {
      var base = ROSTER_COLS + gi * GAME_COLS + 1;
      return {
        gi:    gi,
        g:     g,
        doVal: (sh.getRange(row, base).getValue()   || "").toString().toUpperCase().trim(),
        p:     Number(sh.getRange(row, base+1).getValue()) || 0,
        start: Number(sh.getRange(row, base+2).getValue()) || 0,
        c:     Number(sh.getRange(row, base+4).getValue()) || 0,
        baseCol: base,
      };
    });

    // ── Colour DO cells ────────────────────────────────────────────────────
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

    // ── Determine rest blackouts from cumulative pitches by day ────────────
    // Track total pitches per day
    var pitchesByDay = {};
    var pitchedDays  = []; // sorted day indices where pitches > 0

    // Group games by dayIdx for cumulative daily totals
    var gamesByDay = {};
    gameData.forEach(function(gd) {
      var di = gd.g.dayIdx;
      if (!gamesByDay[di]) gamesByDay[di] = [];
      gamesByDay[di].push(gd);
    });

    Object.keys(gamesByDay).forEach(function(di) {
      di = Number(di);
      var total = 0;
      gamesByDay[di].forEach(function(gd) { total += gd.p; });
      pitchesByDay[di] = total;
      if (total > 0) pitchedDays.push(di);
    });
    pitchedDays.sort(function(a,b){return a-b;});

    // For each day with pitches, determine rest days needed
    var blackoutDays = {}; // di -> reason
    pitchedDays.forEach(function(di) {
      var total = pitchesByDay[di];
      var restNeeded = 0;
      for (var t = ps.tiers.length-1; t >= 0; t--) {
        if (total <= ps.tiers[t].max) restNeeded = ps.tiers[t].rest;
        else break;
      }
      // Actually walk tiers properly
      restNeeded = 0;
      for (var t = 0; t < ps.tiers.length; t++) {
        if (total <= ps.tiers[t].max) { restNeeded = ps.tiers[t].rest; break; }
      }
      for (var r = 1; r <= restNeeded; r++) {
        var bd = di + r;
        blackoutDays[bd] = "Rest " + restNeeded + "d";
      }
    });

    // Consecutive 3-day rule: if pitched on day N and N+1, day N+2 is blacked
    for (var i = 0; i < pitchedDays.length-1; i++) {
      var d1 = pitchedDays[i], d2 = pitchedDays[i+1];
      if (d2 === d1 + 1) {
        blackoutDays[d1+2] = "3rd Day";
      }
    }

    // ── Process each game ─────────────────────────────────────────────────
    gameData.forEach(function(gd) {
      var statusCell = sh.getRange(row, gd.baseCol + 3);
      var pCell      = sh.getRange(row, gd.baseCol + 1);
      var startCell  = sh.getRange(row, gd.baseCol + 2);
      var di         = gd.g.dayIdx;
      var gn         = gd.g.gameNum;

      // Check if this game is blacked out by rest or 3-day rule
      if (blackoutDays[di]) {
        // Entire day blacked out
        [pCell, startCell, statusCell].forEach(function(c) {
          c.setBackground("#000000").setFontColor("#555555");
        });
        statusCell.setValue(blackoutDays[di]);
        return;
      }

      // ── LL Two-game rule: Game 2 blacked if player pitched in Game 1 ──
      if (team.league === "LL" && gn === 2) {
        var game1Data = gamesByDay[di] ? gamesByDay[di].find(function(x){ return x.g.gameNum===1; }) : null;
        if (game1Data && game1Data.p > 0) {
          [pCell, startCell, statusCell].forEach(function(c) {
            c.setBackground("#000000").setFontColor("#555555");
          });
          statusCell.setValue("LL Rule");
          return;
        }
      }

      // ── Flags: check rule violations ──────────────────────────────────
      var flags = [];

      // Rule: If ≥21 pitches in Game 1, can't pitch in Game 2 (all leagues)
      if (gn === 2) {
        var game1 = gamesByDay[di] ? gamesByDay[di].find(function(x){ return x.g.gameNum===1; }) : null;
        if (game1 && game1.p >= 21 && gd.p > 0) {
          flags.push("⚠️ Pitched ≥21 in G1");
        }
      }

      // Rule: If caught ≥4 inn in Game 1, can't pitch in Game 2
      if (gn === 2) {
        var game1c = gamesByDay[di] ? gamesByDay[di].find(function(x){ return x.g.gameNum===1; }) : null;
        if (game1c && game1c.c >= 4 && gd.p > 0) {
          flags.push("⚠️ Caught ≥4 inn G1");
        }
      }

      // Rule: Can't catch ≥4 inn in same game AND pitch
      if (gd.c >= 4 && gd.p > 0) {
        flags.push("⚠️ C+P same game");
      }

      if (flags.length > 0) {
        statusCell.setValue(flags.join(" | ")).setBackground("#ff4444").setFontColor("#ffffff");
        pCell.setBackground("#fff0f0");
        return;
      }

      // ── Normal STATUS: calculate rest ─────────────────────────────────
      if (gd.p > 0) {
        var rest = 0;
        for (var t = 0; t < ps.tiers.length; t++) {
          if (gd.p <= ps.tiers[t].max) { rest = ps.tiers[t].rest; break; }
        }
        if (rest === 0) {
          statusCell.setValue("Nil").setBackground("#c8f0c8").setFontColor("#1a7a1a");
        } else {
          statusCell.setValue(rest + " Day" + (rest>1?"s":""))
            .setBackground("#f5c842").setFontColor("#5a3d00");
        }
        pCell.setBackground(null).setFontColor("#e8dcc8");
        startCell.setBackground(null).setFontColor("#e8dcc8");
      } else {
        // No pitches — clear status
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
