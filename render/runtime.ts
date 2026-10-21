import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
// This adapter is selected only by build:render. Sites continues to use native D1.
const file=resolve(process.env.TRAILGUARD_DB_PATH||'data/trailguard.sqlite');
mkdirSync(dirname(file),{recursive:true});
const database=new DatabaseSync(file);
database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
database.exec('CREATE TABLE IF NOT EXISTS workspaces (owner TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)');
class BoundStatement {
 constructor(private sql:string,private values:any[]=[]){}
 bind(...values:any[]){return new BoundStatement(this.sql,values);}
 async first<T>():Promise<T|null>{return (database.prepare(this.sql).get(...this.values) as T)||null;}
 async run(){const result=database.prepare(this.sql).run(...this.values);return {meta:{changes:Number(result.changes)}};}
}
export const env={DB:{prepare:(sql:string)=>new BoundStatement(sql)},OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL,TRAILGUARD_HOST:'render'};
export function storageHealth(){database.prepare('SELECT 1').get();return true;}
