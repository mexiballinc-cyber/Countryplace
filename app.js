import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, remove, onChildAdded, onChildChanged, onChildRemoved } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let modoBorrador = false;
let presionando = false;
let navegandoConScroll = false;
let ultimoClickBoton = 0;
let grosorPincel = 4;
let miUsuario = null;
let miColor = "#ef4444";
let miPais = localStorage.getItem("countryplace_mipais") || "Nación Libre";
const mapaBloquesRenderizados = {};

const toggleModal = (id) => document.getElementById(id).classList.toggle("hidden");

function setColor(c) {
    miColor = c;
    if (modoBorrador) activarBorrador();
    const wrapper = document.querySelector(".custom-color-wrapper");
    if (wrapper) wrapper.style.backgroundColor = c;
}

function activarBorrador() {
    modoBorrador = !modoBorrador;
    const btnBorrar = document.getElementById("btn-borrador");
    if (modoBorrador) {
        btnBorrar.classList.add("borrador-activo");
    } else {
        btnBorrar.classList.remove("borrador-activo");
    }
}

function toggleModoPincel() {
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
}

// INICIALIZACIÓN DE EVENTOS
document.addEventListener("DOMContentLoaded", () => {
    const inputPais = document.getElementById("input-nombre-pais");
    if (inputPais) inputPais.value = miPais;

    document.querySelectorAll(".btn-color").forEach(btn => {
        btn.addEventListener("click", () => setColor(btn.dataset.color));
    });

    const picker = document.getElementById("puntero-color");
    picker.addEventListener("input", (e) => setColor(e.target.value));
    picker.addEventListener("click", (e) => setColor(e.target.value));

    document.getElementById("btn-borrador").addEventListener("click", activarBorrador);
    
    document.getElementById("btn-pincel").addEventListener("click", () => {
        const ahora = Date.now();
        if (ahora - ultimoClickBoton < 300) {
            toggleModal('modal-grosor');
        } else {
            toggleModoPincel();
        }
        ultimoClickBoton = ahora;
    });

    document.getElementById("input-grosor").addEventListener("input", (e) => {
        grosorPincel = parseInt(e.target.value);
        document.getElementById("val-grosor").innerText = `${grosorPincel}x${grosorPincel}`;
    });

    document.getElementById("btn-cerrar-grosor").addEventListener("click", () => toggleModal('modal-grosor'));
    document.getElementById("btn-modal-pais").addEventListener("click", () => toggleModal('modal-pais'));
    document.getElementById("btn-guardar-pais").addEventListener("click", () => {
        const val = document.getElementById("input-nombre-pais").value.trim();
        miPais = val || "Nación Libre";
        localStorage.setItem("countryplace_mipais", miPais);
        toggleModal('modal-pais');
    });

    document.getElementById("btn-modal-perfil").addEventListener("click", () => toggleModal('modal-perfil'));
    document.getElementById("btn-cerrar-perfil").addEventListener("click", () => toggleModal('modal-perfil'));
    document.getElementById("btn-cerrar-sesion").addEventListener("click", () => {
        signOut(auth).then(() => toggleModal('modal-perfil'));
    });

    document.getElementById("btn-tema").addEventListener("click", () => {
        const html = document.documentElement;
        const icon = document.getElementById("theme-icon");
        if (html.classList.contains("dark")) {
            html.classList.remove("dark");
            icon.innerHTML = `<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>`;
        } else {
            html.classList.add("dark");
            icon.innerHTML = `<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39.39 1.03 0 1.41s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.02-.39-1.41 0z"/>`;
        }
    });

    document.getElementById("auth-switch-btn").addEventListener("click", () => {
        esModoRegistro = !esModoRegistro;
        document.getElementById("auth-title").innerText = esModoRegistro ? "Crear Cuenta" : "Iniciar Sesión";
        document.getElementById("btn-submit").innerText = esModoRegistro ? "Registrarse" : "Entrar";
        document.getElementById("auth-switch-text").innerText = esModoRegistro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
        document.getElementById("auth-switch-btn").innerText = esModoRegistro ? "Inicia Sesión" : "Crea una aquí";
    });

    document.getElementById("btn-submit").addEventListener("click", () => {
        const e = document.getElementById("auth-email").value.trim();
        const p = document.getElementById("auth-pass").value.trim();
        if (!e || !p) return alert("⚠️ Rellena todos los campos.");

        if (esModoRegistro) {
            createUserWithEmailAndPassword(auth, e, p)
                .then(() => alert("¡Cuenta creada exitosamente!"))
                .catch(err => alert("⚠️ Error al registrar: " + err.message));
        } else {
            signInWithEmailAndPassword(auth, e, p)
                .catch(err => alert("⚠️ Error al entrar: " + err.message));
        }
    });
});

