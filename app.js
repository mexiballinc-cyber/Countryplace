import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDsX0ZDsHnNcQ01ubUm5RDh5uQ3A5u9fO4",
  authDomain: "countryplace.firebaseapp.com",
  databaseURL: "https://countryplace-default-rtdb.firebaseio.com",
  projectId: "countryplace",
  storageBucket: "countryplace.firebasestorage.app",
  messagingSenderId: "414001729987",
  appId: "1:414001729987:web:0481bf461b5b57bbce6d76"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ESTADO GLOBAL
let esModoRegistro = true;
let modoPincel = false;
let presionando = false;
let miUsuario = null;
let miColor = "#3b82f6";
let miPais = localStorage.getItem("countryplace_mipais") || "Nación Libre";
const mapaBloquesRenderizados = {};

document.addEventListener("DOMContentLoaded", () => {
    const inputPais = document.getElementById("input-nombre-pais");
    if (inputPais) inputPais.value = miPais;
});

// MAPA LEAFLET CON CANVAS
const canvasRenderer = L.canvas({ padding: 0.5 });
const map = L.map('map', { 
    zoomControl: false, 
    tap: true,
    preferCanvas: true,
    bounceAtZoomLimits: false
}).setView([19.4326, -99.1332], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    maxZoom: 18,
    updateWhenIdle: true,
    updateWhenZooming: false
}).addTo(map);

// OBSERVADOR DE SESIÓN
onAuthStateChanged(auth, (user) => {
    if (user) {
        miUsuario = user.email;
        document.getElementById("modal-auth").classList.add("hidden");
        document.getElementById("perfil-email").innerText = user.email;
    } else {
        miUsuario = null;
        document.getElementById("modal-auth").classList.remove("hidden");
    }
});

window.toggleModoAuth = () => {
    esModoRegistro = !esModoRegistro;
    document.getElementById("auth-title").innerText = esModoRegistro ? "Crear Cuenta" : "Iniciar Sesión";
    document.getElementById("btn-submit").innerText = esModoRegistro ? "Registrarse" : "Entrar";
    document.getElementById("auth-switch-text").innerText = esModoRegistro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
    document.getElementById("auth-switch-btn").innerText = esModoRegistro ? "Inicia Sesión" : "Crea una aquí";
};

window.ejecutarAuth = () => {
    const e = document.getElementById("auth-email").value.trim();
    const p = document.getElementById("auth-pass").value.trim();

    if (!e || !p) return alert("⚠️ Rellena todos los campos.");

    if (esModoRegistro) {
        createUserWithEmailAndPassword(auth, e, p)
            .then(() => alert("¡Cuenta creada exitosamente! Bienvenido."))
            .catch(err => alert("⚠️ Error al registrar: " + err.message));
    } else {
        signInWithEmailAndPassword(auth, e, p)
            .catch(err => alert("⚠️ Error al entrar: " + err.message));
    }
};

window.cerrarSesion = () => {
    signOut(auth).then(() => {
        window.toggleModal('modal-perfil');
    });
};

// MODO PINCEL (DIBUJO FLUIDO O NAVEGACIÓN)
window.toggleModoPincel = () => {
    modoPincel = !modoPincel;
    const btn = document.getElementById("btn-pincel");

    if (modoPincel) {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        btn.classList.add("pincel-activo");
    } else {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        btn.classList.remove("pincel-activo");
    }
};

// DIBUJAR EN BLOQUES CUADRADOS
const BLOCK_SIZE = 0.005;

function pintarEnCoordenada(latlng) {
    if (!miUsuario) return;

    const centerLat = Math.floor(latlng.lat / BLOCK_SIZE) * BLOCK_SIZE;
    const centerLng = Math.floor(latlng.lng / BLOCK_SIZE) * BLOCK_SIZE;
    const RADIUS = 4;

    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dy = -RADIUS; dy <= RADIUS; dy++) {
            const bLat = (centerLat + (dx * BLOCK_SIZE)).toFixed(4);
            const bLng = (centerLng + (dy * BLOCK_SIZE)).toFixed(4);
            
            const blockId = `${bLat}_${bLng}`.replace(/\./g, '_').replace(/-/g, 'm');

            set(ref(db, `mapa/${blockId}`), {
                lat: parseFloat(bLat),
                lng: parseFloat(bLng),
                country: miPais,
                color: miColor,
                owner: miUsuario
            });
        }
    }
}

// EVENTOS DE DIBUJO AL ARRASTRAR O TOCAR
map.on('mousedown touchstart', (e) => {
    if (!modoPincel) return;
    presionando = true;
    pintarEnCoordenada(e.latlng);
});

map.on('mousemove touchmove', (e) => {
    if (!modoPincel || !presionando) return;
    pintarEnCoordenada(e.latlng);
});

map.on('mouseup touchend', () => {
    presionando = false;
});

// ESCUCHAR MAPA EN TIEMPO REAL
function procesarBloque(snap) {
    const b = snap.val();
    const idKey = snap.key;
    const bounds = [[b.lat, b.lng], [b.lat + BLOCK_SIZE, b.lng + BLOCK_SIZE]];

    if (mapaBloquesRenderizados[idKey]) {
        const previo = mapaBloquesRenderizados[idKey].owner;
        if (previo === miUsuario && b.owner !== miUsuario) {
            dispararGuerra(b.country);
        }
        mapaBloquesRenderizados[idKey].rect.setStyle({ color: b.color, fillColor: b.color });
        mapaBloquesRenderizados[idKey].owner = b.owner;
        mapaBloquesRenderizados[idKey].rect.setTooltipContent(`<b>${b.country}</b>`);
    } else {
        const rect = L.rectangle(bounds, { 
            color: b.color, 
            weight: 0.5, 
            fillOpacity: 0.65,
            renderer: canvasRenderer
        }).addTo(map);
        rect.bindTooltip(`<b>${b.country}</b>`, { sticky: true });
        mapaBloquesRenderizados[idKey] = { rect, owner: b.owner };
    }
}

onChildAdded(ref(db, 'mapa'), procesarBloque);
onChildChanged(ref(db, 'mapa'), procesarBloque);

// TEMA Y UTILIDADES
window.toggleTema = () => {
    const html = document.documentElement;
    const icon = document.getElementById("theme-icon");
    
    if (html.classList.contains("dark")) {
        html.classList.remove("dark");
        icon.innerText = "🌙";
    } else {
        html.classList.add("dark");
        icon.innerText = "☀️";
    }
};

window.setColor = (c) => miColor = c;
window.guardarPais = () => {
    const valor = document.getElementById("input-nombre-pais").value.trim();
    miPais = valor || "Nación Libre";
    localStorage.setItem("countryplace_mipais", miPais);
    window.toggleModal('modal-pais');
};
window.toggleModal = (id) => document.getElementById(id).classList.toggle("hidden");

function dispararGuerra(enemigo) {
    const banner = document.getElementById("war-banner");
    document.getElementById("war-text").innerText = `¡${enemigo.toUpperCase()} ESTÁ INVADIENDO TU TERRITORIO!`;
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), 3000);
}
