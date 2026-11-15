#!/usr/bin/env node
// Alex addition (not from FinAI): runs FinAI's projectionMoat.js on stdin, like analysisRunner.js.
// stdin:  {"stockData": {...}, "finviz": {...}|null, "shareholding": {...}|null}
// stdout: {"projection", "moat", "sectorOutlook"}
const { buildProjection, buildMoat, sectorOutlook } = require('./projectionMoat');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    const { stockData, finviz, shareholding } = JSON.parse(input);
    process.stdout.write(JSON.stringify({
      projection: buildProjection(stockData, finviz),
      moat: buildMoat(stockData, shareholding),
      sectorOutlook: { sector: stockData.sector || 'default', ...sectorOutlook(stockData.sector) },
    }));
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
});
