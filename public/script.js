"use strict";

// RescueGrid frontend communicates with the Express REST API.
const API = "/api";
let incidents = [];
let ambulances = [];
let hospitals = [];
let selectedRouteLine = null;
let rescueMap = null;

const roadGraph = {
  A: [{ node: "B", distance: 4 }, { node: "C", distance: 2 }],
  B: [{ node: "A", distance: 4 }, { node: "C", distance: 1 }, { node: "D", distance: 5 }, { node: "E", distance: 10 }],
  C: [{ node: "A", distance: 2 }, { node: "B", distance: 1 }, { node: "D", distance: 8 }],
  D: [{ node: "B", distance: 5 }, { node: "C", distance: 8 }, { node: "E", distance: 2 }],
  E: [{ node: "D", distance: 2 }, { node: "B", distance: 10 }]
};

const locations = [
  { name: "Location A", node: "A", lat: 18.5204, lng: 73.8567 },
  { name: "Location B", node: "B", lat: 18.5300, lng: 73.8700 },
  { name: "Location C", node: "C", lat: 18.5100, lng: 73.8400 },
  { name: "Location D", node: "D", lat: 18.5400, lng: 73.8500 },
  { name: "Location E", node: "E", lat: 18.5000, lng: 73.8600 }
];

function el(id) { return document.getElementById(id); }
function activeIncidents() { return incidents.filter(item => item.status === "Active"); }
function availableAmbulances() { return ambulances.filter(item => item.available); }
function incidentLabel(item) { return `${item.name} (Incident ${item.id})`; }
function locationLabel(node) { return `Location ${node}`; }

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

function setMessage(id, message, isError = false) {
  const node = el(id);
  node.textContent = message;
  node.classList.toggle("error-message", isError);
}

async function loadData() {
  try {
    const [incidentData, ambulanceData, hospitalData] = await Promise.all([
      apiRequest("/incidents"), apiRequest("/ambulances"), apiRequest("/hospitals")
    ]);
    incidents = incidentData;
    ambulances = ambulanceData;
    hospitals = hospitalData;
    el("connectionStatus").textContent = "● Backend connected";
    el("connectionStatus").classList.add("online");
    updateDashboard();
    if (!rescueMap) initializeMap();
  } catch (error) {
    el("connectionStatus").textContent = "● Backend connection failed";
    el("connectionStatus").classList.add("offline");
    setMessage("assignmentResult", `${error.message} Start the backend using npm start.`, true);
    console.error(error);
  }
}

function updateDashboard() {
  el("incidentCount").textContent = incidents.length;
  el("ambulanceCount").textContent = availableAmbulances().length;
  el("hospitalCount").textContent = hospitals.length;
  renderIncidentOverview();
  renderManagedIncidents();
  updateIncidentDropdown();
  updateAmbulanceDropdown();
  updateHospitalDropdown();
}

function renderIncidentOverview() {
  const container = el("incidentList");
  container.replaceChildren();
  if (!incidents.length) {
    container.textContent = "No emergency incidents to display.";
    return;
  }
  incidents.forEach(item => {
    const card = document.createElement("div");
    card.className = "incident";
    const heading = document.createElement("strong");
    heading.textContent = item.name;
    const details = document.createElement("p");
    details.textContent = `${locationLabel(item.location)} | Priority: ${item.priority} | Status: ${item.status}`;
    card.append(heading, details);
    if (item.assignedAmbulance) {
      const assignment = document.createElement("p");
      assignment.textContent = `Ambulance: ${item.assignedAmbulance} | Hospital: ${item.assignedHospital}`;
      card.appendChild(assignment);
    }
    container.appendChild(card);
  });
}

function renderManagedIncidents() {
  const list = el("managedIncidentList");
  list.replaceChildren();
  if (!incidents.length) {
    const item = document.createElement("li");
    item.textContent = "No incidents added yet.";
    list.appendChild(item);
    return;
  }
  incidents.forEach(incident => {
    const item = document.createElement("li");
    const details = document.createElement("span");
    details.textContent = `${incident.name} | ${locationLabel(incident.location)} | ${incident.priority} Priority | ${incident.status}`;
    item.appendChild(details);
    if (incident.status === "Active") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Complete";
      button.addEventListener("click", () => completeIncident(incident.id));
      item.appendChild(document.createTextNode(" "));
      item.appendChild(button);
    }
    list.appendChild(item);
  });
}

function fillSelect(id, items, valueFn, labelFn, emptyLabel) {
  const select = el(id);
  const previous = select.value;
  select.replaceChildren();
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = String(valueFn(item));
    option.textContent = labelFn(item);
    select.appendChild(option);
  });
  if (!items.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    select.appendChild(option);
  } else if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }
}
function updateIncidentDropdown() {
  fillSelect("resourceEmergency", activeIncidents(), item => item.id, incidentLabel, "No active incidents");
}
function updateAmbulanceDropdown() {
  fillSelect("ambulance", availableAmbulances(), item => item.id, item => `${item.name} (Available)`, "No available ambulances");
}
function updateHospitalDropdown() {
  fillSelect("hospital", hospitals, item => item.id, item => item.name, "No hospitals available");
}

