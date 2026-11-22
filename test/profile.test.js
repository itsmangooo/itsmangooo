import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDays, windowFor, monthWindows, fetchContributions, createClient, validateSnapshot } from '../scripts/github.js';
import { renderAssets, renderReadme, languageDistribution, weeklyTotals, escapeXml } from '../scripts/render.js';
import { generate } from '../scripts/generate.js';
import { projects, login } from '../scripts/config.js';

const emptyConnection=()=>({nodes:[],pageInfo:{hasNextPage:false,endCursor:null}});
function emptyCollection() {
  return {commitContributionsByRepository:[],issueContributions:emptyConnection(),
    pullRequestContributions:emptyConnection(),pullRequestReviewContributions:emptyConnection(),
    repositoryContributions:emptyConnection()};
}
function fixture() {
  const range=windowFor(new Date('2026-11-22T12:00:00Z'));
  return {schemaVersion:1,login,capturedOn:range.end,range,
    repositories:projects.map(p=>({name:p.repo,url:`https://github.com/${login}/${p.repo}`,
      description:p.lines.join(' '),language:'Go',languages:{Go:10,JavaScript:4,'C#':2,Dart:1},
      stars:0,pushedAt:'2026-11-18T10:00:00Z',archived:false,topics:[]})),
    days:Array.from({length:365},(_,i)=>({date:addDays(range.start,i),commits:i%17===0?2:0,
      issues:0,pullRequests:0,reviews:0,repositories:0,total:i%17===0?2:0}))};
}

test('365 UTC days cross leap years without overlap or missing month boundaries',()=>{
  const range=windowFor(new Date('2024-03-01T23:59:00Z'));
  const months=monthWindows(range.start,range.end);
  assert.equal(months[0].start,range.start);
  assert.equal(months.at(-1).end,range.end);
  for(let i=1;i<months.length;i++) assert.equal(addDays(months[i-1].end,1),months[i].start);
  assert.equal(addDays('2024-02-28',1),'2024-02-29');
});

test('public-only contribution accounting excludes private, restricted and null records',async()=>{
  const request=async()=>{
    const c=emptyCollection();
    c.commitContributionsByRepository=[
      {repository:{isPrivate:false},contributions:{nodes:[{occurredAt:'2026-11-20T08:00:00Z',commitCount:3}],pageInfo:{hasNextPage:false}}},
      {repository:{isPrivate:true,name:'NEVER_PUBLISH_THIS'},contributions:{nodes:[{occurredAt:'2026-11-20T08:00:00Z',commitCount:900}],pageInfo:{hasNextPage:false}}},
      {repository:null,contributions:{nodes:[{occurredAt:'2026-11-20',commitCount:800}],pageInfo:{hasNextPage:false}}},
    ];
    c.issueContributions.nodes=[{occurredAt:'2026-11-20',issue:{repository:{isPrivate:false}}},
      {occurredAt:'2026-11-20',issue:{repository:{isPrivate:true}}},{occurredAt:'2026-11-20',issue:null}];
    c.pullRequestContributions.nodes=[{occurredAt:'2026-11-20',pullRequest:{repository:{isPrivate:false}}}];
    c.pullRequestReviewContributions.nodes=[{occurredAt:'2026-11-20',pullRequestReview:{repository:{isPrivate:false}}}];
    c.repositoryContributions.nodes=[{occurredAt:'2026-11-20',repository:{isPrivate:false}}];
    return {data:{user:{contributionsCollection:c}}};
  };
  const days=await fetchContributions(request,login,'2026-11-20','2026-11-22',new Date('2026-11-22T12:00:00Z'));
  assert.equal(days[0].total,7);
  assert.equal(days[1].total,0);
  assert.doesNotMatch(JSON.stringify(days),/NEVER_PUBLISH_THIS|900|800/);
});

test('issue pagination uses cursors without replaying commit groups',async()=>{
  let calls=0;
  const request=async(_path,{variables})=>{
    calls++;
    const c=emptyCollection();
    c.issueContributions.nodes=[{occurredAt:'2026-11-20',issue:{repository:{isPrivate:false}}}];
    if(!variables.after) c.issueContributions.pageInfo={hasNextPage:true,endCursor:'next'};
    else assert.equal(variables.after,'next');
    return {data:{user:{contributionsCollection:c}}};
  };
  const days=await fetchContributions(request,login,'2026-11-20','2026-11-22',new Date('2026-11-22T12:00:00Z'));
  assert.equal(calls,2);assert.equal(days[0].issues,2);
});

