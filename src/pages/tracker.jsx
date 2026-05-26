import { useState, useCallback } from "react";

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LEAGUES      = ["LL","IL","JL","SL"];
const LEAGUE_NAMES = { LL:"Little League", IL:"Intermediate League", JL:"Junior League", SL:"Senior League" };
const uid          = () => Math.random().toString(36).slice(2,8);
const emptyPlayer  = () => ({ id:uid(), surname:"", firstName:"", number:"", dob:"" });
const emptyTeam    = (days) => ({
  id:uid(), name:"",
  // each team gets its own games-per-day schedule, defaulting to 1 game per day
  schedule: days.map((_,i) => ({ dayIdx:i, games:1 })),
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

export default function App() {
  const [step,        setStep]        = useState(1);
  const [tourneyName, setTourneyName] = useState("Tournament 2025");
  const [startDate,   setStartDate]   = useState("");
  const [email,       setEmail]       = useState("");
  const [league,      setLeague]      = useState("JL");
  const [numDays,     setNumDays]     = useState(3);
  const [days,        setDays]        = useState([emptyDay(0),emptyDay(1),emptyDay(2)]);
  const [teams,       setTeams]       = useState(() => [emptyTeam([0,1,2]), emptyTeam([0,1,2])]);
  const [sheetUrl,    setSheetUrl]    = useState("");
  const [errMsg,      setErrMsg]      = useState("");
  const [paste,   setPasteOpen]   = useState({});
  const [pasteText,   setPasteText]   = useState({});
  const [pasteErr,    setPasteErr]    = useState({});

  // ── Day helpers ────────────────────────────────────────────────────────────
  const setDayCount = (n) => {
    n = Math.max(1, Math.min(10, Number(n)));
    setNumDays(n);
    setDays(prev => {
      const next = [...prev];
      while (next.length < n) next.push(emptyDay(next.length));
      return next.slice(0,n);
    });
    // Update team schedules to match new day count
    setTeams(prev => prev.map(t => {
      const sched = [];
      for (let i=0; i<n; i++) {
        const existing = t.schedule && t.schedule.find(s=>s.dayIdx===i);
        sched.push({ dayIdx:i, games: existing ? existing.games : 1 });
      }
      return {...t, schedule:sched};
    }));
  };
  const updateDay = (i,f,v) => setDays(p => p.map((d,j) => j===i ? {...d,[f]:v} : d));

  // ── Team helpers ───────────────────────────────────────────────────────────
  const addTeam    = () => setTeams(p => p.length<20 ? [...p, emptyTeam(days.map((_,i)=>i))] : p);
  const removeTeam = (id) => setTeams(p => p.filter(t=>t.id!==id));
  const updateTeam = (id,f,v) => setTeams(p => p.map(t=>t.id===id?{...t,[f]:v}:t));

  const updateSchedule = (tid, dayIdx, games) => {
    setTeams(p => p.map(t => {
      if (t.id!==tid) return t;
      const sched = t.schedule.map(s => s.dayIdx===dayIdx ? {...s,games} : s);
      return {...t, schedule:sched};
    }));
  };

  const addPlayer    = (tid) => setTeams(p => p.map(t => t.id===tid&&t.players.length<16 ? {...t,players:[...t.players,emptyPlayer()]} : t));
  const removePlayer = (tid,pid) => setTeams(p => p.map(t => t.id===tid?{...t,players:t.players.filter(pl=>pl.id!==pid)}:t));
  const updatePlayer = (tid,pid,f,v) => setTeams(p => p.map(t => t.id===tid?{...t,players:t.players.map(pl=>pl.id===pid?{...pl,[f]:v}:pl)}:t));

  const applyPaste = (tid) => {
    const text = (pasteText[tid]||"").trim();
    if (!text) { setPasteErr(e=>({...e,[tid]:"Nothing to import."})); return; }
    const rows = text.split(/\r?\n/).filter(r=>r.trim());
    const players = [];
    rows.forEach(row => {
      const cols = row.split(/\t/).map(c=>c.trim());
      if (cols.length<2) return;
      const [surname,firstName,number="",dobRaw=""] = cols;
      if (!surname&&!firstName) return;
      players.push({id:uid(),surname,firstName,number,dob:parseDob(dobRaw)});
    });
    if (!players.length) { setPasteErr(e=>({...e,[tid]:"No valid rows. Copy directly from Excel or Google Sheets — do not include the header row."})); return; }
    setPasteErr(e=>({...e,[tid]:players.length>16?`Only first 16 of ${players.length} rows imported.`:""}));
    setTeams(p => p.map(t=>t.id===tid?{...t,players:players.slice(0,16)}:t));
    setPasteOpen(o=>({...o,[tid]:false}));
    setPasteText(tx=>({...tx,[tid]:""}));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!email)     { alert("Please enter your email address."); return; }
    if (!startDate) { alert("Please enter the tournament start date."); return; }
    setStep(2);
    try {
      // Build days array per team from their individual schedules
      const teamsPayload = teams.map(t => ({
        name:    t.name || "Team",
        players: t.players.map(p=>({
          surname:   p.surname   || "Surname",
          firstName: p.firstName || "FirstName",
          number:    p.number    || "",
          dob:       p.dob       || "",
        })),
        // Pass team-specific days
        days: days.map((d,i) => {
          const sched = t.schedule && t.schedule.find(s=>s.dayIdx===i);
          return { label:d.label, games: sched ? sched.games : 1 };
        }),
      }));

      const res = await fetch("/api/create-sheet", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          tournamentName: tourneyName,
          startDate,
          email,
          league,
          days: days.map((d,i) => ({
            label: d.label,
            games: Math.max(...teams.map(t => {
              const s = t.schedule&&t.schedule.find(s=>s.dayIdx===i);
              return s ? s.games : 1;
            }))
          })),
          teams: teamsPayload,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Unknown error");
      setSheetUrl(data.url);
      setStep(3);
    } catch(err) {
      setErrMsg(err.message);
      setStep(4);
    }
  }, [tourneyName, startDate, email, league, days, teams]);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp = {
    background:"rgba(255,255,255,0.07)", border:"1px solid rgba(200,168,75,0.3)",
    borderRadius:6, padding:"8px 10px", color:"#e8dcc8", fontSize:"0.88rem",
    outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit",
  };
  const sel  = {...inp, background:"#0d2040", cursor:"pointer"};
  const lbl  = { fontSize:"0.73rem", color:"#8fa8c8", marginBottom:4, display:"block", letterSpacing:"0.04em" };
  const card = { background:"rgba(255,255,255,0.035)", border:"1px solid rgba(200,168,75,0.2)", borderRadius:10, padding:"18px", marginBottom:14 };
  const sec  = { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(200,168,75,0.25)", borderRadius:12, padding:"22px", marginTop:20 };
  const secT = { fontSize:"0.88rem", fontWeight:"bold", color:"#c8a84b", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 };
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
        Your spreadsheet has been created and shared to <strong style={{color:"#c8a84b"}}>{email}</strong>.
        Check your inbox for an email with the link, or open it directly below.
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
        <p style={{margin:0,color:"#8fa8c8",fontSize:"0.88rem"}}>Complete the details for your tournament.</p>
      </div>

      <div style={{maxWidth:980,margin:"0 auto",padding:"0 20px"}}>

        {/* Tournament details */}
        <div style={sec}>
          <div style={secT}>⚙️ Tournament Details</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,flexWrap:"wrap"}}>
            <div>
              <label style={lbl}>Tournament Name</label>
              <input style={inp} value={tourneyName} onChange={e=>setTourneyName(e.target.value)} placeholder="e.g. Summer Cup 2025"/>
            </div>
            <div>
              <label style={lbl}>Start Date</label>
              <input style={inp} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
              <div style={{fontSize:"0.7rem",color:"#5a7a9a",marginTop:3}}></div>
            </div>
            <div>
              <label style={lbl}>Competition Division</label>
              <select style={sel} value={league} onChange={e=>setLeague(e.target.value)}>
                {LEAGUES.map(l=><option key={l} value={l}>{LEAGUE_NAMES[l]} ({l})</option>)}
              </select>
              <div style={{fontSize:"0.7rem",color:"#5a7a9a",marginTop:3}}>Applies to all teams</div>
            </div>
            <div>
              <label style={lbl}>Your Email</label>
              <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
              <div style={{fontSize:"0.7rem",color:"#5a7a9a",marginTop:3}}>Spreadsheet shared to this address</div>
            </div>
          </div>
        </div>

        {/* Days */}
        <div style={sec}>
          <div style={secT}>📅 Tournament Days</div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <label style={{...lbl,margin:0}}>Number of days:</label>
            <input style={{...inp,width:70}} type="number" min={1} max={10} value={numDays} onChange={e=>setDayCount(e.target.value)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            {days.map((d,i)=>(
              <div key={d.id} style={{background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:"#c8a84b",fontWeight:"bold",minWidth:48,fontSize:"0.82rem"}}>Day {i+1}</span>
                <select style={sel} value={d.label} onChange={e=>updateDay(i,"label",e.target.value)}>
                  {DAYS_OF_WEEK.map(dn=><option key={dn}>{dn}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Teams */}
        <div style={sec}>
          <div style={{...secT,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>🧢 Teams ({teams.length}/20)</span>
            {teams.length<20&&<button style={btn("ghost")} onClick={addTeam}>+ Add Team</button>}
          </div>

          {teams.map((team,ti)=>(
            <div key={team.id} style={card}>
              {/* Team name + remove */}
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:14,alignItems:"end"}}>
                <div>
                  <label style={lbl}>Team Name</label>
                  <input style={inp} value={team.name} onChange={e=>updateTeam(team.id,"name",e.target.value)} placeholder={`Team ${ti+1}`}/>
                </div>
                {teams.length>1&&<button style={{...btn("danger"),padding:"8px 12px"}} onClick={()=>removeTeam(team.id)}>✕ Remove</button>}
              </div>

              {/* Games per day — per team */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:"0.78rem",color:"#c8a84b",fontWeight:"bold",marginBottom:8,letterSpacing:"0.04em"}}>GAMES PER DAY</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:6}}>
                  {days.map((d,i)=>{
                    const sched = team.schedule&&team.schedule.find(s=>s.dayIdx===i);
                    const games = sched ? sched.games : 1;
                    return (
                      <div key={i} style={{background:"rgba(200,168,75,0.05)",border:"1px solid rgba(200,168,75,0.15)",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:"#8fa8c8",fontSize:"0.76rem",flex:1}}>{d.label}</span>
                        <select style={{...sel,width:90,padding:"4px 6px",fontSize:"0.78rem"}} value={games}
                          onChange={e=>updateSchedule(team.id,i,Number(e.target.value))}>
                          <option value={1}>1 Game</option>
                          <option value={2}>2 Games</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Paste button */}
              <div style={{marginBottom:10}}>
                <button style={{...btn("ghost"),fontSize:"0.76rem",padding:"5px 12px"}}
                  onClick={()=>setPasteOpen(o=>({...o,[team.id]:!o[team.id]}))}>
                  {pasteOpen[team.id]?"▲ Hide Paste":"📋 Paste Roster from Spreadsheet"}
                </button>
              </div>

              {pasteOpen[team.id]&&(
                <div style={{background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"12px",marginBottom:12}}>
                  <div style={{fontSize:"0.76rem",color:"#8fa8c8",marginBottom:8,lineHeight:1.7}}>
                    Copy rows from Excel or Google Sheets with columns:&nbsp;
                    <strong style={{color:"#c8a84b"}}>Surname · First Name · # · Date of Birth</strong>
                    <br/>
                    <span style={{color:"#f08060"}}>⚠️ Do not include the header row — data rows only.</span>
                    <br/>
                    <span style={{color:"#5a7a9a"}}>Replaces current roster for this team.</span>
                  </div>
                  <textarea style={{...inp,fontFamily:"monospace",fontSize:"0.78rem",minHeight:90,resize:"vertical",marginBottom:8}}
                    placeholder={"Smith\tJohn\t7\t15/04/2013\nJones\tMike\t12\t22/09/2012"}
                    value={pasteText[team.id]||""} onChange={e=>setPasteText(tx=>({...tx,[team.id]:e.target.value}))}/>
                  {pasteErr[team.id]&&<div style={{fontSize:"0.76rem",color:"#f08080",marginBottom:8}}>{pasteErr[team.id]}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button style={btn()} onClick={()=>applyPaste(team.id)}>✓ Import</button>
                    <button style={btn("ghost")} onClick={()=>{setPasteOpen(o=>({...o,[team.id]:false}));setPasteText(tx=>({...tx,[team.id]:""}));setPasteErr(e=>({...e,[team.id]:""}))}}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Player headers */}
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

              {team.players.length<16&&<button style={{...btn("ghost"),marginTop:8,fontSize:"0.76rem"}} onClick={()=>addPlayer(team.id)}>+ Add Player</button>}
              <div style={{fontSize:"0.7rem",color:"#5a7a9a",marginTop:6}}>{team.players.length}/16 players</div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div style={{textAlign:"center",marginTop:28}}>
          <button style={{...btn(),padding:"15px 48px",fontSize:"1rem",letterSpacing:"0.08em"}} onClick={handleSubmit}>
            ⚾ Create My Spreadsheet
          </button>
          <div style={{color:"#5a7a9a",fontSize:"0.78rem",marginTop:10}}>
            Your sheet will be created in Google Drive and shared to your email.
          </div>
        </div>

      </div>
    </div>
  );
}
