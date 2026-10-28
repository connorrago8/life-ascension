// Disposable embedded PostgreSQL runner. Set QA_MODULES to a temporary install of @electric-sql/pglite 0.5.12.
import {pathToFileURL,fileURLToPath} from 'node:url';
const {pgcrypto}=await import(pathToFileURL(process.env.QA_MODULES+'/@electric-sql/pglite/dist/contrib/pgcrypto.js'));
import {statements} from './splitStatements.mjs';
const {PGlite}=await import(pathToFileURL(process.env.QA_MODULES+'/@electric-sql/pglite/dist/index.js'));
import {readFile,readdir} from 'node:fs/promises';
const root=fileURLToPath(new URL('../../',import.meta.url));const db=new PGlite({extensions:{pgcrypto}});
await db.exec(await readFile(root+'/tests/sql/prelude.sql','utf8'));
for(const f of (await readdir(root+'/supabase/migrations')).sort()) await db.exec((await readFile(root+'/supabase/migrations/'+f,'utf8')));
for(const f of ['api_keys_progress_smoke.sql','scheduling_auth_smoke.sql','two_user_mcp_auth.sql','archive_compat_smoke.sql','daily_late_window_smoke.sql','quest_classification_smoke.sql','quest_board_m1_smoke.sql']) {
 for(const statement of statements(await readFile(root+'/tests/sql/'+f,'utf8')))await db.exec(statement); console.log('PASS '+f);
}await db.close();
