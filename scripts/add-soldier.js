#!/usr/bin/env node

/**
 * Add a soldier to the database with automatic geocoding
 * 
 * Usage: node add-soldier.js "Rank" "Name" "City, State" "YYYY-MM-DD" "Operation" "Branch"
 * 
 * Example:
 *   node add-soldier.js "Sergeant" "John Smith" "Austin, Texas" "2026-03-01" "Operation Epic Fury" "Army"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'soldiers.json');

// State name to abbreviation
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

// Geocode using OpenStreetMap Nominatim (free, no API key)
function geocode(city, state) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    
    https.get(url, { 
      headers: { 'User-Agent': 'FallenAmericans/1.0 (memorial project)' } 
    }, (res) => {
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
            reject(new Error(`Could not geocode: ${city}, ${state}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function getStateAbbr(stateName) {
  // If already an abbreviation
  if (stateName.length === 2) return stateName.toUpperCase();
  
  // Look up full name
  const abbr = stateAbbr[stateName.toLowerCase()];
  if (abbr) return abbr;
  
  // Return as-is if not found
  return stateName;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 6) {
    console.log('Usage: node add-soldier.js "Rank" "Name" "City, State" "YYYY-MM-DD" "Operation" "Branch"');
    console.log('');
    console.log('Example:');
    console.log('  node add-soldier.js "Sergeant" "John Smith" "Austin, Texas" "2026-03-01" "Operation Epic Fury" "Army"');
    process.exit(1);
  }
  
  const [rank, name, hometown, date, operation, branch] = args;
  
  // Parse hometown
  const [city, state] = hometown.split(',').map(s => s.trim());
  const stateCode = getStateAbbr(state);
  
  console.log(`Adding: ${rank} ${name}`);
  console.log(`Hometown: ${city}, ${state} (${stateCode})`);
  console.log(`Date: ${date}`);
  console.log(`Operation: ${operation}`);
  console.log(`Branch: ${branch}`);
  console.log('');
  
  // Geocode
  console.log('Geocoding...');
  let coords;
  try {
    coords = await geocode(city, state);
    console.log(`Location: ${coords.lat}, ${coords.lng}`);
  } catch (e) {
    console.error('Geocoding failed:', e.message);
    console.log('You can manually add lat/lng to the JSON file.');
    coords = { lat: 0, lng: 0 };
  }
  
  // Load existing data
  let soldiers = [];
  try {
    soldiers = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (e) {
    console.log('Creating new data file...');
  }
  
  // Get next ID
  const nextId = soldiers.length > 0 ? Math.max(...soldiers.map(s => s.id)) + 1 : 1;
  
  // Create new entry
  const newSoldier = {
    id: nextId,
    name: name,
    rank: rank,
    hometown: `${city}, ${state}`,
    state: stateCode,
    lat: coords.lat,
    lng: coords.lng,
    date: date,
    operation: operation,
    branch: branch,
    photo: null
  };
  
  // Check for duplicates
  const duplicate = soldiers.find(s => 
    s.name.toLowerCase() === name.toLowerCase() && 
    s.date === date
  );
  
  if (duplicate) {
    console.log('');
    console.log('WARNING: Possible duplicate entry found:');
    console.log(`  ${duplicate.rank} ${duplicate.name} (${duplicate.date})`);
    console.log('Entry NOT added. Remove the existing entry first if this is an update.');
    process.exit(1);
  }
  
  // Add and save
  soldiers.push(newSoldier);
  fs.writeFileSync(DATA_PATH, JSON.stringify(soldiers, null, 2));
  
  console.log('');
  console.log('✓ Added successfully!');
  console.log(`Total entries: ${soldiers.length}`);
}

main().catch(console.error);
