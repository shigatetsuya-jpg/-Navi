import { readFile } from 'node:fs/promises';

// Commit each schema change and its version marker together. If startup fails,
// retrying must not apply an already-committed ALTER TABLE a second time.
export async function applyMigration(db,version,path){
 const sql=await readFile(path,'utf8');
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(sql);
  db.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(version);
  db.exec('COMMIT');
 }catch(error){try{db.exec('ROLLBACK')}catch{}throw error}
}
