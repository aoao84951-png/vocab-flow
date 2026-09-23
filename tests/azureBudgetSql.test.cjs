// Run with NODE_PATH pointing to an installation of @electric-sql/pglite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
let PGlite;
try { ({ PGlite } = require('@electric-sql/pglite')); } catch { /* Optional isolated PostgreSQL test dependency. */ }
test('SQL caps competing requests, starts a new month, and denies public writes', { skip: !PGlite && 'Install @electric-sql/pglite and set NODE_PATH to run this test' }, async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const migration = fs.readFileSync('supabase/migrations/202609240001_azure_budget.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // safe to re-run
    await db.exec("insert into azure_tts_usage values ((date_trunc('month',now() at time zone 'UTC') - interval '1 month')::date,500000)");
    const reservations = await Promise.all(Array.from({ length: 12 }, () => db.query('select reserve_azure_tts(50000) as allowed')));
    assert.equal(reservations.filter(r => r.rows[0].allowed).length, 10);
    assert.equal((await db.query('select sum(used)::int as total from azure_tts_usage')).rows[0].total, 1000000);
    assert.equal((await db.query('select reserve_azure_tts(1) as allowed')).rows[0].allowed, false);
    for (const n of [-1, 0, 500001]) assert.equal((await db.query(`select reserve_azure_tts(${n}) as allowed`)).rows[0].allowed, false);
    await db.exec('set role anon');
    await assert.rejects(db.query('select reserve_azure_tts(1)'));
    await assert.rejects(db.query('select * from azure_tts_audio'));
  } finally { await db.close(); }
});
