#!/usr/bin/env node

/**
 * Monitor DoD casualty releases using Puppeteer
 * 
 * Usage: 
 *   node monitor-dod.js              # Check once
 *   node monitor-dod.js --watch      # Check every 30 minutes
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_PATH = path.join(__dirname, '..', 'data', 'soldiers.json');
const CACHE_PATH = path.join(__dirname, '..', 'data', 'seen-releases.json');

// DoD casualty releases search
const DOD_URL = 'https://www.war.gov/News/Releases/';
const SEARCH_TERM = 'casualty';

// State abbreviations
const stateAbbr = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

// Geocode using OpenStreetMap
function geocode(city, state) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    
    setTimeout(() => { // Rate limit
      https.get(url, { 
        headers: { 'User-Agent': 'FallenAmericans/1.0' } 
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const results = JSON.parse(data);
            if (results.length > 0) {
              resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
            } else {
              resolve({ lat: 0, lng: 0 });
            }
          } catch (e) { resolve({ lat: 0, lng: 0 }); }
        });
      }).on('error', () => resolve({ lat: 0, lng: 0 }));
    }, 1000);
  });
}

// Parse soldier info from release text
function parseSoldiers(text, releaseDate) {
  const soldiers = [];
  
  // Pattern: "Rank Name, age, of City, State"
  const pattern = /((?:Sgt\.|Staff Sgt\.|Sgt\. 1st Class|Master Sgt\.|1st Sgt\.|Sgt\. Maj\.|Pfc\.|Pvt\.|Spc\.|Cpl\.|Capt\.|1st Lt\.|2nd Lt\.|Lt\. Col\.|Col\.|Maj\.|Brig\. Gen\.|Maj\. Gen\.|Lt\. Gen\.|Gen\.|Chief Warrant Officer \d|Warrant Officer|Petty Officer \d(?:st|nd|rd) Class|Seaman|Airman \d(?:st|nd|rd) Class|Senior Airman|Lance Cpl\.|Gunnery Sgt\.|Staff Sergeant|Sergeant|Specialist|Corporal|Private|Captain|Lieutenant|Major|Colonel|General))\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)(?:,\s*(\d+))?,?\s+of\s+([A-Za-z\s]+),\s+([A-Za-z\s]+)/gi;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const [, rank, name, age, city, state] = match;
    const stateCode = stateAbbr[state.toLowerCase().trim()] || state.trim();
    
    soldiers.push({
      rank: rank.trim(),
      name: name.trim(),
      age: age ? parseInt(age) : null,
      city: city.trim(),
      state: state.trim(),
      stateCode: stateCode,
      date: releaseDate
    });
  }
  
  return soldiers;
}

// Extract operation name from text
function extractOperation(text) {
  const patterns = [
    /Operation\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /during\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+operations/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return `Operation ${match[1]}`;
  }
  
  return 'Unknown Operation';
}

// Extract branch from text
function extractBranch(text) {
  if (/\b(?:Army|Soldier)\b/i.test(text)) return 'Army';
  if (/\b(?:Navy|Sailor)\b/i.test(text)) return 'Navy';
  if (/\b(?:Marine|Marines)\b/i.test(text)) return 'Marines';
  if (/\b(?:Air Force|Airman)\b/i.test(text)) return 'Air Force';
  if (/\b(?:Coast Guard)\b/i.test(text)) return 'Coast Guard';
  if (/\b(?:Space Force)\b/i.test(text)) return 'Space Force';
  return 'Unknown';
}

async function scrapeReleases() {
  console.log('Launching browser...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    // Go to releases page
    console.log('Navigating to war.gov...');
    await page.goto(DOD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Search for casualty
    console.log('Searching for casualty releases...');
    
    // Try to find search input
    const searchInput = await page.$('input[type="search"], input[name="search"], input[placeholder*="earch"]');
    if (searchInput) {
      await searchInput.type(SEARCH_TERM);
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    }
    
    // Wait for content
    await page.waitForTimeout(3000);
    
    // Get all release links
    const releases = await page.evaluate(() => {
      const items = [];
      const links = document.querySelectorAll('a[href*="/News/Releases/Release/"]');
      
      links.forEach(link => {
        const title = link.textContent.trim();
        const href = link.href;
        
        // Filter for casualty-related
        if (title.toLowerCase().includes('death') || 
            title.toLowerCase().includes('casualt') ||
            title.toLowerCase().includes('died') ||
            title.toLowerCase().includes('killed')) {
          items.push({ title, url: href });
        }
      });
      
      return items;
    });
    
    console.log(`Found ${releases.length} potential casualty releases`);
    
    // Load seen releases
    let seen = [];
    try {
      seen = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (e) {}
    
    // Process new releases
    const newSoldiers = [];
    
    for (const release of releases) {
      if (seen.includes(release.url)) {
        console.log(`  Skipping (already processed): ${release.title.substring(0, 50)}...`);
        continue;
      }
      
      console.log(`  Processing: ${release.title.substring(0, 50)}...`);
      
      // Visit release page
      await page.goto(release.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(1000);
      
      // Get release content
      const content = await page.evaluate(() => {
        const article = document.querySelector('article, .release-content, .news-content, main');
        return article ? article.textContent : document.body.textContent;
      });
      
      // Get release date
      const dateText = await page.evaluate(() => {
        const dateEl = document.querySelector('time, .date, .release-date');
        return dateEl ? dateEl.textContent : null;
      });
      
      const releaseDate = dateText ? new Date(dateText).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      // Parse soldiers from content
      const soldiers = parseSoldiers(content, releaseDate);
      const operation = extractOperation(content);
      const branch = extractBranch(content);
      
      for (const soldier of soldiers) {
        soldier.operation = operation;
        soldier.branch = branch;
        newSoldiers.push(soldier);
      }
      
      // Mark as seen
      seen.push(release.url);
    }
    
    // Save seen releases
    fs.writeFileSync(CACHE_PATH, JSON.stringify(seen, null, 2));
    
    return newSoldiers;
    
  } finally {
    await browser.close();
  }
}

async function addSoldiersToData(newSoldiers) {
  if (newSoldiers.length === 0) {
    console.log('No new soldiers to add.');
    return;
  }
  
  // Load existing data
  let soldiers = [];
  try {
    soldiers = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (e) {}
  
  let added = 0;
  
  for (const s of newSoldiers) {
    // Check for duplicate
    const exists = soldiers.find(existing => 
      existing.name.toLowerCase() === s.name.toLowerCase() &&
      existing.date === s.date
    );
    
    if (exists) {
      console.log(`  Duplicate: ${s.name}`);
      continue;
    }
    
    // Geocode
    console.log(`  Geocoding ${s.city}, ${s.state}...`);
    const coords = await geocode(s.city, s.state);
    
    const nextId = soldiers.length > 0 ? Math.max(...soldiers.map(x => x.id)) + 1 : 1;
    
    soldiers.push({
      id: nextId,
      name: s.name,
      rank: s.rank,
      hometown: `${s.city}, ${s.state}`,
      state: s.stateCode,
      lat: coords.lat,
      lng: coords.lng,
      date: s.date,
      operation: s.operation,
      branch: s.branch,
      photo: null
    });
    
    console.log(`  ✓ Added: ${s.rank} ${s.name}`);
    added++;
  }
  
  // Save
  fs.writeFileSync(DATA_PATH, JSON.stringify(soldiers, null, 2));
  console.log(`\nAdded ${added} new entries. Total: ${soldiers.length}`);
}

async function main() {
  const watchMode = process.argv.includes('--watch');
  
  const run = async () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Checking DoD releases at ${new Date().toLocaleString()}`);
    console.log('='.repeat(50));
    
    try {
      const newSoldiers = await scrapeReleases();
      await addSoldiersToData(newSoldiers);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };
  
  await run();
  
  if (watchMode) {
    console.log('\nWatch mode enabled. Checking every 30 minutes...');
    console.log('Press Ctrl+C to stop.\n');
    
    setInterval(run, 30 * 60 * 1000); // 30 minutes
  }
}

main().catch(console.error);
