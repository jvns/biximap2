mapboxgl.accessToken =
  "pk.eyJ1IjoianZucyIsImEiOiJjbGs0M2hiYncwN2U4M2NwZTdkNWU0bXpmIn0.lCiDKbpNKL0qWumE3NZIwA";
const map = new mapboxgl.Map({
  container: "map", // container ID
  style: "mapbox://styles/mapbox/streets-v12", // style URL
  center: [-73.588319, 45.514197], // starting position [lng, lat]
  zoom: 13, // starting zoom
});

map.on("load", setup);
// start loading inventory asap
const inventory = fetch(
  "https://layer.bicyclesharing.net/map/v1/mtl/map-inventory",
);

function setup() {
  geolocate();
  addStations();
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

async function addStations() {
  const response = await inventory;
  const geojson = await response.json();
  for (const feature of geojson.features) {
    // create a HTML element for each feature
    const el = document.createElement("div");
    const station = feature.properties.station;
    if (!station) {
      continue;
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
          `<h3>${station.name}</h3><p>
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
    /* close popup on escape */
  }
}
