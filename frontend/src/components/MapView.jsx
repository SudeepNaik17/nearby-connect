import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function Recenter({ coords }) {
  const map = useMap();
  map.setView(coords, 13);
  return null;
}

export default function MapView() {
  const [city, setCity] = useState('');
  const [type, setType] = useState('hospital');
  const [places, setPlaces] = useState([]);
  const [pos, setPos] = useState([12.91, 74.85]); // Default Mangalore

  const handleSearch = async () => {
    // 1. Get City Lat/Lon
    const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
    const geoData = await geo.json();
    if (!geoData[0]) return alert("City not found");
    const { lat, lon } = geoData[0];
    setPos([lat, lon]);

    // 2. Get Places & Sort
    const overpass = `https://overpass-api.de/api/interpreter?data=[out:json];node["amenity"="${type}"](around:5000,${lat},${lon});out;`;
    const res = await fetch(overpass);
    const data = await res.json();
    
    // Add fake ratings for sorting
    const sorted = data.elements.map(p => ({
      ...p, rating: (Math.random() * 2 + 3).toFixed(1)
    })).sort((a, b) => b.rating - a.rating);
    
    setPlaces(sorted);
  };

  return (
    <div className="map-section">
      <div className="search-bar">
        <input placeholder="City Name" onChange={e => setCity(e.target.value)} />
        <select onChange={e => setType(e.target.value)}>
          <option value="hospital">Hospitals</option>
          <option value="pharmacy">Medical/Pharmacy</option>
        </select>
        <button onClick={handleSearch}>Find & Sort</button>
      </div>
      <MapContainer center={pos} zoom={13} style={{ height: '70vh', width: '90%', margin: 'auto' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter coords={pos} />
        {places.map(p => (
          <Marker key={p.id} position={[p.lat, p.lon]}>
            <Popup>{p.tags.name || "Place"} <br/> Rating: ⭐ {p.rating}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}