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

function popupContents(station, updated) {
  return `
        <div class="time">${formatTime(updated)}</div>
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
  const timestamp = new Date(utc_timestamp);
  const diff = now - timestamp;
  /* +15 is a lie, the cache actually fetches every 30 seconds */
  const seconds = Math.floor(diff / 1000) + 15;
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
    this.stations = JSON.parse(localStorage.getItem("stations")) || undefined;
    this.setup().then(() => this.run());
  }

  async setup() {
    mapboxgl.accessToken = "pk.eyJ1IjoianZucyIsImEiOiJjbGs0M2hiYncwN2U4M2NwZTdkNWU0bXpmIn0.lCiDKbpNKL0qWumE3NZIwA";
    this.markers = {}
    /* restore latlng from local storage */
    const state = this.getMapState();

    this.map = new mapboxgl.Map({
      container: "map", // container ID
      style: "mapbox://styles/mapbox/streets-v12?optimize=true", // style URL
      // starting position / zoom
      center: state.center || [-73.588319, 45.514197],
      zoom: state.zoom || 13,
      bearing: state.bearing || 0,
    });
    /* no "poi-label" layer */
    this.map.on("style.load", () => {
      this.map.removeLayer("poi-label");
    })

    await waitLoaded(this.map);
    this.fetchLanes();
    if (this.stations) {
      this.createStations();
      await this.fetchStations();
    } else {
      await this.fetchStations();
      this.createStations();
    }

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
    this.map.addControl(new mapboxgl.NavigationControl());
    /* save state when map is moved */
    this.map.on("moveend", () => this.saveMapState());
    this.map.on("zoomend", () => this.saveMapState());
    this.map.on("rotateend", () => this.saveMapState());
  }


  saveMapState() {
    const state = {
      "center": this.map.getCenter(),
      "zoom": this.map.getZoom(),
      "bearing": this.map.getBearing(),
    };
    localStorage.setItem("map_state", JSON.stringify(state));
  }

  getMapState() {
    const state = JSON.parse(localStorage.getItem("map_state"));
    return state || {}
  }

  async run() {
    /* update times every 10 seconds, update data every minute */
    while (true) {
      for (let i = 0; i < 6; i++ ) {
        this.updateStations();
        await sleep(10);
      }
      await this.fetchStations();
    }
  }

  async fetchLanes() {
    const response = await fetch("https://hub.bicyclesharing.net/map/v1/mtl/bike-lanes");
    this.lanes = await response.json();
    this.map.addSource("lanes", {
      type: "geojson",
      data: this.lanes,
    });
    /* options: bicycle friendly / dedicated / protected */
    this.map.addLayer({
      id: "lanes",
      type: "line",
      source: "lanes",
      paint: {
        "line-color": [
          "match",
          ["get", "lane_type"],
          "protected",
          "#1f961f",
          "#3fa53f",
        ],
        "line-width": [
          "match",
          ["get", "lane_type"],
          "protected",
          3,
          2,
        ],
        "line-dasharray": [
          "match",
          ["get", "lane_type"],
          "bicycle_friendly",
          ["literal", [2,1]],
          ["literal", [1]],
        ],
      },
    });
  }

  async fetchStations() {
    const response = await fetch(
      "https://bixicache.jvns.ca",
    );
    this.stations = await response.json();
    this.stations.updated = new Date().getTime();
    // save stations to local storage
    localStorage.setItem("stations", JSON.stringify(this.stations));
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
    popup.setHTML(popupContents(station, this.stations.updated));
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