async function addIncident() {
  const input = el("newIncident");
  const name = input.value.trim();
  if (!name) {
    alert("Please enter incident details.");
    input.focus();
    return;
  }
  try {
    const severity = el("severity").value;
    const created = await apiRequest("/incidents", {
      method: "POST",
      body: JSON.stringify({
        name,
        location: el("startLocation").value,
        priority: severity.charAt(0).toUpperCase() + severity.slice(1)
      })
    });
    incidents.push(created);
    input.value = "";
    updateDashboard();
    setMessage("assignmentResult", `Incident added successfully: ${incidentLabel(created)}`);
  } catch (error) {
    setMessage("assignmentResult", error.message, true);
  }
}

async function completeIncident(id) {
  try {
    const updated = await apiRequest(`/incidents/${id}/complete`, { method: "PATCH" });
    incidents = incidents.map(item => item.id === id ? updated : item);
    await refreshResources();
    updateDashboard();
  } catch (error) {
    setMessage("assignmentResult", error.message, true);
  }
}

async function refreshResources() {
  [ambulances, hospitals] = await Promise.all([
    apiRequest("/ambulances"), apiRequest("/hospitals")
  ]);
}

function classifyEmergency() {
  const type = el("emergencyType").value;
  const severity = el("severity").value;
  setMessage("priorityResult", `Emergency: ${type.toUpperCase().replace("-", " ")} | Classification: ${severity.toUpperCase()} PRIORITY`);
}

async function assignResources() {
  const incidentId = Number(el("resourceEmergency").value);
  const ambulanceId = Number(el("ambulance").value);
  const hospitalId = Number(el("hospital").value);
  if (!incidentId || !ambulanceId || !hospitalId) {
    setMessage("assignmentResult", "Please select an active incident, available ambulance and hospital.", true);
    return;
  }
  try {
    const result = await apiRequest("/assignments", {
      method: "POST",
      body: JSON.stringify({ incidentId, ambulanceId, hospitalId })
    });
    setMessage("assignmentResult", result.message);
    await loadData();
  } catch (error) {
    setMessage("assignmentResult", error.message, true);
  }
}

function dijkstra(graph, start, destination) {
  if (!graph[start] || !graph[destination]) return { distance: Infinity, path: [] };
  const distances = {}, previous = {}, visited = new Set(), nodes = Object.keys(graph);
  nodes.forEach(node => { distances[node] = Infinity; previous[node] = null; });
  distances[start] = 0;
  while (true) {
    let current = null, smallest = Infinity;
    for (const node of nodes) {
      if (!visited.has(node) && distances[node] < smallest) {
        smallest = distances[node]; current = node;
      }
    }
    if (current === null || current === destination) break;
    visited.add(current);
    for (const edge of graph[current]) {
      if (visited.has(edge.node)) continue;
      const nextDistance = distances[current] + edge.distance;
      if (nextDistance < distances[edge.node]) {
        distances[edge.node] = nextDistance;
        previous[edge.node] = current;
      }
    }
  }
  if (distances[destination] === Infinity) return { distance: Infinity, path: [] };
  const path = [];
  let current = destination;
  while (current !== null) { path.unshift(current); current = previous[current]; }
  return { distance: distances[destination], path };
}

function initializeMap() {
  if (typeof L === "undefined") {
    setMessage("routeResult", "Map library unavailable. Route calculation still works.", true);
    return;
  }
  rescueMap = L.map("rescueMap").setView([18.5204, 73.8567], 13);
  L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors", maxZoom: 19
  }).addTo(rescueMap);
  locations.forEach(location => {
    L.marker([location.lat, location.lng]).addTo(rescueMap)
      .bindPopup(`<b>${location.name}</b><br>Demo road-network location`);
  });
  hospitals.forEach((hospital, index) => {
    const coords = index === 0 ? [18.5250, 73.8450] : [18.5150, 73.8750];
    L.marker(coords).addTo(rescueMap).bindPopup(`<b>${hospital.name}</b><br>Sample hospital`);
  });
}

function calculateRoute() {
  const start = el("startLocation").value;
  const destination = el("endLocation").value;
  if (start === destination) {
    setMessage("routeResult", "Start and destination must be different.", true);
    return;
  }
  const result = dijkstra(roadGraph, start, destination);
  if (!result.path.length) {
    setMessage("routeResult", "No route available.", true);
    return;
  }
  setMessage("routeResult", `Shortest Route: ${result.path.join(" -> ")} | Total Distance: ${result.distance} km`);
  if (rescueMap) {
    if (selectedRouteLine) rescueMap.removeLayer(selectedRouteLine);
    const coordinates = result.path.map(node => {
      const point = locations.find(item => item.node === node);
      return [point.lat, point.lng];
    });
    selectedRouteLine = L.polyline(coordinates, { color: "red", weight: 5, opacity: 0.85 }).addTo(rescueMap);
    rescueMap.fitBounds(selectedRouteLine.getBounds(), { padding: [25, 25] });
  }
}

el("routeButton").addEventListener("click", calculateRoute);
el("priorityButton").addEventListener("click", classifyEmergency);
el("assignButton").addEventListener("click", assignResources);
el("addIncidentButton").addEventListener("click", addIncident);
el("newIncident").addEventListener("keydown", event => {
  if (event.key === "Enter") addIncident();
});

loadData();
