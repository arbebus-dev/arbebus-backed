const API = "https://arbebus-backed.onrender.com/live-buses";

const map = L.map("map").setView([55.7033, 21.1443], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let markers = {};
let busPositions = {};
let selectedBusId = null;

function animateBus(busId, oldPos, newPos, duration = 4000) {
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);

    const lat = oldPos.lat + (newPos.lat - oldPos.lat) * progress;
    const lng = oldPos.lng + (newPos.lng - oldPos.lng) * progress;

    markers[busId].setLatLng([lat, lng]);

    if (busId === selectedBusId) {
      map.setView([lat, lng], map.getZoom(), {
        animate: true,
      });
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

async function loadBuses() {
  
    const res = await fetch(API);
    const data = await res.json();
try {const activeIds = new Set(data.map(b => b.id));
    data.forEach((bus) => {
      const id = bus.id;
      const newPos = {
        lat: bus.latitude,
        lng: bus.longitude,
      };

      if (!markers[id]) {
        const marker = L.marker([newPos.lat, newPos.lng]).addTo(map);

        marker.on("click", () => {
          selectedBusId = id;
          showInfo(bus);
          console.log("Selected bus:", id);
        });

        markers[id] = marker;
        busPositions[id] = newPos;
      } else {
        const oldPos = busPositions[id];

        animateBus(id, oldPos, newPos);
        busPositions[id] = newPos;
Object.keys(markers).forEach(id => {
  if (!activeIds.has(id)) {
    map.removeLayer(markers[id]);
    delete markers[id];
    delete busPositions[id];
  }
});
        if (id === selectedBusId) {
          showInfo(bus);
        }
      }
    });
  } catch (e) {
    console.error(e);
  }
}

function showInfo(bus) {
  const box = document.getElementById("info");

  box.innerHTML = `
    <h3>🚌 Bus ${bus.number}</h3>
    <p>Greitis: ${bus.speed} km/h</p>
    <p>Vėlavimas: ${bus.delaySeconds} s</p>
    <p>Kryptis: ${bus.directionName}</p>
  `;

  box.classList.remove("hidden");
}

map.on("click", () => {
  selectedBusId = null;
});

setInterval(loadBuses, 5000);
loadBuses();