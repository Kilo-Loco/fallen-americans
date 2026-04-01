// Initialize map centered on US
const map = L.map('map', {
  center: [39.8283, -98.5795],
  zoom: 4,
  zoomControl: true,
  scrollWheelZoom: true
});

// Dark map tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// Store markers and data
let soldiers = [];
let markers = [];

// Custom marker icon
function createMarkerIcon() {
  return L.divIcon({
    className: 'soldier-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12]
  });
}

// Load soldier data
async function loadData() {
  try {
    const response = await fetch('data/soldiers.json');
    soldiers = await response.json();
    
    // Update stats dynamically from data
    document.getElementById('total-count').textContent = soldiers.length;
    document.getElementById('identified-count').textContent = soldiers.length;
    
    const states = new Set(soldiers.map(s => s.state));
    document.getElementById('states-count').textContent = states.size;
    
    // Clear pending note since all are sourced from confirmed DoD announcements
    const pendingNote = document.getElementById('pending-note');
    pendingNote.textContent = '';
    
    // Add markers
    soldiers.forEach(soldier => {
      const marker = L.marker([soldier.lat, soldier.lng], {
        icon: createMarkerIcon()
      }).addTo(map);
      
      // Popup on hover
      marker.bindPopup(`
        <div class="popup-name">${soldier.rank} ${soldier.name}</div>
        <div class="popup-hometown">${soldier.hometown}</div>
      `, {
        closeButton: false
      });
      
      marker.on('mouseover', function() {
        this.openPopup();
      });
      
      marker.on('mouseout', function() {
        this.closePopup();
      });
      
      // Click to open panel
      marker.on('click', function() {
        showSoldierDetails(soldier);
      });
      
      markers.push(marker);
    });
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Show soldier details in panel
function showSoldierDetails(soldier) {
  const panel = document.getElementById('soldier-panel');
  const details = document.getElementById('soldier-details');
  
  const photoHtml = soldier.photo 
    ? `<img src="${soldier.photo}" alt="${soldier.name}" class="soldier-photo">`
    : `<div class="soldier-photo-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>`;
  
  const formattedDate = new Date(soldier.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  details.innerHTML = `
    ${photoHtml}
    <div class="soldier-rank">${soldier.rank}</div>
    <div class="soldier-name">${soldier.name}</div>
    <ul class="soldier-info">
      <li>
        <span class="info-label">Hometown</span>
        <span class="info-value">${soldier.hometown}</span>
      </li>
      <li>
        <span class="info-label">Branch</span>
        <span class="info-value">${soldier.branch}</span>
      </li>
      <li>
        <span class="info-label">Date</span>
        <span class="info-value">${formattedDate}</span>
      </li>
      <li>
        <span class="info-label">Operation</span>
        <span class="info-value">${soldier.operation}</span>
      </li>
    </ul>
  `;
  
  panel.classList.remove('hidden');
  
  // Center map on soldier
  map.flyTo([soldier.lat, soldier.lng], 7, {
    duration: 0.5
  });
}

// Close panel
function closePanel() {
  document.getElementById('soldier-panel').classList.add('hidden');
  map.flyTo([39.8283, -98.5795], 4, {
    duration: 0.5
  });
}

// Initialize
loadData();
