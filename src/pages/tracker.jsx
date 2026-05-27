import { useState, useCallback } from "react";

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DIVISIONS = ["LL","IL","JL","SL","AYC U16","AYC U18","AWC","AYWC"];
const DIVISION_NAMES = {
  "LL":     "Little League (LL)",
  "IL":     "Intermediate League (IL)",
  "JL":     "Junior League (JL)",
  "SL":     "Senior League (SL)",
  "AYC U16":"Australian Youth Championship U16 (AYC U16)",
  "AYC U18":"Australian Youth Championship U18 (AYC U18)",
  "AWC":    "Australian Women's Championship (AWC)",
  "AYWC":   "Australian Youth Women's Championship (AYWC)",
};
const DIVISION_MAX_PLAYERS = {
  "LL":14,"IL":14,"JL":14,"SL":16,
  "AYC U16":20,"AYC U18":20,"AWC":18,"AYWC":16,
};
const DIVISION_INFO = {
  "LL":     "Max 14 players · League age 9-12 · Cannot pitch in both games of a double-header",
  "IL":     "Max 14 players · League age 11-13 · Cannot pitch in both games of a double-header",
  "JL":     "Max 14 players · League age 12-14 · Can pitch in G2 if ≤30 pitches in G1 (LA12 exception applies)",
  "SL":     "Max 16 players · League age 13-16 · Can pitch in G2 if ≤30 pitches in G1",
  "AYC U16":"18-20 players · Actual age at tournament start · One outing per day only",
  "AYC U18":"18-20 players · Actual age at tournament start · One outing per day only",
  "AWC":    "Max 18 players · Players 18+ at tournament start have no pitch limits · Under 18 rules apply",
  "AYWC":   "Max 16 players · Actual age at tournament start · One outing per day only",
};

const uid = () => Math.random().toString(36).slice(2,8);
const emptyPlayer = () => ({ id:uid(), surname:"", firstName:"", number:"", dob:"" });
const emptyTeam   = (dayCount) => ({
  id:uid(), name:"",
  schedule: Array.from({length:dayCount},(_,i)=>({dayIdx:i,games:1})),
  players:[emptyPlayer()]
});
const emptyDay = (i) => ({ id:uid(), label:DAYS_OF_WEEK[i%7] });

const parseDob = (raw) => {
  if (!raw) return "";
  raw = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().slice(0,10);
  return raw;
};

// Auto-fill day labels from a start date
const getDayLabels = (startDateStr, count) => {
  if (!startDateStr) return Array.from({length:count},(_,i)=>DAYS_OF_WEEK[i%7]);
  const base = new Date(startDateStr);
  return Array.from({length:count}, (_,i) => {
    const d = new Date(base);
    d.setDate(d.getDate()+i);
    return DAYS_OF_WEEK[d.getDay()===0?6:d.getDay()-1]; // Mon=0
  });
};

