// Floor Plan Visualization for Smart Home Devices

export function createFloorPlan(devices) {
  const svg = document.getElementById('floorPlanSvg');
  if (!svg) return;
  
  // Clear existing content
  svg.innerHTML = '';
  
  // Define house layout (Johnson Residence)
  const rooms = [
    { name: 'Living Room', x: 50, y: 50, width: 300, height: 200, color: '#e3f2fd' },
    { name: 'Kitchen', x: 370, y: 50, width: 200, height: 150, color: '#fff3e0' },
    { name: 'Bedroom', x: 50, y: 270, width: 250, height: 180, color: '#f3e5f5' },
    { name: 'Bathroom', x: 320, y: 270, width: 150, height: 100, color: '#e8f5e9' },
    { name: 'Hallway', x: 490, y: 270, width: 100, height: 180, color: '#fce4ec' },
    { name: 'Garage', x: 610, y: 50, width: 140, height: 200, color: '#fff9c4' },
    { name: 'Backyard', x: 610, y: 270, width: 140, height: 180, color: '#c8e6c9' },
    { name: 'Main Entrance', x: 370, y: 220, width: 100, height: 30, color: '#ffccbc' }
  ];
  
  // Draw rooms
  rooms.forEach(room => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', room.x);
    rect.setAttribute('y', room.y);
    rect.setAttribute('width', room.width);
    rect.setAttribute('height', room.height);
    rect.setAttribute('fill', room.color);
    rect.setAttribute('stroke', '#90a4ae');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('rx', '4');
    svg.appendChild(rect);
    
    // Room label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', room.x + room.width / 2);
    text.setAttribute('y', room.y + 20);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#546e7a');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', 'bold');
    text.textContent = room.name;
    svg.appendChild(text);
  });
  
  // Device location mapping
  const deviceLocations = {
    'Living Room': { x: 200, y: 150 },
    'Bedroom': { x: 175, y: 360 },
    'Kitchen': { x: 470, y: 125 },
    'Bathroom': { x: 395, y: 320 },
    'Hallway': { x: 540, y: 360 },
    'Garage': { x: 680, y: 150 },
    'Backyard': { x: 680, y: 360 },
    'Main Entrance': { x: 420, y: 235 }
  };
  
  // Draw devices
  devices.forEach((device, index) => {
    const location = deviceLocations[device.location] || { x: 400, y: 250 };
    
    // Offset multiple devices in same room
    const offset = (index % 3) * 30 - 30;
    const x = location.x + offset;
    const y = location.y;
    
    // Device icon background
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '20');
    circle.setAttribute('fill', device.status === 'online' ? '#4caf50' : '#f44336');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '3');
    circle.setAttribute('class', 'device-marker');
    circle.style.cursor = 'pointer';
    circle.style.transition = 'all 0.3s';
    
    // Add pulse animation for online devices
    if (device.status === 'online') {
      const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animate.setAttribute('attributeName', 'r');
      animate.setAttribute('values', '20;22;20');
      animate.setAttribute('dur', '2s');
      animate.setAttribute('repeatCount', 'indefinite');
      circle.appendChild(animate);
    }
    
    // Device icon (emoji/text)
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    icon.setAttribute('x', x);
    icon.setAttribute('y', y + 6);
    icon.setAttribute('text-anchor', 'middle');
    icon.setAttribute('font-size', '20');
    icon.setAttribute('pointer-events', 'none');
    icon.textContent = getDeviceIcon(device.type);
    
    svg.appendChild(circle);
    svg.appendChild(icon);
    
    // Add hover tooltip
    circle.addEventListener('mouseenter', (e) => {
      showTooltip(device, e);
      circle.setAttribute('r', '24');
    });
    
    circle.addEventListener('mouseleave', () => {
      hideTooltip();
      circle.setAttribute('r', '20');
    });
    
    circle.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeviceDetails(device);
    });
    
    // Right-click for delete option
    circle.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showDeviceContextMenu(device, e);
    });
  });
  
  // Add legend
  addLegend(svg);
}

function getDeviceIcon(type) {
  const icons = {
    '🔊 Audio Sensor': '🔊',
    '📹 Video Camera': '📹',
    '🚶 Motion Sensor': '🚶',
    '🚪 Door Sensor': '🚪',
    '🔥 Smoke Detector': '🔥',
    '💡 Smart Light': '💡'
  };
  return icons[type] || '📡';
}

