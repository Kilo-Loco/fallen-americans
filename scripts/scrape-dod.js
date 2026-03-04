#!/usr/bin/env node

/**
 * Scrape DoD casualty announcements from war.gov
 * 
 * Usage: node scrape-dod.js
 * 
 * This fetches the latest casualty press releases and extracts:
 * - Name, rank, age
 * - Hometown (city, state)
 * - Date of death
 * - Operation name
 * - Branch of service
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DOD_SEARCH_URL = 'https://www.war.gov/News/Releases/Search/casualty/';

// Fetch HTML from URL
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Parse casualty info from press release text
function parseCasualtyRelease(text) {
  const soldiers = [];
  
  // Common patterns in DoD releases:
  // "Sgt. John Smith, 25, of City, State, died..."
  // "The Department of Defense announced today the death of..."
  
  const namePattern = /(?:Sgt\.|Staff Sgt\.|Sgt\. 1st Class|Master Sgt\.|1st Sgt\.|Sgt\. Maj\.|Pfc\.|Pvt\.|Spc\.|Cpl\.|Capt\.|1st Lt\.|2nd Lt\.|Lt\. Col\.|Col\.|Maj\.|Gen\.|Chief Warrant Officer \d|Warrant Officer)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/g;
  
  const hometownPattern = /of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+([A-Z][a-z]+)/g;
  
  // Extract names
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    soldiers.push({
      fullMatch: match[0],
      name: match[1]
    });
  }
  
  return soldiers;
}

// Geocode hometown to lat/lng using free API
async function geocodeCity(city, state) {
  const query = encodeURIComponent(`${city}, ${state}, USA`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'FallenAmericans/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            resolve({
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon)
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// State abbreviations
const stateAbbr = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

async function main() {
  console.log('Fetching DoD casualty releases...');
  console.log('URL:', DOD_SEARCH_URL);
  console.log('');
  console.log('NOTE: This script provides the framework.');
  console.log('The actual war.gov site may require browser automation (Puppeteer)');
  console.log('to fully render the JavaScript content.');
  console.log('');
  console.log('For now, manually add entries to data/soldiers.json');
  console.log('');
  
  // Load existing data
  const dataPath = path.join(__dirname, '..', 'data', 'soldiers.json');
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Loaded ${existing.length} existing entries.`);
  } catch (e) {
    console.log('No existing data found.');
  }
  
  // Example: Add new entry interactively
  console.log('');
  console.log('To add a new entry, use:');
  console.log('  node scripts/add-soldier.js "Rank" "Name" "City, State" "YYYY-MM-DD" "Operation" "Branch"');
}

main().catch(console.error);
