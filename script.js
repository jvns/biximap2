if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/worker.js").then(() => {console.log("Service Worker Registered");});
}

function waitLoaded(map) {
  return new Promise((resolve) => map.on("load", resolve));
}

function iconName(station) {
  let icon_name = "marker";
  const percentage = station.bikes_available /
    (station.bikes_available + station.docks_available);
  /* classify into 0/20/40/50/60/80/100 */
  if (station.bikes_available === 0) {
    icon_name += "-0";
  } else if (station.docks_available === 0) {
    icon_name += "-100";
  } else if (station.docks_available < 3) {
    icon_name += "-80";
  } else if (station.bikes_available < 3) {
    icon_name += "-20";
  } else if (percentage <= 0.4) {
    icon_name += "-40";
  } else if (percentage < 0.6) {
    icon_name += "-50";
  } else {
    icon_name += "-60";
  }
  if (station.ebikes_available >= 3) {
    icon_name += "-many-ebike";
  } else if (station.ebikes_available > 0) {
    icon_name += "-ebike";
  }
  return icon_name;
}

function popupContents(station) {
  return `
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
            </div>`;
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

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

class MapboxMap {
  constructor() {
    this.setup().then(() => this.run());
  }

  async setup() {
    mapboxgl.accessToken = "pk.eyJ1IjoianZucyIsImEiOiJjbGs0M2hiYncwN2U4M2NwZTdkNWU0bXpmIn0.lCiDKbpNKL0qWumE3NZIwA";
    this.markers = {}
    this.map = new mapboxgl.Map({
      container: "map", // container ID
      style: "mapbox://styles/mapbox/streets-v12?optimize=true", // style URL
      center: [-73.588319, 45.514197], // starting position [lng, lat]
      zoom: 13, // starting zoom
    });
    await Promise.all([waitLoaded(this.map), this.fetchStations()])
    /* set up geolocation */
    this.map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        // trackUserLocation: true,
        showUserHeading: true,
      }),
    );
    this.createStations();
  }

  async run() {
    /* update times every 10 seconds, update data every 2 minutes */
    while (true) {
      for (let i = 0; i < 12; i++ ) {
        this.updateStations();
        await sleep(10);
      }
      await this.fetchStations();
    }
  }

  async fetchStations() {
    const response = await fetch(
      "https://layer.bicyclesharing.net/map/v1/mtl/map-inventory",
    );
    this.stations = await response.json();
  }

  createStations() {
    for (const feature of this.stations.features) {
      this.createMarker(feature);
    }
  }

  updateStations() {
    for (const feature of this.stations.features) {
      this.updateMarker(feature);
    }
  }

  updateMarker(feature) {
    const station = feature.properties.station;
    if (!station) {
      return;
    }
    const marker = this.markers[station.id];
    if (!marker) {
      return;
    }
    const el = marker.getElement();
    /* set background image */
    el.style.backgroundImage = `url(./icons/${iconName(station)}.svg)`;
    /* set popup */
    const popup = marker.getPopup();
    popup.setHTML(popupContents(station));
  }

  createMarker(feature) {
    const el = document.createElement("div");
    const station = feature.properties.station;
    if (!station) {
      return;
    }

    const icon_name = iconName(station);
    el.className = `marker-icon`;
    el.style.backgroundImage = `url(/icons/${icon_name}.svg)`;
    // make a marker for each feature and add to the map
    const marker = new mapboxgl.Marker(el).setLngLat(feature.geometry.coordinates).setPopup(
      new mapboxgl.Popup({ offset: 25 }) // add popups
      .setHTML(popupContents(station)),
    )
    marker.addTo(this.map);
    this.markers[station.id] = marker;
    return marker;
  }

}


new MapboxMap();
