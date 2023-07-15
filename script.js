mapboxgl.accessToken =
  "pk.eyJ1IjoianZucyIsImEiOiJjbGs0M2hiYncwN2U4M2NwZTdkNWU0bXpmIn0.lCiDKbpNKL0qWumE3NZIwA";
const map = new mapboxgl.Map({
  container: "map", // container ID
  style: "mapbox://styles/mapbox/streets-v12", // style URL
  center: [-73.588319, 45.514197], // starting position [lng, lat]
  zoom: 13, // starting zoom
});

map.on("load", setup);

function setup() {
  geolocate();
  update();
}

function geolocate() {
  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      // When active the map will receive updates to the device's location as it changes.
      // trackUserLocation: true,
      // Draw an arrow next to the location dot to indicate which direction the device is heading.
      showUserHeading: true,
    }),
  );
}

function createMarker(feature) {
  const el = document.createElement("div");
  const station = feature.properties.station;
  if (!station) {
    return;
  }
  el.className = "marker";
  if (station.bikes_available === 0) {
    el.className += " marker-empty marker-problem";
  } else if (station.docks_available === 0) {
    el.className += " marker-full marker-problem";
  } else if (station.bikes_available <= 3) {
    el.className += " marker-low marker-warning";
  } else if (station.docks_available <= 3) {
    el.className += " marker-docks-low marker-warning";
  }
  if (station.ebikes_available > 0) {
    el.className += " marker-ebike";
  }
  if (station.ebikes_available >= 3) {
    el.className += " marker-many-ebikes";
  }

  // make a marker for each feature and add to the map
  new mapboxgl.Marker(el).setLngLat(feature.geometry.coordinates).setPopup(
    new mapboxgl.Popup({ offset: 25 }) // add popups
      .setHTML(
        `
        <div class="time">${formatTime(station.last_reported)}</div>
        <h3>${station.name}</h3><p>
            <div class="info">
               <div class="info__item">
                  <div class="num"> ${station.bikes_available} </div>
                  <div class="desc"> Bikes </div>
               </div>
                <div class="info__item">
                    <div class="num"> ${station.docks_available} </div>
                    <div class="desc"> Docks </div>
                </div>
                <div class="info__item">
                    <div class="num"> ${station.ebikes_available || 0} </div>
                    <div class="desc"> Ebikes </div>
                </div>
            </div>

            `,
      ),
  ).addTo(map);
}

function formatTime(utc_timestamp) {
  /* format in a nice way, like x seconds/minutes ago */
  const now = new Date();
  const timestamp = new Date(utc_timestamp * 1000);
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes == 1) {
    return "1 minute ago";
  } else if (minutes < 1) {
    return `${seconds} seconds ago`;
  }
  return `${minutes} minutes ago`;
}

function addStations(geojson) {
  /* delete all markers */
  document.querySelectorAll(".marker").forEach((marker) => marker.remove());
  for (const feature of geojson.features) {
    createMarker(feature);
  }
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function update() {
  setTimeout(update, 120 * 1000); /* run every 2 minutes */

  console.log("refreshing...");
  const response = await fetch(
    "https://layer.bicyclesharing.net/map/v1/mtl/map-inventory",
  );
  const geojson = await response.json();
  addStations(geojson);
  /* every 10 seconds for 2 minutes, refresh the data */
  for (let i = 0; i < 12; i++) {
    await sleep(10);
    addStations(geojson);
  }
}