function showTooltip(device, event) {
  const tooltip = document.getElementById('deviceTooltip');
  if (!tooltip) return;
  
  tooltip.innerHTML = `
    <strong>${device.name}</strong><br>
    ${device.type}<br>
    Status: <span style="color: ${device.status === 'online' ? '#4caf50' : '#f44336'}">${device.status.toUpperCase()}</span><br>
    ${device.lastSeen}
  `;
  
  tooltip.style.display = 'block';
  tooltip.style.left = event.pageX + 10 + 'px';
  tooltip.style.top = event.pageY + 10 + 'px';
}

function hideTooltip() {
  const tooltip = document.getElementById('deviceTooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

function showDeviceDetails(device) {
  // Open device details modal
  if (window.openDeviceModal) {
    window.openDeviceModal(device);
  } else {
    const toast = window.showToast || console.log;
    toast(`📱 ${device.name} | ${device.status} | ${device.location}`, 'info');
  }
}

function showDeviceContextMenu(device, event) {
  // Create context menu
  const existingMenu = document.getElementById('deviceContextMenu');
  if (existingMenu) existingMenu.remove();
  
  const menu = document.createElement('div');
  menu.id = 'deviceContextMenu';
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    min-width: 180px;
  `;
  
  menu.innerHTML = `
    <div style="padding: 8px 0;">
      <button class="context-menu-item" data-action="view" style="width: 100%; padding: 10px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px;">
        👁️ View Details
      </button>
      <button class="context-menu-item" data-action="edit" style="width: 100%; padding: 10px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px;">
        ✏️ Edit Device
      </button>
      <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
      <button class="context-menu-item" data-action="delete" style="width: 100%; padding: 10px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; color: #ef4444;">
        🗑️ Remove Device
      </button>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Add hover effects
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.background = '#f5f5f5';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'none';
    });
    
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      menu.remove();
      
      if (action === 'delete') {
        if (window.removeDevice) {
          window.removeDevice(device);
        }
      } else if (action === 'view') {
        showDeviceDetails(device);
      } else if (action === 'edit') {
        if (window.editDevice) {
          window.editDevice(device);
        }
      }
    });
  });
  
  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    });
  }, 100);
}

function addLegend(svg) {
  const legendY = 470;
  
  // Online indicator
  const onlineCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  onlineCircle.setAttribute('cx', 50);
  onlineCircle.setAttribute('cy', legendY);
  onlineCircle.setAttribute('r', '8');
  onlineCircle.setAttribute('fill', '#4caf50');
  svg.appendChild(onlineCircle);
  
  const onlineText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  onlineText.setAttribute('x', 65);
  onlineText.setAttribute('y', legendY + 4);
  onlineText.setAttribute('font-size', '12');
  onlineText.setAttribute('fill', '#546e7a');
  onlineText.textContent = 'Online';
  svg.appendChild(onlineText);
  
  // Offline indicator
  const offlineCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  offlineCircle.setAttribute('cx', 150);
  offlineCircle.setAttribute('cy', legendY);
  offlineCircle.setAttribute('r', '8');
  offlineCircle.setAttribute('fill', '#f44336');
  svg.appendChild(offlineCircle);
  
  const offlineText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  offlineText.setAttribute('x', 165);
  offlineText.setAttribute('y', legendY + 4);
  offlineText.setAttribute('font-size', '12');
  offlineText.setAttribute('fill', '#546e7a');
  offlineText.textContent = 'Offline';
  svg.appendChild(offlineText);
  
  // Title
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', 400);
  title.setAttribute('y', legendY + 4);
  title.setAttribute('text-anchor', 'middle');
  title.setAttribute('font-size', '14');
  title.setAttribute('font-weight', 'bold');
  title.setAttribute('fill', '#37474f');
  title.textContent = 'Johnson Residence - Floor Plan';
  svg.appendChild(title);
}

export function toggleFloorPlanView() {
  const floorPlan = document.getElementById('floorPlanView');
  const deviceGrid = document.getElementById('deviceGrid');
  const toggleBtn = document.getElementById('toggleView');
  
  if (!floorPlan || !deviceGrid || !toggleBtn) return;
  
  if (floorPlan.style.display === 'none') {
    floorPlan.style.display = 'block';
    deviceGrid.style.display = 'none';
    toggleBtn.textContent = '📋 List View';
  } else {
    floorPlan.style.display = 'none';
    deviceGrid.style.display = 'grid';
    toggleBtn.textContent = '🏠 Map View';
  }
}
