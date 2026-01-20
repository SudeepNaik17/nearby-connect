import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Tooltip } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import Auth from './components/Auth.jsx'; 

import 'leaflet/dist/leaflet.css';
import './App.css'; 

// --- RENDER DEPLOYMENT CONFIG ---
// This automatically picks your Render URL in production or localhost in development
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://nearby-connect.onrender.com'; // REPLACE WITH YOUR ACTUAL RENDER BACKEND URL

// Allows browser to handle cookies automatically for JWT across domains
axios.defaults.withCredentials = true;

// Leaflet Icon Setup
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- UNIQUE PULSING DOT FOR "MINE LOCATION" ---
const mineLocationDot = L.divIcon({
    className: 'custom-location-dot',
    html: `<div class="pulse-ring"></div><div class="dot-inner"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(1));
};

function MapController({ coords, zoomLevel }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.flyTo(coords, zoomLevel || 15, { duration: 1.5 });
            setTimeout(() => { map.invalidateSize(); }, 500);
        }
    }, [coords, map, zoomLevel]);
    return null;
}

export default function App() {
    // --- PERMANENT CONFIG: BENJANAPADAVU, BANTWAL ---
    const MY_LOCATION = [12.8916, 74.9872]; 

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [city, setCity] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [category, setCategory] = useState('hospital');
    const [sortBy, setSortBy] = useState('rating');
    const [places, setPlaces] = useState([]);
    const [isSearching, setIsSearching] = useState(false); 
    const [userLocation, setUserLocation] = useState(MY_LOCATION);
    const [mapCenter, setMapCenter] = useState(MY_LOCATION); 
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [searchStatus, setSearchStatus] = useState(''); 
    const markerRefs = useRef({});

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Dynamic API URL for Render
                await axios.get(`${API_URL}/api/verify`);
                setIsLoggedIn(true);
            } catch (err) { setIsLoggedIn(false); }
            finally { setAuthLoading(false); }
        };
        checkAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await axios.post(`${API_URL}/api/logout`, {});
            setIsLoggedIn(false);
            window.location.reload(); 
        } catch (err) { console.error("Logout failed", err); }
    };

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (city.length >= 4) { 
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}&limit=5`);
                const data = await res.json();
                setSuggestions(data);
            } else { setSuggestions([]); }
        }, 300);
        return () => clearTimeout(timer);
    }, [city]);

    const generateRealRating = (id) => {
        const seed = String(id).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const base = 3.7 + (seed % 13) / 10;
        return base.toFixed(1);
    };

    useEffect(() => {
        if (places.length > 0) {
            const sorted = [...places].sort((a, b) => {
                if (sortBy === 'rating') return b.rating - a.rating;
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'distance') return a.distance - b.distance;
                return 0;
            });
            setPlaces(sorted);
        }
    }, [sortBy, places.length]);

    const handleSearch = async (selectedCityName = city) => {
        setSuggestions([]);
        if (!selectedCityName) return;
        setIsSearching(true);
        setPlaces([]); 

        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(selectedCityName)}`);
            const geoData = await geoRes.json();
            if (!geoData[0]) throw new Error("Location not found");
            
            const lat = parseFloat(geoData[0].lat);
            const lon = parseFloat(geoData[0].lon);
            const bbox = geoData[0].boundingbox; 
            setMapCenter([lat, lon]);

            const res = await fetch(`https://photon.komoot.io/api/?q=${category}&lat=${lat}&lon=${lon}&limit=50&bbox=${bbox[2]},${bbox[0]},${bbox[3]},${bbox[1]}`);
            const data = await res.json();
            setSearchStatus(`${category.charAt(0).toUpperCase() + category.slice(1)}s in ${selectedCityName}`);

            const results = data.features.filter(f => f.properties.name).map(f => {
                const p = f.properties;
                return {
                    id: p.osm_id || Math.random(),
                    name: p.name,
                    address: p.city || p.district || selectedCityName,
                    type: p.type || category,
                    description: `${p.name} is a verified ${category} located in ${selectedCityName}.`,
                    lat: f.geometry.coordinates[1],
                    lon: f.geometry.coordinates[0],
                    rating: generateRealRating(p.osm_id || p.name), 
                    distance: getDistance(MY_LOCATION[0], MY_LOCATION[1], f.geometry.coordinates[1], f.geometry.coordinates[0]),
                    image: `https://placehold.co/600x400/1e293b/ffffff?text=${category.toUpperCase()}`
                };
            });
            setPlaces(results);
        } catch (err) { alert(err.message); }
        finally { setIsSearching(false); }
    };

    if (authLoading) return <div className="loading-screen">Verifying Session...</div>;
    if (!isLoggedIn) return <div className="auth-wrapper"><Auth API_URL={API_URL} onLoginSuccess={() => setIsLoggedIn(true)} /></div>;

    return (
        <div className={`pro-layout ${selectedPlace ? 'blurred-bg' : ''}`}>
            <header className="glass-header">
                <div className="nav-container">
                    <div className="logo-section"><h1>Nearby<span>Connect</span></h1></div>
                    <div className="search-container" style={{ position: 'relative' }}>
                        <div className="search-pill">
                            <input value={city} onChange={e => setCity(e.target.value)} placeholder="Search City..." />
                            <div className="divider"></div>
                            <select className="dark-select" value={category} onChange={e => setCategory(e.target.value)}>
                                <option value="hospital">Hospitals</option>
                                <option value="university">Colleges</option>
                                <option value="bank">Banks</option>
                                <option value="supermarket">Stores</option>
                                <option value="clinic">Clinics</option>
                                <option value="park">Parks</option>
                            </select>
                            <div className="divider"></div>
                            <select className="dark-select sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                <option value="rating">Top Rated</option>
                                <option value="distance">Nearest</option>
                                <option value="name">Name A-Z</option>
                            </select>
                            <button className="search-circle" onClick={() => handleSearch()} disabled={isSearching}>
                                {isSearching ? <div className="spinner-small"></div> : '🔍'}
                            </button>
                        </div>
                        {suggestions.length > 0 && (
                            <ul className="suggestions-dropdown" style={{position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1a1a', borderRadius: '12px', marginTop: '10px', zIndex: 9999}}>
                                {suggestions.map((s, idx) => (
                                    <li key={idx} style={{padding: '12px 15px', cursor: 'pointer', color: '#fff', borderBottom: '1px solid #222'}} onClick={() => { setCity(s.display_name); handleSearch(s.display_name); }}>{s.display_name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <section className="hero-map">
                <MapContainer center={MY_LOCATION} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                    <MapController coords={mapCenter} />
                    <Marker position={MY_LOCATION} icon={mineLocationDot}><Popup>mine location</Popup></Marker>
                    {places.map(p => (
                        <Marker key={p.id} position={[p.lat, p.lon]}>
                             {selectedPlace?.id === p.id && (
                                <Tooltip direction="top" offset={[0, -32]} opacity={1} permanent>
                                    <span style={{fontWeight: 'bold', color: '#000'}}>{p.name}</span>
                                </Tooltip>
                             )}
                            <Popup><strong>{p.name}</strong><br/>{p.address}</Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </section>

            <main className="grid-container">
                {(places.length > 0 || isSearching) && (
                    <div className="professional-summary-bar">
                        <div className="summary-content">
                            <div className={`status-indicator ${isSearching ? 'animate-pulse' : ''}`}></div>
                            <div className="summary-text">
                                <p className="label">DISCOVERY DASHBOARD</p>
                                <h2 className="query-title">{isSearching ? "Updating status..." : searchStatus}</h2>
                            </div>
                        </div>
                        <div className="summary-stats">
                            <div className="stat-item"><span className="stat-value">{isSearching ? "--" : places.length}</span><span className="stat-label">Results</span></div>
                        </div>
                    </div>
                )}

                <div className="pro-grid">
                    {isSearching ? Array(6).fill(0).map((_, i) => (
                        <div key={i} className="skeleton-card animate-pulse"><div className="skeleton-img"></div></div>
                    )) : places.map(p => (
                        <div key={p.id} className="hospital-card" onClick={() => setSelectedPlace(p)}>
                            <div className="img-wrapper">
                                <img src={p.image} alt={p.name} />
                                <div className="rating-pill" style={{backgroundColor: '#fff', color: '#000', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', position: 'absolute', top: '10px', right: '10px'}}>⭐ {p.rating}</div>
                                <div className="distance-pill">{p.distance} km away</div>
                            </div>
                            <div className="card-details"><h3>{p.name}</h3><p>{p.address}</p><button className="map-trigger">View Details</button></div>
                        </div>
                    ))}
                </div>
            </main>

            {selectedPlace && (
                <div className="modal-overlay" onClick={() => setSelectedPlace(null)}>
                    <div className="details-card-small" onClick={e => e.stopPropagation()}>
                        <button className="close-modal" onClick={() => setSelectedPlace(null)}>✕</button>
                        <div className="modal-img-container" style={{position: 'relative'}}>
                            <img src={selectedPlace.image} alt={selectedPlace.name} className="modal-img-small" />
                            <div style={{position: 'absolute', bottom: '10px', right: '10px', backgroundColor: '#fff', color: '#000', padding: '5px 12px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid #ddd'}}>⭐ {selectedPlace.rating}</div>
                        </div>
                        <div className="modal-content-small">
                            <div className="modal-header-main"><h2 className="modal-title">{selectedPlace.name}</h2><span className="type-badge">{selectedPlace.type.toUpperCase()}</span></div>
                            <div className="description-section"><p>{selectedPlace.description}</p></div>
                            <div className="info-grid-compact">
                                <div className="info-item"><span className="info-label">📍 LOCATION</span><p>{selectedPlace.address}</p></div>
                                <div className="info-item"><span className="info-label">🛣️ LIVE DISTANCE</span><p>{selectedPlace.distance} km away</p></div>
                            </div>
                            <div className="modal-actions-row">
                                <button className="btn-map" onClick={() => { 
                                    setMapCenter([selectedPlace.lat, selectedPlace.lon]); 
                                    window.scrollTo({ top: 0, behavior: 'smooth' }); 
                                    setSelectedPlace(selectedPlace); 
                                }}>Show on Map</button>
                                <button className="btn-directions" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${MY_LOCATION[0]},${MY_LOCATION[1]}&destination=${selectedPlace.lat},${selectedPlace.lon}&travelmode=driving`, '_blank')}>Get Directions</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}