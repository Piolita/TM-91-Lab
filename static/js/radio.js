// radio.py

// Al cargar la página, verificamos si venimos de un "refresh"
window.onload = () => {
    const asientoGuardado = localStorage.getItem('mi_asiento_dominio'); 
    const enPartida = localStorage.getItem('en_partida');

    if (asientoGuardado && enPartida === 'true') {
        socket.emit('reconectar_jugador', { asiento_id: asientoGuardado });
    }
};

const socket = io();

// Variables de estado local del jugador
let mi_asiento = localStorage.getItem('mi_asiento_dominio') || null;
let soy_anfitrion = false;
let partida_en_curso = false;
window.mi_asiento = mi_asiento;
window.fichaSeleccionadaParaTirar = null;



/* ==========================================
   📻 SECCIÓN  ESCUCHAR AL SERVIDOR
   ========================================== */


// Al conectar, pedimos el estado actual del lobby
socket.on('connect', () => {
    if (partida_en_curso) {
        return; 
    }
    socket.emit('solicitar_estado_lobby');
});

// Escuchamos la respuesta con el mapa completo
socket.on('estado_lobby_actualizado', (data) => {
    for (const id in data.jugadores) {
        const p = data.jugadores[id];
        
        if (p && p.nombre) { 
            interfaz.marcarAsientoOcupado(id, p.nombre, p.es_anfitrion);
        }
    }
});

// Recibir confirmación de entrada (Solo para mí)
socket.on('ticket_acceso', (data) => {
    if (data.autorizado) {        
        // 1. Guardamos la identidad en todas nuestras variables
        window.mi_asiento = data.asiento_id;
        mi_asiento = data.asiento_id;
        soy_anfitrion = data.es_anfitrion;
        
        // Guardamos en el navegador para que no se olvide tras un refresh
        localStorage.setItem('mi_asiento_dominio', data.asiento_id);

        // 2. Lógica del Botón de Inicio (Solo si soy anfitrión Y NO ha empezado el juego)
        const btnInicio = document.getElementById('ui-btn-inicio');
        
        if (soy_anfitrion && !partida_en_curso) {
            if (btnInicio) {
                btnInicio.style.display = 'block';
                // Lo movemos al lobby para que Claudia lo vea gigante
                const lobby = document.querySelector('.lobby-contenedor');
                if (lobby) lobby.appendChild(btnInicio);
            }
        }
        // ✅ CORREGIDO: No borrar mi_asiento_dominio para los demás jugadores

    } 
    else {
        console.warn("❌ RECHAZADO: " + data.mensaje);
        alert(data.mensaje); 
        // Si nos rechazan, mejor limpiar el recuerdo del asiento
        localStorage.removeItem('mi_asiento_dominio');
    }
});

socket.on('mensaje_telefonista', (data) => {
    if (data.tipo === 'asiento_ocupado') {
        interfaz.marcarAsientoOcupado(
            data.asiento_id, 
            data.nombre, 
            data.es_anfitrion // <--- Agregamos este cable
        );
    }
});

socket.on('partida_lista', (estado) => {
    localStorage.setItem('en_partida', 'true');  // ✅ clave unificada con window.onload
    partida_en_curso = true;
    window.estado_actual = estado;
    window.mi_asiento = mi_asiento;

    interfaz.renderizarPartida(estado);

    const idSiguiente = estado.turno_actual_asiento;
    console.log("🔦 Turno inicial para:", idSiguiente);
    console.log(`%c 🚂 ¡ARRANCA EL TREN!`, "color: #e67e22; font-weight: bold;");
});

// Escuchar actualizaciones de la mesa durante el juego
socket.on('actualizar_mesa', (estado) => {
    console.log("☎️ La Telefonista dice: '¡Traigo novedades frescas del Notario!'");
    
    window.estado_actual = estado;
    if (!window.mi_asiento) window.mi_asiento = localStorage.getItem('mi_asiento_dominio');

    // Verificamos si ya estamos en la mesa o seguimos en el lobby
    const mesaDiv = document.getElementById('mesa-verde');
    const yaEstamosJugando = mesaDiv && mesaDiv.style.display !== 'none';

    if (yaEstamosJugando) {
        const nombreTurno = estado.jugadores[estado.turno_actual_asiento]?.nombre || "???";
        console.log(`%c 🔦 EL CHISME: Turno de ${nombreTurno} `, "background: #333; color: #f1c40f; font-weight: bold;");

        // Mandamos al pintor a trabajar
        interfaz.renderizarPartida(estado);
        interfaz.actualizarTurnoVisual(estado.turno_actual_asiento);
        
        if (typeof interfaz.actualizarControlesRobarPasar === "function") {
            interfaz.actualizarControlesRobarPasar(estado);
        }
    } else {
        console.log("⏳ La Telefonista guardó el recado, pero dice que aún no pasas a la mesa.");
    }
});

