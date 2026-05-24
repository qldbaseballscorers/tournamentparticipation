// api/create-sheet.js
// Forwards the request to the Google Apps Script Web App
// Set APPS_SCRIPT_URL in Vercel environment variables

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error:"Method not allowed" });
  }

  var appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ error:"APPS_SCRIPT_URL environment variable not set" });
  }

  try {
    var response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
      redirect: "follow",
    });

    var text = await response.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      return res.status(500).json({ error: "Apps Script returned invalid response: " + text.slice(0,200) });
    }

    if (!data.ok) {
      return res.status(500).json({ error: data.error || "Apps Script error" });
    }

    return res.status(200).json({ url: data.url });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
