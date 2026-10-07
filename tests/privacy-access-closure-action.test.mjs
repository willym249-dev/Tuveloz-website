import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { build } from 'esbuild';

test('reviewed access closure is atomic and preserves privacy fulfillment', async t => {
 const repo=resolve(import.meta.dirname,'..'), scratch=mkdtempSync(join(tmpdir(),'closure-action-'));
 const db=new DatabaseSync(':memory:');
 const state={owner:true,beforeBatch:null,failAudit:false,env:{}};
 const oldFetch=globalThis.fetch;
 globalThis.__closureAction=state;
 const prepare=(sql)=>{let values=[];return {bind(...v){values=v;return this},async first(){return db.prepare(sql).get(...values)??null},async all(){return {results:db.prepare(sql).all(...values)}},execute(){if(state.failAudit&&sql.includes('INSERT INTO privacy_access_closure_reviews'))throw Error('private failure');return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}}}}};
 state.env.DB={prepare,async batch(statements){if(state.beforeBatch){const fn=state.beforeBatch;state.beforeBatch=null;fn()}db.exec('BEGIN');try{const results=statements.map(s=>s.execute());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};
 const seed=(table,values)=>{for(const col of db.prepare(`PRAGMA table_info(${table})`).all())if((col.notnull||col.pk)&&col.dflt_value===null&&!(col.name in values))values[col.name]=/INT/.test(col.type)?1:`synthetic-${col.name}-${values.id || values.email}`;const names=Object.keys(values);db.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(()=>'?').join(',')})`).run(...Object.values(values))};
 try {
 globalThis.fetch=async()=>{throw Error('No external requests')};
 for(const e of JSON.parse(readFileSync(join(repo,'drizzle/meta/_journal.json'),'utf8')).entries)db.exec(readFileSync(join(repo,'drizzle',e.tag+'.sql'),'utf8'));
 const bundle=join(scratch,'action.cjs');
 await build({absWorkingDir:repo,stdin:{contents:'export {POST} from "./app/api/admin/privacy-requests/close-access/route"; export {GET} from "./app/api/admin/privacy-requests/closure-preview/route";',resolveDir:repo,loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:bundle,logLevel:'silent',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^cloudflare:workers$|\/owner-auth$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='cloudflare:workers'?'export const env=globalThis.__closureAction.env;':'export const isVerifiedOwnerRequest=async()=>globalThis.__closureAction.owner; export const verifyOwnerRequest=async()=>globalThis.__closureAction.owner?{ok:true,email:"owner@example.invalid"}:{ok:false};'}))}}]});
 const api=createRequire(import.meta.url)(bundle);
 const request=(path,body,origin='https://tuveloz.invalid')=>new Request('https://tuveloz.invalid'+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const make=async id=>{const email=id+'@example.invalid';seed('account_credentials',{email});for(const role of ['customer','provider'])seed('auth_sessions',{id:id+role,email,role});seed('privacy_requests',{id,email,role:'customer',request_type:'account-closure',identity_source:'signed-in-account'});const response=await api.GET(request('/api/admin/privacy-requests/closure-preview?id='+id));assert.equal(response.status,200);const {preview}=await response.json();assert.equal(preview.accessClosureAllowed,true);return {id,reviewToken:preview.reviewToken,caseReference:'CASE-'+id+'-verified',reviewAfter:'2099-01-01',retentionNotes:'Retain records pending separate data disposition review.',confirmWholeAccount:true,confirmIdentityAndAuthority:true,confirmRetainedDataReview:true}};
 const post=body=>api.POST(request('/api/admin/privacy-requests/close-access',body));
 await t.test('closure revokes both roles, records verified owner and leaves request open; replay is harmless',async()=>{const body=await make('success');assert.equal((await post(body)).status,200);assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions WHERE email=?').get('success@example.invalid').n,0);assert.equal(db.prepare('SELECT status FROM privacy_requests WHERE id=?').get(body.id).status,'submitted');assert.equal(db.prepare('SELECT reviewed_by FROM privacy_access_closure_reviews WHERE request_id=?').get(body.id).reviewed_by,'owner@example.invalid');assert.ok(db.prepare('SELECT email FROM account_credentials WHERE email=?').get('success@example.invalid'));assert.equal((await (await post(body)).json()).alreadyClosed,true);assert.equal((await post({...body,caseReference:'DIFFERENT-CASE'})).status,409)});
 await t.test('withdrawal between review and write creates neither closure nor audit',async()=>{const body=await make('withdraw');state.beforeBatch=()=>db.prepare("UPDATE privacy_requests SET status='withdrawn' WHERE id=?").run(body.id);assert.equal((await post(body)).status,409);assert.equal(db.prepare('SELECT count(*) n FROM account_closures WHERE privacy_request_id=?').get(body.id).n,0);assert.equal(db.prepare('SELECT count(*) n FROM privacy_access_closure_reviews WHERE request_id=?').get(body.id).n,0)});
 await t.test('audit failure rolls back closure and revoked sessions',async()=>{const body=await make('rollback');state.failAudit=true;assert.equal((await post(body)).status,503);state.failAudit=false;assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions WHERE email=?').get('rollback@example.invalid').n,2);assert.equal(db.prepare('SELECT count(*) n FROM account_closures WHERE privacy_request_id=?').get(body.id).n,0);assert.equal((await post(body)).status,200)});
 await t.test('owner, origin, confirmation and stale case checks reject mutation',async()=>{const body=await make('guard');state.owner=false;assert.equal((await post(body)).status,403);state.owner=true;assert.equal((await api.POST(request('/api/admin/privacy-requests/close-access',body,'https://other.invalid'))).status,403);assert.equal((await post({...body,confirmWholeAccount:false})).status,400);db.prepare('UPDATE privacy_requests SET details=? WHERE id=?').run('Changed private request details',body.id);assert.equal((await post(body)).status,409);assert.equal(db.prepare('SELECT count(*) n FROM account_closures WHERE privacy_request_id=?').get(body.id).n,0)});
 await t.test('a job created between review and write blocks closure without an audit',async()=>{const body=await make('jobrace');state.beforeBatch=()=>seed('customer_requests',{id:'new-job',email:'jobrace@example.invalid',parts_source:'No parts needed — labor only',parts_preference:'No preference',labor_only_parts_acknowledged_at:new Date().toISOString()});assert.equal((await post(body)).status,409);assert.equal(db.prepare('SELECT count(*) n FROM privacy_access_closure_reviews WHERE request_id=?').get(body.id).n,0);assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions WHERE email=?').get('jobrace@example.invalid').n,2)});
 for (const kind of ['hold','payment','staff','published','sponsor']) {
 await t.test(`${kind} introduced during closure review prevents access changes`,async()=>{
 const body=await make('race-'+kind), email=body.id+'@example.invalid', provider='provider-'+kind;
 state.beforeBatch=()=>{
 if(kind==='hold')seed('data_rights_requests',{id:'hold-race',requester_email:email,requester_role:'customer',request_type:'deletion',legal_hold:'yes'});
 if(kind==='payment')seed('stripe_payments',{id:'payment-race',customer_email:email});
 if(['staff','published','sponsor'].includes(kind))seed('provider_applications',{id:provider,email});
 if(kind==='staff')seed('provider_personnel',{id:'staff-race',provider_id:provider,person_id:'other-person'});
 if(kind==='published')seed('provider_profiles',{id:'profile-race',provider_id:provider,slug:'synthetic-race',public_status:'published'});
 if(kind==='sponsor')seed('provider_pathway_profiles',{id:'sponsor-race',provider_id:'other-provider',sponsoring_provider_id:provider});
 };
 assert.equal((await post(body)).status,409);
 assert.equal(db.prepare('SELECT count(*) n FROM account_closures WHERE privacy_request_id=?').get(body.id).n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM privacy_access_closure_reviews WHERE request_id=?').get(body.id).n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions WHERE email=?').get(email).n,2);
 });
 }
 await t.test('competing closure cannot acquire an audit from the stale review',async()=>{const body=await make('competing');state.beforeBatch=()=>seed('account_closures',{email:'competing@example.invalid',privacy_request_id:'separate-case',case_reference:'SEPARATE-VERIFIED',review_after:'2099-01-01'});assert.equal((await post(body)).status,409);assert.equal(db.prepare('SELECT count(*) n FROM privacy_access_closure_reviews WHERE request_id=?').get(body.id).n,0)});
 }finally{globalThis.fetch=oldFetch;delete globalThis.__closureAction;db.close();rmSync(scratch,{recursive:true,force:true})}
});
