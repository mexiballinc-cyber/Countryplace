import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://countryplace-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ESTADO GLOBAL
let esModoRegistro = false;
let miUsuario = null;
let miColor = "#3b82f6";
let miPais = "Nación Libre";
const mapaBloquesRenderizados = {};

// MAPA LEAFLET
const map = L.map('map', { zoomControl: false, tap: true }).setView([19.4326, -99.1332], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

// OBSERVADOR DE SESIÓN OFICIAL DE FIREBASE AUTH
onAuthStateChanged(auth, (user) => {
    if (user) {
        miUsuario = user;
        document.getElementById("modal-auth").classList.add("hidden");
        document.getElementById("perfil-email").innerText = user.email;
    } else {
        miUsuario = null;
        document.getElementById("modal-auth").classList.remove("hidden");
    }
});

// CAMBIAR ENTRE INICIAR SESIÓN Y CREAR CUENTA
window.toggleModoAuth = () => {
    esModoRegistro = !esModoRegistro;
    const title = document.getElementById("auth-title");
    const btn = document.getElementById("btn-submit");
    const switchText = document.getElementById("auth-switch-text");
    const switchBtn = document.getElementById("auth-switch-btn");

    if (esModoRegistro) {
        title.innerText = "Crear Cuenta";
        btn.innerText = "Registrarse";
        switchText.innerText = "¿Ya tienes cuenta?";
        switchBtn.innerText = "Inicia Sesión";
    } else {
        title.innerText = "Iniciar Sesión";
        btn.innerText = "Entrar";
        switchText.innerText = "¿No tienes cuenta?";
        switchBtn.innerText = "Crea una aquí";
    }
};

// EJECUTAR AUTENTICACIÓN (LOGIN O REGISTRO)
window.ejecutarAuth = () => {
    const e = document.getElementById("auth-email").value.trim();
    const p = document.getElementById("auth-pass").value.trim();

    if (!e || !p) return alert("⚠️ Rellena todos los campos.");

    if (esModoRegistro) {
        if (p.length < 6) return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");

        createUserWithEmailAndPassword(auth, e, p)
            .then(() => alert("¡Cuenta creada exitosamente! Bienvenido."))
            .catch(err => {
                if (err.code === "auth/email-already-in-use") {
                    alert("⚠️ Este correo ya existe. Cambia a 'Iniciar Sesión'.");
                } else {
                    alert("Error al registrar: " + err.message);
                }
            });
    } else {
        signInWithEmailAndPassword(auth, e, p)
            .catch(err => alert("Error al entrar: " + err.message));
    }
};

window.cerrarSesion = () => {
    signOut(auth).then(() => {
        window.toggleModal('modal-perfil');
    });
};

// PINTAR / CONQUISTAR (CLAVE ÚNICA PARA OPTIMIZAR LA BASE DE DATOS)
const BLOCK_SIZE = 0.005;

map.on('click', (e) => {
    if (!miUsuario) return;

    const centerLat = Math.floor(e.latlng.lat / BLOCK_SIZE) * BLOCK_SIZE;
    const centerLng = Math.floor(e.latlng.lng / BLOCK_SIZE) * BLOCK_SIZE;
    const RADIUS = 4;

    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dy = -RADIUS; dy <= RADIUS; dy++) {
            if (Math.sqrt(dx * dx + dy * dy) <= RADIUS) {
                const bLat = (centerLat + (dx * BLOCK_SIZE)).toFixed(4);
                const bLng = (centerLng + (dy * BLOCK_SIZE)).toFixed(4);
                
                const blockId = `${bLat}_${bLng}`.replace(/\./g, '_').replace(/-/g, 'm');

                set(ref(db, `mapa/${blockId}`), {
                    lat: parseFloat(bLat),
                    lng: parseFloat(bLng),
                    country: miPais,
                    color: miColor,
                    owner: miUsuario.uid
                });
            }
        }
    }
});

// ESCUCHAR BLOQUES EN TIEMPO REAL
function procesarBloque(snap) {
    const b = snap.val();
    const idKey = snap.key;
    const bounds = [[b.lat, b.lng], [b.lat + BLOCK_SIZE, b.lng + BLOCK_SIZE]];

    if (mapaBloquesRenderizados[idKey]) {
        const previo = mapaBloquesRenderizados[idKey].owner;
        if (previo === miUsuario?.uid && b.owner !== miUsuario?.uid) {
            dispararGuerra(b.country);
        }
        mapaBloquesRenderizados[idKey].rect.setStyle({ color: b.color, fillColor: b.color });
        mapaBloquesRenderizados[idKey].owner = b.owner;
        mapaBloquesRenderizados[idKey].rect.setTooltipContent(`<b>${b.country}</b>`);
    } else {
        const rect = L.rectangle(bounds, { color: b.color, weight: 0.5, fillOpacity: 0.65 }).addTo(map);
        rect.bindTooltip(`<b>${b.country}</b>`, { sticky: true });
        mapaBloquesRenderizados[idKey] = { rect, owner: b.owner };
    }
}

onChildAdded(ref(db, 'mapa'), procesarBloque);
onChildChanged(ref(db, 'mapa'), procesarBloque);

// MÉTODOS DE INTERFAZ EXPORTADOS AL SCOPE GLOBAL (WINDOW)
window.setColor = (c) => miColor = c;
window.guardarPais = () => {
    miPais = document.getElementById("input-nombre-pais").value || "Nación Libre";
    window.toggleModal('modal-pais');
};
window.toggleModal = (id) => document.getElementById(id).classList.toggle("hidden");

function dispararGuerra(enemigo) {
    const banner = document.getElementById("war-banner");
    document.getElementById("war-text").innerText = `¡${enemigo.toUpperCase()} ESTÁ INVADIENDO TU TERRITORIO!`;
    banner.classList.remove("hidden");
    setTimeout(() => banner.classList.add("hidden"), 3000);
}