// CONFIGURACIÓN DEL MAPA
const canvasRenderer = L.canvas({ padding: 0.1 });
const map = L.map('map', { 
    zoomControl: false, 
    tap: false,
    preferCanvas: true,
    fadeAnimation: false,
    zoomAnimation: false,
    markerZoomAnimation: false,
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

// PROCESO DE DIBUJO Y BLOQUES
const BLOCK_SIZE = 0.005;

function procesarAccionEnCoordenada(latlng) {
    if (!miUsuario) return;

    const centerLat = Math.floor(latlng.lat / BLOCK_SIZE) * BLOCK_SIZE;
    const centerLng = Math.floor(latlng.lng / BLOCK_SIZE) * BLOCK_SIZE;
    const RADIUS = grosorPincel;

    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dy = -RADIUS; dy <= RADIUS; dy++) {
            const bLat = (centerLat + (dx * BLOCK_SIZE)).toFixed(4);
            const bLng = (centerLng + (dy * BLOCK_SIZE)).toFixed(4);
            
            const blockId = `${bLat}_${bLng}`.replace(/\./g, '_').replace(/-/g, 'm');

            if (modoBorrador) {
                if (mapaBloquesRenderizados[blockId] && mapaBloquesRenderizados[blockId].owner === miUsuario) {
                    remove(ref(db, `mapa/${blockId}`));
                }
            } else {
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
}

// ARRASTRE TÁCTIL SIN BUGS EN MÓVILES
const mapElement = document.getElementById('map');

mapElement.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
        e.preventDefault();
        navegandoConScroll = true;
        map.dragging.enable();
        mapElement.style.cursor = 'grabbing';
    }
});

mapElement.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        navegandoConScroll = false;
        mapElement.style.cursor = 'crosshair';
        if (modoPincel) map.dragging.disable();
    }
});

// CORRECCIÓN TÁCTIL EN PANTALLAS MÓVILES
map.on('mousedown touchstart', (e) => {
    if (!modoPincel || navegandoConScroll) return;
    if (e.originalEvent && e.originalEvent.touches) {
        e.originalEvent.preventDefault();
    }
    presionando = true;
    procesarAccionEnCoordenada(e.latlng);
});

map.on('mousemove touchmove', (e) => {
    if (!modoPincel || !presionando || navegandoConScroll) return;
    if (e.originalEvent && e.originalEvent.touches) {
        e.originalEvent.preventDefault();
    }
    procesarAccionEnCoordenada(e.latlng);
});

map.on('mouseup touchend', () => { presionando = false; });

// TIEMPO REAL
function procesarBloque(snap) {
    const b = snap.val();
    if (!b) return;

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
onChildRemoved(ref(db, 'mapa'), (snap) => {
    const idKey = snap.key;
    if (mapaBloquesRenderizados[idKey]) {
        map.removeLayer(mapaBloquesRenderizados[idKey].rect);
        delete mapaBloquesRenderizados[idKey];
    }
});

function dispararGuerra(enemigo) {
    const banner = document.getElementById("war-banner");
    document.getElementById("war-text").innerText = `¡${enemigo.toUpperCase()} ESTÁ INVADIENDO TU TERRITORIO!`;
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), 3000);
}