export default function App() {
  const [step,        setStep]        = useState(1);
  const [tourneyName, setTourneyName] = useState("Tournament 2025");
  const [startDate,   setStartDate]   = useState("");
  const [email,       setEmail]       = useState("");
  const [division,    setDivision]    = useState("JL");
  const [numDays,     setNumDays]     = useState(3);
  const [days,        setDays]        = useState([emptyDay(0),emptyDay(1),emptyDay(2)]);
  const [teams,       setTeams]       = useState(() => [emptyTeam(3), emptyTeam(3)]);
  const [sheetUrl,    setSheetUrl]    = useState("");
  const [errMsg,      setErrMsg]      = useState("");
  const [pasteOpen,   setPasteOpen]   = useState({});
  const [pasteText,   setPasteText]   = useState({});
  const [pasteErr,    setPasteErr]    = useState({});

  const maxPlayers = DIVISION_MAX_PLAYERS[division] || 16;

  // When start date changes, auto-fill day labels
  const handleStartDate = (val) => {
    setStartDate(val);
    if (val) {
      const labels = getDayLabels(val, numDays);
      setDays(prev => prev.map((d,i) => ({...d, label: labels[i]||d.label})));
    }
  };

  const setDayCount = (n) => {
    n = Math.max(1, Math.min(10, Number(n)));
    setNumDays(n);
    const labels = getDayLabels(startDate, n);
    setDays(prev => {
      const next = [...prev];
      while (next.length < n) next.push({id:uid(), label: labels[next.length]||DAYS_OF_WEEK[next.length%7]});
      return next.slice(0,n).map((d,i) => startDate ? {...d, label:labels[i]||d.label} : d);
    });
    setTeams(prev => prev.map(t => {
      const sched = [];
      for (let i=0; i<n; i++) {
        const ex = t.schedule && t.schedule.find(s=>s.dayIdx===i);
        sched.push({dayIdx:i, games: ex ? ex.games : 1});
      }
      return {...t, schedule:sched};
    }));
  };

  const updateDay = (i,f,v) => setDays(p => p.map((d,j) => j===i ? {...d,[f]:v} : d));

  const addTeam    = () => setTeams(p => p.length < 20 ? [...p, emptyTeam(numDays)] : p);
  const removeTeam = (id) => setTeams(p => p.filter(t=>t.id!==id));
  const updateTeam = (id,f,v) => setTeams(p => p.map(t=>t.id===id?{...t,[f]:v}:t));

  const updateSchedule = (tid,dayIdx,games) => {
    setTeams(p => p.map(t => {
      if(t.id!==tid) return t;
      const sched = t.schedule.map(s => s.dayIdx===dayIdx ? {...s,games} : s);
      return {...t,schedule:sched};
    }));
  };

  const addPlayer    = (tid) => setTeams(p => p.map(t =>
    t.id===tid && t.players.length < maxPlayers ? {...t,players:[...t.players,emptyPlayer()]} : t));
  const removePlayer = (tid,pid) => setTeams(p => p.map(t =>
    t.id===tid ? {...t,players:t.players.filter(pl=>pl.id!==pid)} : t));
  const updatePlayer = (tid,pid,f,v) => setTeams(p => p.map(t =>
    t.id===tid ? {...t,players:t.players.map(pl=>pl.id===pid?{...pl,[f]:v}:pl)} : t));

  const applyPaste = (tid) => {
    const text = (pasteText[tid]||"").trim();
    if (!text) { setPasteErr(e=>({...e,[tid]:"Nothing to import."})); return; }
    const rows = text.split(/\r?\n/).filter(r=>r.trim());
    const players = [];
    rows.forEach(row => {
      const cols = row.split(/\t/).map(c=>c.trim());
      if (cols.length < 2) return;
      const [surname,firstName,number="",dobRaw=""] = cols;
      if (!surname&&!firstName) return;
      players.push({id:uid(),surname,firstName,number,dob:parseDob(dobRaw)});
    });
    if (!players.length) {
      setPasteErr(e=>({...e,[tid]:"No valid rows. Copy data rows only — do not include the header row."}));
      return;
    }
    const limit = maxPlayers;
    setPasteErr(e=>({...e,[tid]: players.length>limit?`Only first ${limit} of ${players.length} rows imported.`:""}));
    setTeams(p => p.map(t=>t.id===tid?{...t,players:players.slice(0,limit)}:t));
    setPasteOpen(o=>({...o,[tid]:false}));
    setPasteText(tx=>({...tx,[tid]:""}));
  };

  const handleSubmit = useCallback(async () => {
    if (!email)     { alert("Please enter your email address."); return; }
    if (!startDate) { alert("Please enter the tournament start date."); return; }
    setStep(2);
    try {
      const teamsPayload = teams.map(t => ({
        name: t.name || "Team",
        days: days.map((d,i) => {
          const sched = t.schedule && t.schedule.find(s=>s.dayIdx===i);
          return { label:d.label, games: sched ? sched.games : 1 };
        }),
        players: t.players.map(p=>({
          surname:   p.surname   || "Surname",
          firstName: p.firstName || "FirstName",
          number:    p.number    || "",
          dob:       p.dob       || "",
        })),
      }));
      const res = await fetch("/api/create-sheet", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ tournamentName:tourneyName, startDate, email, division, teams:teamsPayload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Unknown error");
      setSheetUrl(data.url);
      setStep(3);
    } catch(err) {
      setErrMsg(err.message);
      setStep(4);
    }
  }, [tourneyName, startDate, email, division, days, teams]);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp = {
    background:"rgba(255,255,255,0.07)", border:"1px solid rgba(200,168,75,0.3)",
    borderRadius:6, padding:"8px 10px", color:"#e8dcc8", fontSize:"0.88rem",
    outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit",
  };
  const sel  = {...inp, background:"#0d2040", cursor:"pointer"};
  const lbl  = { fontSize:"0.73rem", color:"#8fa8c8", marginBottom:4, display:"block", letterSpacing:"0.04em" };
  const sub  = { fontSize:"0.7rem", color:"#5a7a9a", marginTop:3 };
  const card = { background:"rgba(255,255,255,0.035)", border:"1px solid rgba(200,168,75,0.2)", borderRadius:10, padding:"18px", marginBottom:14 };
  const sec  = { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(200,168,75,0.25)", borderRadius:12, padding:"22px", marginTop:20 };
  const secT = { fontSize:"0.88rem", fontWeight:"bold", color:"#c8a84b", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:16 };
  const divider = { borderTop:"1px solid rgba(200,168,75,0.15)", margin:"18px 0" };
  const btn  = (v="gold") => ({
    padding: v==="sm"?"5px 12px":"11px 24px", borderRadius:6, border:"none",
    cursor:"pointer", fontWeight:"bold", fontSize:v==="sm"?"0.76rem":"0.88rem",
    letterSpacing:"0.05em", fontFamily:"inherit",
    background: v==="danger"?"rgba(180,50,50,0.7)":v==="ghost"?"rgba(255,255,255,0.07)":"linear-gradient(135deg,#c8a84b,#a07830)",
    color: v==="ghost"?"#8fa8c8":"#0a1628",
    border: v==="ghost"?"1px solid rgba(200,168,75,0.2)":"none",
  });

  // ── Step screens ───────────────────────────────────────────────────────────
  if (step===2) return (
    <div style={{minHeight:"100vh",background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:24,fontFamily:"Georgia,serif"}}>
      <div style={{fontSize:"3rem",animation:"spin 2s linear infinite"}}>⚾</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{color:"#c8a84b",fontSize:"1.2rem",fontWeight:"bold",letterSpacing:"0.1em"}}>CREATING YOUR SPREADSHEET</div>
      <div style={{color:"#8fa8c8",fontSize:"0.88rem"}}>Building sheets, applying formatting, sharing to {email}…</div>
    </div>
  );

  if (step===3) return (
    <div style={{minHeight:"100vh",background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,fontFamily:"Georgia,serif",padding:24,textAlign:"center"}}>
      <div style={{fontSize:"3rem"}}>✅</div>
      <div style={{color:"#c8a84b",fontSize:"1.4rem",fontWeight:"bold",letterSpacing:"0.08em"}}>YOUR SHEET IS READY</div>
      <div style={{color:"#8fa8c8",fontSize:"0.9rem",maxWidth:440,lineHeight:1.7}}>
        Spreadsheet created and shared to <strong style={{color:"#c8a84b"}}>{email}</strong>.
        Check your inbox for the link, or open it directly below.
      </div>
      <a href={sheetUrl} target="_blank" rel="noreferrer" style={{
        display:"inline-block",marginTop:8,padding:"14px 36px",borderRadius:8,
        background:"linear-gradient(135deg,#c8a84b,#a07830)",color:"#0a1628",
        fontWeight:"bold",fontSize:"1rem",textDecoration:"none",letterSpacing:"0.06em",
      }}>⚾ Open Spreadsheet</a>
      <button style={{...btn("ghost"),marginTop:8}} onClick={()=>setStep(1)}>← Create Another</button>
    </div>
  );

  if (step===4) return (
    <div style={{minHeight:"100vh",background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,fontFamily:"Georgia,serif",padding:24,textAlign:"center"}}>
      <div style={{fontSize:"3rem"}}>❌</div>
      <div style={{color:"#e05050",fontSize:"1.2rem",fontWeight:"bold"}}>Something went wrong</div>
      <div style={{color:"#8fa8c8",fontSize:"0.88rem",maxWidth:440,background:"rgba(200,80,80,0.1)",border:"1px solid rgba(200,80,80,0.3)",borderRadius:8,padding:"12px 16px"}}>{errMsg}</div>
      <button style={btn()} onClick={()=>setStep(1)}>← Try Again</button>
    </div>
  );

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#0a1628",fontFamily:"Georgia,serif",color:"#e8dcc8",paddingBottom:80}}>
      <div style={{background:"linear-gradient(135deg,#0a1628 0%,#1a2f4e 50%,#0d2040 100%)",borderBottom:"3px solid #c8a84b",padding:"36px 32px 28px",textAlign:"center"}}>
        <div style={{fontSize:"2.2rem",marginBottom:6}}>⚾</div>
        <h1 style={{margin:"0 0 6px",fontSize:"2rem",fontWeight:"bold",color:"#c8a84b",letterSpacing:"0.1em",textTransform:"uppercase"}}>Tournament Participation Tracker</h1>
        <p style={{margin:0,color:"#8fa8c8",fontSize:"0.88rem"}}>Fill in the details of your tournament to generate your Google Spreadsheet.</p>
      </div>

      <div style={{maxWidth:980,margin:"0 auto",padding:"0 20px"}}>

        {/* ── Combined Tournament Details + Days ─────────────────────────── */}
        <div style={sec}>
          <div style={secT}>⚙️ Tournament Details</div>

          {/* Row 1: name, date, email, division */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={lbl}>Tournament Name</label>
              <input style={inp} value={tourneyName} onChange={e=>setTourneyName(e.target.value)} placeholder="e.g. National Championship 2025"/>
            </div>
            <div>
              <label style={lbl}>Start Date</label>
              <input style={inp} type="date" value={startDate} onChange={e=>handleStartDate(e.target.value)}/>
              <div style={sub}>Day names fill automatically from this date</div>
            </div>
            <div>
              <label style={lbl}>Your Email</label>
              <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
              <div style={sub}>Spreadsheet shared to this address</div>
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <label style={lbl}>Competition Division</label>
            <select style={sel} value={division} onChange={e=>setDivision(e.target.value)}>
              {DIVISIONS.map(d=><option key={d} value={d}>{DIVISION_NAMES[d]}</option>)}
            </select>
            <div style={{...sub, color:"#8fa8c8", marginTop:6}}>{DIVISION_INFO[division]}</div>
          </div>

          {/* Divider */}
          <div style={divider}/>

          {/* Days sub-section */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
            <div style={{...secT,margin:0,fontSize:"0.82rem"}}>📅 Tournament Days</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <label style={{...lbl,margin:0,whiteSpace:"nowrap"}}>Number of days:</label>
              <input style={{...inp,width:65}} type="number" min={1} max={10} value={numDays}
                onChange={e=>setDayCount(e.target.value)}/>
            </div>
            {!startDate && <div style={{...sub,color:"#c8a84b",fontSize:"0.72rem"}}>
              ⚠️ Set a start date above to auto-fill day names
            </div>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:7}}>
            {days.map((d,i)=>(
              <div key={d.id} style={{
                background:"rgba(200,168,75,0.06)", border:"1px solid rgba(200,168,75,0.18)",
                borderRadius:7, padding:"8px 12px",
                display:"flex", alignItems:"center", gap:8,
              }}>
                <span style={{color:"#c8a84b",fontWeight:"bold",fontSize:"0.78rem",minWidth:44}}>Day {i+1}</span>
                <select style={{...sel,padding:"5px 7px",fontSize:"0.8rem"}} value={d.label}
                  onChange={e=>updateDay(i,"label",e.target.value)}>
                  {DAYS_OF_WEEK.map(dn=><option key={dn}>{dn}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* ── Teams ─────────────────────────────────────────────────────── */}
        <div style={sec}>
          <div style={secT}>🧢 Teams ({teams.length}/20)</div>

          {teams.map((team,ti)=>(
            <div key={team.id} style={card}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:14,alignItems:"end"}}>
                <div>
                  <label style={lbl}>Team Name</label>
                  <input style={inp} value={team.name} onChange={e=>updateTeam(team.id,"name",e.target.value)} placeholder={`Team ${ti+1}`}/>
                </div>
                {teams.length>1&&
                  <button style={{...btn("danger"),padding:"8px 12px"}} onClick={()=>removeTeam(team.id)}>✕ Remove</button>}
              </div>

              {/* Games per day */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:"0.76rem",color:"#c8a84b",fontWeight:"bold",marginBottom:7,letterSpacing:"0.05em"}}>GAMES PER DAY</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:6}}>
                  {days.map((d,i)=>{
                    const sched=team.schedule&&team.schedule.find(s=>s.dayIdx===i);
                    const games=sched?sched.games:1;
                    return (
                      <div key={i} style={{
                        background:"rgba(200,168,75,0.05)",border:"1px solid rgba(200,168,75,0.14)",
                        borderRadius:6,padding:"5px 10px",display:"flex",alignItems:"center",gap:7,
                      }}>
                        <span style={{color:"#8fa8c8",fontSize:"0.76rem",flex:1}}>{d.label}</span>
                        <select style={{...sel,width:88,padding:"3px 6px",fontSize:"0.76rem"}} value={games}
                          onChange={e=>updateSchedule(team.id,i,Number(e.target.value))}>
                          <option value={1}>1 Game</option>
                          <option value={2}>2 Games</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Paste roster */}
              <div style={{marginBottom:10}}>
                <button style={{...btn("ghost"),fontSize:"0.76rem",padding:"5px 12px"}}
                  onClick={()=>setPasteOpen(o=>({...o,[team.id]:!o[team.id]}))}>
                  {pasteOpen[team.id]?"▲ Hide Paste":"📋 Paste Roster from Spreadsheet"}
                </button>
              </div>

              {pasteOpen[team.id]&&(
                <div style={{background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"12px",marginBottom:12}}>
                  <div style={{fontSize:"0.76rem",color:"#8fa8c8",marginBottom:8,lineHeight:1.7}}>
                    Copy rows from Excel or Google Sheets — columns:&nbsp;
                    <strong style={{color:"#c8a84b"}}>Surname · First Name · # · Date of Birth</strong>
                    <br/><span style={{color:"#f08060"}}>⚠️ Data rows only — do not include the header row.</span>
                    <br/><span style={{color:"#5a7a9a"}}>Replaces current roster. Max {maxPlayers} players for {division}.</span>
                  </div>
                  <textarea style={{...inp,fontFamily:"monospace",fontSize:"0.78rem",minHeight:90,resize:"vertical",marginBottom:8}}
                    placeholder={"Smith\tJohn\t7\t15/04/2013\nJones\tMike\t12\t22/09/2012"}
                    value={pasteText[team.id]||""} onChange={e=>setPasteText(tx=>({...tx,[team.id]:e.target.value}))}/>
                  {pasteErr[team.id]&&<div style={{fontSize:"0.76rem",color:"#f08080",marginBottom:8}}>{pasteErr[team.id]}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button style={btn()} onClick={()=>applyPaste(team.id)}>✓ Import</button>
                    <button style={btn("ghost")} onClick={()=>{
                      setPasteOpen(o=>({...o,[team.id]:false}));
                      setPasteText(tx=>({...tx,[team.id]:""}));
                      setPasteErr(e=>({...e,[team.id]:""}));
                    }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Player column headers */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 55px 115px 28px",gap:6,marginBottom:4,paddingBottom:4,borderBottom:"1px solid rgba(200,168,75,0.15)"}}>
                {["Surname","First Name","#","Date of Birth",""].map((h,i)=>(
                  <span key={i} style={{fontSize:"0.7rem",color:"#5a7a9a"}}>{h}</span>
                ))}
              </div>

              {/* Players */}
              {team.players.map(pl=>(
                <div key={pl.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 55px 115px 28px",gap:6,marginBottom:5,alignItems:"end"}}>
                  <input style={inp} placeholder="Surname" value={pl.surname} onChange={e=>updatePlayer(team.id,pl.id,"surname",e.target.value)}/>
                  <input style={inp} placeholder="First name" value={pl.firstName} onChange={e=>updatePlayer(team.id,pl.id,"firstName",e.target.value)}/>
                  <input style={inp} placeholder="#" value={pl.number} onChange={e=>updatePlayer(team.id,pl.id,"number",e.target.value)}/>
                  <input style={{...inp,fontSize:"0.78rem"}} type="date" value={pl.dob} onChange={e=>updatePlayer(team.id,pl.id,"dob",e.target.value)}/>
                  <button style={{...btn("danger"),padding:"6px 8px",fontSize:"0.78rem"}} onClick={()=>removePlayer(team.id,pl.id)}>✕</button>
                </div>
              ))}

              {team.players.length<maxPlayers&&
                <button style={{...btn("ghost"),marginTop:8,fontSize:"0.76rem"}} onClick={()=>addPlayer(team.id)}>+ Add Player</button>}
              <div style={{fontSize:"0.7rem",color:"#5a7a9a",marginTop:6}}>{team.players.length}/{maxPlayers} players</div>
            </div>
          ))}

          {/* Add Team at bottom */}
          {teams.length<20&&(
            <div style={{textAlign:"center",marginTop:4,marginBottom:8}}>
              <button style={{...btn("ghost"),padding:"10px 28px"}} onClick={addTeam}>+ Add Team</button>
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{textAlign:"center",marginTop:28}}>
          <button style={{...btn(),padding:"15px 48px",fontSize:"1rem",letterSpacing:"0.08em"}} onClick={handleSubmit}>
            ⚾ Create My Spreadsheet
          </button>
          <div style={{color:"#5a7a9a",fontSize:"0.78rem",marginTop:10}}>
            Your sheet will be created in Google Drive and shared to your email address.
          </div>
        </div>

      </div>
    </div>
  );
}
