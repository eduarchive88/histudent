import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgres://postgres:IWhPNjz5ZiHn2WT91BbC4LIZRpsa0DbK@100.119.242.108:54322/postgres'
});

async function updateCoolify() {
  try {
    await client.connect();
    const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`);
    console.log(tables.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

updateCoolify();
