import { transformArxivFeed } from './src/arxiv.js';

async function verifyMetrics() {
  console.log("Fetching raw XML from arXiv...");
  const url = new URL("https://export.arxiv.org/api/query?search_query=all:research&max_results=10");
  
  const response = await fetch(url);
  const xmlText = await response.text();
  
  // 1. Calculate raw XML payload size
  const rawXmlSizeKB = (Buffer.byteLength(xmlText, 'utf8') / 1024).toFixed(2);
  console.log(`\nRaw XML Payload Size: ${rawXmlSizeKB} KB`);
  
  // 2. Calculate transformation latency
  const startTime = performance.now();
  const items = transformArxivFeed(xmlText);
  const endTime = performance.now();
  
  const latencyMs = (endTime - startTime).toFixed(2);
  console.log(`XML-to-JSON Parsing Latency: ${latencyMs} ms (Target: < 150 ms)`);
  
  // 3. Calculate payload reduction and per-entry size
  const jsonText = JSON.stringify(items);
  const jsonSizeKB = (Buffer.byteLength(jsonText, 'utf8') / 1024).toFixed(2);
  
  const perEntryXML = (rawXmlSizeKB / items.length).toFixed(2);
  const perEntryJSON = (jsonSizeKB / items.length).toFixed(2);
  const reductionPercent = (((rawXmlSizeKB - jsonSizeKB) / rawXmlSizeKB) * 100).toFixed(2);
  
  console.log(`Optimized JSON Payload Size: ${jsonSizeKB} KB`);
  console.log(`Per-entry Raw XML Size: ~${perEntryXML} KB`);
  console.log(`Per-entry Optimized JSON Size: ~${perEntryJSON} KB (Target: < 5 KB)`);
  console.log(`Total Payload Reduction: ${reductionPercent}% (Target: > 75%)`);
}

verifyMetrics().catch(console.error);