test('truncated commit groups and malformed API records fail closed',async()=>{
  const c=emptyCollection();
  c.commitContributionsByRepository=Array.from({length:100},()=>({repository:{isPrivate:false}}));
  await assert.rejects(fetchContributions(async()=>({data:{user:{contributionsCollection:c}}}),login,
    '2026-11-20','2026-11-22',new Date('2026-11-22T12:00:00Z')),/limit reached/);
});

test('transient errors retry, long rate limits stop without leaking response bodies',async()=>{
  let calls=0;const waits=[];
  const client=createClient({token:'TEST_TOKEN',sleep:async ms=>waits.push(ms),fetchImpl:async(_url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer TEST_TOKEN');
    return ++calls===1?new Response('private response text',{status:429,headers:{'retry-after':'1'}})
      :Response.json({ok:true});
  }});
  assert.deepEqual(await client('/test'),{ok:true});assert.deepEqual(waits,[1000]);
  const limited=createClient({sleep:async()=>assert.fail(),fetchImpl:async()=>
    new Response('private response text',{status:403,headers:{'x-ratelimit-remaining':'0','retry-after':'3600'}})});
  await assert.rejects(limited('/test'),error=>error.message.includes('403')&&!error.message.includes('private response'));
});

test('GraphQL partial results are rejected rather than becoming zero-valued statistics',async()=>{
  const client=createClient({fetchImpl:async()=>Response.json({data:{},errors:[{message:'private repository name'}]})});
  await assert.rejects(client('/graphql',{query:'test'}),/GraphQL query failed/);
});

test('language distribution is byte-weighted with a correct Other bucket',()=>{
  const distribution=languageDistribution([{languages:{Go:50,JavaScript:30,'C#':15,Dart:4,CSS:1}}]);
  assert.deepEqual(distribution.map(d=>[d.name,d.percent]),[['Go',50],['JavaScript',30],['C#',15],['Other',5]]);
  assert.deepEqual(languageDistribution([]),[]);
});

test('weekly chart starts Monday and includes the current partial week once',()=>{
  const result=weeklyTotals([{date:'2026-11-15',total:5},{date:'2026-11-16',total:7},
    {date:'2026-11-18',total:3},{date:'2026-11-19',total:500}],'2026-11-18');
  assert.equal(result.at(-1).start,'2026-11-16');assert.equal(result.at(-1).total,10);
  assert.equal(result.at(-2).total,5);
});

test('snapshot arithmetic and contiguous dates are validated',()=>{
  const data=fixture();validateSnapshot(data,login);
  data.days[10].total++;
  assert.throws(()=>validateSnapshot(data,login),/contribution day/);
});

test('changed widgets receive new image URLs while unchanged artwork keeps its cache',()=>{
  const data=fixture();
  const before=renderReadme(data);
  data.days.at(-1).commits++;data.days.at(-1).total++;
  const after=renderReadme(data);
  const reference=(readme,name)=>readme.match(new RegExp(`assets/${name}-dark\\.svg\\?v=[a-f0-9]{12}`))[0];
  assert.notEqual(reference(before,'stats'),reference(after,'stats'));
  assert.notEqual(reference(before,'calendar'),reference(after,'calendar'));
  assert.equal(reference(before,'header'),reference(after,'header'));
});

test('SVG text is escaped and all widgets render even with no activity',()=>{
  assert.equal(escapeXml('<x a="&">'), '&lt;x a=&quot;&amp;&quot;&gt;');
  const data=fixture();data.days.forEach(day=>{day.commits=0;day.total=0;});
  data.repositories[0].languages={'<script>':100};
  const assets=renderAssets(data);
  assert.equal(assets.size,28);
  for(const content of assets.values()) {
    assert.doesNotMatch(content,/<script|NaN|Infinity|undefined|foreignObject/);
    assert.match(content,/<title id="title">/);
  }
});

test('offline generation is deterministic and a failed refresh retains every good file',async()=>{
  const root=await mkdtemp(join(tmpdir(),'mango-profile-'));
  try {
    await mkdir(join(root,'data'));
    await writeFile(join(root,'data/snapshot.json'),JSON.stringify(fixture()));
    const first=await generate({root,offline:true});assert.ok(first.changed>0);
    assert.equal((await generate({root,offline:true})).changed,0);
    const before=await readFile(join(root,'README.md'),'utf8');
    const snapshot=await readFile(join(root,'data/snapshot.json'),'utf8');
    await assert.rejects(generate({root,token:'TEST_TOKEN',sleep:async()=>{},fetchImpl:async()=>{throw Error('offline');}}),/unavailable/);
    assert.equal(await readFile(join(root,'README.md'),'utf8'),before);
    assert.equal(await readFile(join(root,'data/snapshot.json'),'utf8'),snapshot);
  } finally {await rm(root,{recursive:true,force:true});}
});
