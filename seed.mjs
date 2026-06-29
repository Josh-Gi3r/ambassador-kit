import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

const now = new Date();
const day = 86400000;

// Delete existing test rows first
await db.query("DELETE FROM ambassador_applications WHERE email LIKE '%@demo.com'");
console.log('Cleared old demo rows');

const applicants = [
  {status:'approved',ci:'community',ts:9,tw:'@alexchen_crypto',tg:'@alexchen',em:'alex.chen@demo.com',lv:2,ec:1,xc:8,xe:7,xco:9,cc:8,ta:7,ao:0,tot:87,st:1,tracks:['community','content'],ws:[65,70,78,87],badges:['knowledgeable','consistent','creator','amplifier','community_builder'],dh:'@alexchen_crypto',hce:'yes',cl:[{url:'https://t.me/sgcrypto',description:'Singapore Crypto Community'}],sd:'This protocol is building next-generation infrastructure for cross-border value transfer — enabling stablecoins to move globally without friction.',sb:'I run a crypto community of 3000 members in Singapore and have been explaining DeFi infrastructure for 2 years.',ft:'Week 1: Deep-dive thread on the protocol market maker model. Week 2: Video explainer on stablecoin settlement. Week 3: Community AMA. Week 4: Recap post.',ca:new Date(now-7*day)},
  {status:'approved',ci:'content',ts:10,tw:'@mariasantos_fx',tg:'@mariasantos',em:'maria.santos@demo.com',lv:2,ec:1,xc:9,xe:8,xco:7,cc:6,ta:5,ao:0,tot:82,st:1,tracks:['content'],ws:[55,65,74,82],badges:['perfect_score','articulate','creator','high_reach'],dh:'@mariasantos_fx',hce:'yes',cl:[{url:'https://twitter.com/mariasantos_fx',description:'Main X account - 15k followers'}],sd:'This protocol solves the last-mile problem in cross-border transfers via decentralized infrastructure.',sb:'Content creator with 15k followers on X focused on DeFi and stablecoin education.',ft:'Launch a 10-part thread series breaking down the protocol architecture. Produce 2 short-form videos.',ca:new Date(now-6*day)},
  {status:'approved',ci:'community',ts:8,tw:'@jamesokafor_web3',tg:'@jamesokafor',em:'james.okafor@demo.com',lv:1,ec:1,xc:7,xe:6,xco:8,cc:9,ta:8,ao:0,tot:74,st:1,tracks:['community','developer'],ws:[50,58,66,74],badges:['knowledgeable','consistent','community_builder','amplifier'],dh:'@jamesokafor_web3',hce:'yes',cl:[{url:'https://t.me/web3lagos',description:'Web3 Lagos - 2000 members'}],sd:'This protocol enables atomic swaps between stablecoins, removing traditional intermediary requirements.',sb:'Developer and community lead for Web3 Lagos, 2000+ members. Built 3 DeFi integrations.',ft:'Host a Web3 meetup focused on the protocol. Build a simple demo integration. Post weekly updates.',ca:new Date(now-5*day)},
  {status:'pending',ci:'content',ts:7,tw:'@sofiamueller_defi',tg:'@sofiamueller',em:'sofia.mueller@demo.com',lv:1,ec:0,xc:6,xe:5,xco:6,cc:5,ta:4,ao:0,tot:61,st:0,tracks:['content'],ws:[45,52,58,61],badges:['knowledgeable','articulate'],dh:'@sofiamueller_defi',hce:'no',cl:[],sd:'This protocol enables on-chain settlement through a decentralized market maker model.',sb:'DeFi researcher and writer. Published in major crypto media outlets.',ft:'Write 3 long-form articles about the protocol. Translate content to German for European audience.',ca:new Date(now-4*day)},
  {status:'pending',ci:'developer',ts:9,tw:'@kaitanaka_demo',tg:'@kaitanaka',em:'kai.tanaka@demo.com',lv:1,ec:0,xc:5,xe:5,xco:7,cc:6,ta:7,ao:0,tot:68,st:0,tracks:['developer'],ws:[48,55,62,68],badges:['knowledgeable','consistent','network_embedded'],dh:'@kaitanaka_demo',hce:'yes',cl:[{url:'https://github.com/kaitanaka',description:'GitHub - 500+ followers, active DeFi contributor'}],sd:'This protocol is building the settlement layer for the on-chain economy — enabling real-time swaps at institutional scale.',sb:'Solidity developer with 5 years experience. Contributor to 3 open-source DeFi protocols.',ft:'Build a protocol SDK wrapper in TypeScript. Document the integration process. Post weekly dev updates.',ca:new Date(now-3*day)},
  {status:'pending',ci:'community',ts:6,tw:'@priyasharma_web3',tg:'@priyasharma',em:'priya.sharma@demo.com',lv:0,ec:0,xc:3,xe:3,xco:4,cc:5,ta:4,ao:0,tot:44,st:-1,tracks:['community'],ws:[40,48,50,44],badges:['community_builder'],dh:'@priyasharma_web3',hce:'yes',cl:[{url:'https://t.me/indiadefi',description:'India DeFi community'}],sd:'This protocol enables on-chain cross-border settlement.',sb:'Community manager for a DeFi project in India.',ft:'Post about the protocol on X and engage with the community.',ca:new Date(now-2*day)},
];

for (const a of applicants) {
  const tracksJson = JSON.stringify(a.tracks);
  const wsJson = JSON.stringify(a.ws);
  const badgesJson = JSON.stringify(a.badges);
  const clJson = JSON.stringify(a.cl);
  
  const [r] = await db.query(
    `INSERT INTO ambassador_applications 
     (status, contributionIntent, testScore, twitterHandle, telegramHandle, email, isEvangelist, lastStep, level, evangelistCandidate, 
      xContentScore, xEngagementScore, xConsistencyScore, communityContribScore, tgActivityScore, adminOverrideScore, totalScore, scoreTrend, 
      tracks, weeklyScores, badges, displayHandle, hasCommunityExperience, communityLinks, protocolDescription, communityBenefit, firstThirtyDays, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, 0, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
             CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, CAST(? AS JSON), ?, ?, ?, ?, NOW())`,
    [a.status, a.ci, a.ts, a.tw, a.tg, a.em, a.lv, a.ec,
     a.xc, a.xe, a.xco, a.cc, a.ta, a.ao, a.tot, a.st,
     tracksJson, wsJson, badgesJson, a.dh, a.hce, clJson,
     a.sd, a.sb, a.ft, a.ca]
  );
  console.log('Inserted', a.tw, 'id:', r.insertId);
}

await db.end();
console.log('Seeding complete!');
