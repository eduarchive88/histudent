import fs from 'node:fs';
const API_URL = "http://100.119.242.108:8000/api/v1";
const TOKEN = "Bearer 1|780yyKoeBtoaDt94jTl6w9TiMatTzwVKbjVTUeIMeb806a0a";
const APP_UUID = "u11i7krg6k7em23tcb6fftib";

async function patchDomain() {
  const composeRaw = fs.readFileSync('docker-compose.yml', 'utf8');
  const patchRes = await fetch(`${API_URL}/applications/${APP_UUID}`, {
      method: 'PATCH',
      headers: { 'Authorization': TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
          docker_compose_raw: composeRaw,
          docker_compose_domains: [{"name": "histudent-app", "domain": "https://histudent.eduarchive.duckdns.org"}]
      })
  });
  console.log("PATCH Domains:", patchRes.status, await patchRes.text());
  
  if(patchRes.status === 201 || patchRes.status === 202) {
    const startRes = await fetch(`${API_URL}/applications/${APP_UUID}/start`, {
      method: 'POST',
      headers: { 'Authorization': TOKEN, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });
    console.log("START:", await startRes.json());
  }
}

patchDomain();
