const { google } = require("googleapis");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  
  try {
    var raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) return res.status(500).json({ error: "No env var found" });
    
    var credentials;
    try {
      credentials = JSON.parse(raw);
    } catch(e) {
      return res.status(500).json({ error: "JSON parse failed: " + e.message });
    }
    
    return res.status(200).json({ 
      ok: true, 
      project: credentials.project_id,
      email: credentials.client_email
    });
    
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
