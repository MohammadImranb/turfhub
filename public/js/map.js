// Renders the turf location map on the show page.
// window.mapToken and window.turf are set inline by show.ejs just above this script.
(() => {
  'use strict'

  if (!window.mapboxgl || !window.mapToken || !window.turf) return
  const el = document.getElementById('map')
  if (!el) return

  mapboxgl.accessToken = window.mapToken

  // GeoJSON order: [longitude, latitude]. Mapbox expects the same, so no swapping.
  const coords = window.turf.coordinates

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: coords,
    zoom: 13
  })

  map.addControl(new mapboxgl.NavigationControl(), 'top-right')

  const t = window.turf
  const popup = new mapboxgl.Popup({ offset: 28, closeButton: false }).setHTML(
    // build with textContent-safe escaping rather than raw interpolation
    `<div class="map-popup">
       <strong>${escapeHtml(t.title)}</strong>
       <div>${escapeHtml(t.location)} &middot; ${escapeHtml(t.category)}</div>
       <div>&#8377;${Number(t.price).toLocaleString('en-IN')} / hour</div>
     </div>`
  )

  new mapboxgl.Marker({ color: '#fe424d' })
    .setLngLat(coords)
    .setPopup(popup)
    .addTo(map)

  // Mapbox measures its canvas once at creation. If the container is still being laid
  // out at that moment the canvas sticks at a few pixels wide, so watch the container
  // and tell the map to re-measure whenever its size changes.
  map.on('load', () => map.resize())
  if (window.ResizeObserver) {
    new ResizeObserver(() => map.resize()).observe(el)
  } else {
    window.addEventListener('resize', () => map.resize())
  }

  function escapeHtml(s) {
    const d = document.createElement('div')
    d.textContent = String(s)
    return d.innerHTML
  }
})()