// Escuchar el final de la ronda
socket.on('fin_de_ronda', (data) => {
    console.log("🏁 FIN DE RONDA: Ganador Silla " + data.ganador);
    const nombreGanador = window.estado_actual.jugadores[data.ganador]?.nombre || `Jugador ${data.ganador}`;
    
    // Mostramos un anuncio espectacular reutilizando el overlay
    const overlay = document.getElementById('anuncio-mula');
    if (overlay) {
        const titulo = document.getElementById('titulo-mula');
        const visual = document.getElementById('ficha-mula-visual');
        const texto = document.getElementById('texto-mula-jugador');
        
        if (titulo) titulo.innerHTML = "🏆 ¡RONDA TERMINADA!";
        if (visual) visual.innerHTML = "<span style='font-size: 5rem;'>👑</span>";
        if (texto) {
            texto.innerHTML = `
                <div style="font-size: 1.4rem; margin-top: 15px;">
                    <strong>¡${nombreGanador} ha ganado la ronda!</strong>
                </div>
                <div style="margin-top: 15px; font-size: 1rem; opacity: 0.9;">
                    El tren ha completado su recorrido con éxito.
                </div>
            `;
        }
        overlay.classList.remove('oculto');
        overlay.classList.add('visible');
        
        // Lo ocultamos automáticamente después de 6 segundos
        setTimeout(() => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.classList.add('oculto'), 500);
        }, 6000);
    }
    
    if (typeof actualizarNoticia === "function") {
        actualizarNoticia(`🏆 Ronda terminada. ¡Felicidades a ${nombreGanador}!`);
    }
    window.fichaSeleccionadaParaTirar = null;
});

// Escuchar si el Árbitro rechaza nuestra jugada o nuestro robo
socket.on('error_jugada', (data) => {
    console.warn("⚠️ ÁRBITRO DICE:", data.mensaje);
    radio.bloqueo_envio = false; 
    document.querySelectorAll('.ficha').forEach(f => f.classList.remove('ficha-activa'));
    window.fichaSeleccionadaParaTirar = null;
});

/* ==========================================
   EL OBJETO RADIO (Acciones) 
   ========================================== */
const radio = {
    bloqueo_envio: false, 

    intentarTirar: function(fichaObjeto, viaDestino, padreDestino = null, ramaDestino = null) {
        if (this.bloqueo_envio) return; 

        // Verificamos que sea nuestro turno antes de molestar al servidor
        const miAsiento = String(window.mi_asiento);
        if (String(window.estado_actual.turno_actual_asiento) !== miAsiento) {
            console.warn("⚠️ No es tu turno, ten paciencia.");
            return;
        }

        if (!fichaObjeto) {
            console.warn("⚠️ No has seleccionado ninguna ficha.");
            return;
        }

        const paqueteJugada = {
            asiento: miAsiento,
            via_destino: String(viaDestino),
            ficha: fichaObjeto,
            padre_destino: padreDestino, 
            rama_destino: ramaDestino
        };

        console.log(`%c 📤 JUGADA: Ficha [${fichaObjeto.v1}|${fichaObjeto.v2}] ⮕ Vía: ${viaDestino}`, "color: #2ecc71; font-weight: bold;");

        this.bloqueo_envio = true; 
        socket.emit('jugada_jugador', paqueteJugada);
        
        // Desbloqueo de seguridad por si el servidor no responde
        setTimeout(() => { this.bloqueo_envio = false; }, 800);
    }
};

/* ==========================================
   📻 SECCIÓN ENVIAR AL SERVIDOR
   ========================================== */

window.addEventListener('load', () => {
    const asientoPrevio = localStorage.getItem('mi_asiento_dominio');
    const partidaActiva = localStorage.getItem('partida_en_curso');

    if (asientoPrevio && partidaActiva) {
        // Le pedimos al servidor el estado actual para saltar el lobby
        socket.emit('solicitar_estado_lobby'); 
    }
});

document.addEventListener('DOMContentLoaded', () => {

    // Registro en Lobby
    document.querySelectorAll('.ui-asiento-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-asiento');
            const nombre = document.getElementById('ui-input-nombre').value;
            if (!nombre) return alert("⚠️ Dinos tu nombre primero.");
            socket.emit('evento_lobby', { asiento_id: id, nombre: nombre });
        };
    });

    
    // Botón Inicio
    const btnInicio = document.getElementById('ui-btn-inicio');
    if (btnInicio) {
        btnInicio.addEventListener('click', () => {
            socket.emit('orden_arrancar_juego'); 
            btnInicio.disabled = true;
            btnInicio.innerText = "ARRANCANDO...";
        }, { once: true });
    }


    // Botones Acción
    document.getElementById('btn-robar').onclick = () => {
        if (radio.bloqueo_envio) return;
        socket.emit('solicitar_robo_pozo', { asiento: window.mi_asiento});
    };

    document.getElementById('btn-pasar').onclick = () => {
        if (radio.bloqueo_envio) return;
        socket.emit('pasar_turno', { asiento: window.mi_asiento});
    };
});


// --- LÓGICA DEL CHAT (EMISOR) ---
const btnEnviar = document.getElementById('btn-enviar');
const inputMsg = document.getElementById('input-msg');

btnEnviar.onclick = () => {
    const texto = inputMsg.value.trim();
    if (texto !== "") {
        // La antena lanza el mensaje al servidor
        socket.emit('enviar_chat', {
            asiento_id: window.mi_asiento,
            mensaje: texto
        });
        inputMsg.value = ""; 
    }
};

// --- LÓGICA DEL CHAT (RECEPTOR) ---
socket.on('recibir_chat', (data) => {
    // Le pedimos al pintor que lo dibuje
    interfaz.agregarMensajeChat(data.nombre, data.mensaje, data.es_propio);
});


// Al final de radio.js para que interfaz.js te encuentre
window.enviarJugadaAlServidor = function(viaId, padreId, rama) {
    radio.intentarTirar(window.fichaSeleccionadaParaTirar, viaId, padreId, rama);
};