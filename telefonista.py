# telefonista.py

from flask import request
from flask_socketio import emit 
from nca import Notario, Crupier, Arbitro
from contador import Contador
from taquilla import Taquillero  

# Instanciamos a los actores
notario = Notario()
crupier = Crupier()
arbitro = Arbitro()
contador = Contador()
taquillero = Taquillero() 

def emitir_permisos_vias(estado):
    """
    La Telefonista reparte el estado de la partida. 
    Asegura que cada jugador reciba SUS permisos y SUS extremos legales.
    """
    for asiento_id, datos_jugador in estado['jugadores'].items():
        if datos_jugador and "sid" in datos_jugador:

            info_personalizada = arbitro.generar_permisos_via(estado, asiento_id)
            paquete_para_el_radio = estado.copy()
            paquete_para_el_radio['permisos_vias_tren'] = info_personalizada['vias']
            paquete_para_el_radio['extremos_legales'] = info_personalizada['extremos_legales']
            
            emit('actualizar_mesa', paquete_para_el_radio, to=datos_jugador["sid"])

            
def iniciar_eventos_socket(socketio):
    
    @socketio.on('connect')
    def handle_connect():
        print(f"📡 TELEFONISTA: Conexión establecida (sid: {request.sid})")

    @socketio.on('solicitar_estado_lobby')
    def handle_solicitud_estado():
        # Le pedimos al Taquillero la lista de quiénes ya están
        mapa = taquillero.obtener_mapa_completo()
        
        # Se lo enviamos SOLO al que acaba de preguntar
        emit('estado_lobby_actualizado', {
            'jugadores': mapa['jugadores']
        })

    @socketio.on('evento_lobby')
    def handle_lobby(data):
        """
        TAREA: La Telefonista recibe la llamada y le pregunta al Taquillero.
        """
        sid = request.sid
        asiento_id = str(data.get('asiento_id'))
        nombre = data.get('nombre')

        # 1. ¿El asiento está libre? (Le preguntamos al experto)
        if not taquillero.revisar_asiento_libre(asiento_id):
            emit('ticket_acceso', {
                'autorizado': False,
                'mensaje': f'⚠️ El asiento {asiento_id} ya tiene dueño.'
            }, to=sid)
            return

        # 2. Si está libre, el Taquillero hace el registro en memoria
        taquillero.ocupar_asiento(asiento_id, nombre, sid)
        
        # ✨ 3. CAMBIO CRUCIAL: Traemos el estado real y oficial desde SQLite (Notario)
        estado = notario.cargar_estado()
        
        # ✨ Registramos al jugador dentro de la estructura oficial de la partida
        if 'jugadores' not in estado:
            estado['jugadores'] = {}
            
        estado['jugadores'][asiento_id] = {
            "nombre": nombre,
            "sid": sid,
            "mano": [],
            "permisos_actuales": {}
        }
        
        # Si es el primer jugador en registrarse, el Notario lo marca como anfitrión
        if len(estado['jugadores']) == 1:
            estado['anfitrion_sid'] = sid
            
        # ✨ Guardamos el registro inmediatamente en la Base de Datos
        notario.guardar_estado(estado)

        # 4. Enviamos el ticket (Éxito) usando el estado oficial del Notario
        emit('ticket_acceso', {
            'autorizado': True,
            'asiento_id': asiento_id,
            'es_anfitrion': (estado["anfitrion_sid"] == sid),
            'estado_completo': estado # ✨ Ahora sí enviamos la estructura completa que espera radio.js
        }, to=sid)

        # 5. Avisamos a los demás (¡Chisme completo!)
        emit('mensaje_telefonista', {
            'tipo': 'asiento_ocupado',
            'asiento_id': asiento_id,
            'nombre': nombre,
            'es_anfitrion': (estado["anfitrion_sid"] == sid) 
        }, broadcast=True)

    @socketio.on('orden_arrancar_juego')
    def handle_inicio():
        #  Pedimos a la Taquilla la lista de quiénes se sentaron
        sid_llamante = request.sid
        datos_taquilla = taquillero.obtener_mapa_completo()
        
        # 1.¿Es realmente el anfitrión (Claudia)?
        if sid_llamante != datos_taquilla["anfitrion_sid"]:
            emit('error_autorizacion', {
                'mensaje': '¡Solo el capitán (Anfitrión) puede arrancar el tren!'
            }, to=sid_llamante)
            return

        print(f"🚂 TELEFONISTA: ¡Orden de arranque recibida del sid {sid_llamante}!")

        # 2. El Crupier prepara las manos usando los asientos ocupados
        asientos_reales = [id for id, jug in datos_taquilla["jugadores"].items() if jug is not None]
        reparto, pozo = crupier.preparar_partida(asientos_reales)

        # 3. El Notario crea el estado oficial
        estado_oficial = notario.cargar_estado()
        estado_oficial["jugadores"] = datos_taquilla["jugadores"]
        
        # --- ARREGLO 1: Inicializar estructuras de datos ---
        asientos_reales = [str(id) for id, jug in datos_taquilla["jugadores"].items() if jug is not None]
        
        # Necesitamos que 'vias' y 'marcadores' existan antes de jugar
        estado_oficial["vias"] = {sid: [] for sid in asientos_reales}
        estado_oficial["marcadores"] = {sid: False for sid in asientos_reales}
        estado_oficial["ya_robo_en_turno"] = False

        # Entregamos fichas
        for asiento_id, mano in reparto.items():
            estado_oficial["jugadores"][str(asiento_id)]["mano"] = mano
        
        estado_oficial["pozo"] = pozo
        estado_oficial["partida_iniciada"] = True

        # 4. El Árbitro busca la mula
        apertura = arbitro.preparar_apertura_oficial(estado_oficial["jugadores"], asientos_reales)
        
        if apertura:
            asiento_mula = str(apertura["asiento_mula"])
            ficha_mula = apertura["ficha_mula"]
            valor_mula = int(ficha_mula["l1"])
            
            estado_oficial["estacion_central"] = ficha_mula
            estado_oficial["turno_actual_asiento"] = str(apertura["turno_que_sigue"])
            estado_oficial["jugador_mula_nombre"] = apertura["nombre_mula"]

            # --- ARREGLO 2: Extremos de vía ---
            # Esto es lo que permite que el Árbitro valide las fichas después
            estado_oficial["extremos_vias"] = {sid: valor_mula for sid in asientos_reales}

            # Quitar la mula de la mano
            mano_jugador = estado_oficial["jugadores"][asiento_mula]["mano"]
            estado_oficial["jugadores"][asiento_mula]["mano"] = [f for f in mano_jugador if f["id"] != ficha_mula["id"]]
 
        # 5. El Notario sella el documento final
        notario.guardar_estado(estado_oficial)
        emit('partida_lista', estado_oficial, broadcast=True)
        print(f"📢 Avisando a todos que el tren arranca con la mula en el centro.")
        emitir_permisos_vias(estado_oficial)

    @socketio.on('jugada_jugador')
    def handle_jugada(data):
        asiento_id = str(data.get('asiento'))
        ficha_jugada = data.get('ficha')
        via_destino = str(data.get('via_destino', ''))
        padre_destino = data.get('padre_destino')
        rama_destino = data.get('rama_destino')
        
        estado = notario.cargar_estado()
        
        # 1. Turno (La ley de siempre)
        if asiento_id != str(estado.get('turno_actual_asiento')):
            emit('error_jugada', {'mensaje': 'No es tu turno'}, to=request.sid)
            return

        # 2. ¡ÁRBITRO, DAME EL VISTO BUENO!
        exito, mensaje, ficha_lista = arbitro.procesar_jugada_completa(
            asiento_id, ficha_jugada, via_destino, estado, padre_destino, rama_destino
            )

        if not exito:
            print(f"❌ ÁRBITRO RECHAZA [{asiento_id}]: {mensaje}")
            emit('error_jugada', {'mensaje': mensaje}, to=request.sid)
            return

        # 3. ¡NOTARIO, HAZ EL TRASPASO!
        notario.transferir_ficha_a_mesa(asiento_id, ficha_lista, via_destino, estado)
        
        if len(estado['jugadores'][asiento_id]['mano']) == 0:
            puntos_ronda = contador.tabular_ronda(estado['jugadores'])
            estado['partida_iniciada'] = False
            estado['historial_puntos'] = puntos_ronda 
            notario.guardar_estado(estado)
            emit('fin_de_ronda', {'ganador': asiento_id, 'puntuaciones': puntos_ronda}, broadcast=True)
            emitir_permisos_vias(estado)
        else:
            proximo = arbitro.calcular_siguiente_turno(asiento_id, estado['jugadores'])
            estado['turno_actual_asiento'] = proximo
            estado['ya_robo_en_turno'] = False
            estado['extremos_legales'] = arbitro.obtener_todos_los_extremos_legales(proximo, estado)
            
            notario.guardar_estado(estado)
            emitir_permisos_vias(estado)

    @socketio.on('solicitar_robo_pozo')
    def handle_robo_pozo(data):
        asiento_id = str(data.get('asiento'))
        estado = notario.cargar_estado()
        
        # 🛡️ El Árbitro ahora es el que decide TODO (Turno, Robo único y Fichas jugables)
        autorizado, motivo = arbitro.validar_turno_para_robar(asiento_id, estado)
        
        if not autorizado:
            # Si el Árbitro dice que NO, enviamos el motivo específico
            emit('error_jugada', {'mensaje': motivo}, to=request.sid)
            return

        # 3. Si llegamos aquí, el Árbitro dio el "OK"
        ficha_robada = notario.registrar_robo_pozo(asiento_id, estado, crupier)
        
        if ficha_robada:
            # Marcamos el robo en el estado
            estado['ya_robo_en_turno'] = True
            
            # Al robar (y no haber jugado aún), el reglamento dice que el tren se abre
            estado['marcadores'][asiento_id] = True
            
            # 🔑 IMPORTANTE: Inyectamos extremos legales para que la interfaz sepa 
            # si la ficha que acabamos de robar brilla o no.
            estado['extremos_legales'] = arbitro.obtener_todos_los_extremos_legales(asiento_id, estado)
            
            # --- AUTO-PASS LOGIC ---
            puede_jugar = False
            extremos_legales_ints = [int(e) for e in estado['extremos_legales']]
            for f in estado['jugadores'][asiento_id]['mano']:
                if int(f.get('l1', f.get('v1'))) in extremos_legales_ints or int(f.get('l2', f.get('v2'))) in extremos_legales_ints:
                    puede_jugar = True
                    break
            
            if not puede_jugar:
                estado['ya_robo_en_turno'] = False
                proximo = arbitro.calcular_siguiente_turno(asiento_id, estado['jugadores'])
                estado['turno_actual_asiento'] = proximo
                estado['extremos_legales'] = arbitro.obtener_todos_los_extremos_legales(proximo, estado)
                print(f"⏭️ AUTO-PASAR: Asiento {asiento_id} no pudo jugar tras robar. Turno de {proximo}")
            
            notario.guardar_estado(estado)
            print(f"🎲 POZO: Asiento {asiento_id} robó la ficha {ficha_robada['id']}")
            
            emitir_permisos_vias(estado)
        else:
            emit('error_jugada', {'mensaje': '¡El pozo está seco!'}, to=request.sid)

    @socketio.on('pasar_turno')
    def handle_pasar_turno(data):
        asiento_id = str(data.get('asiento'))
        estado = notario.cargar_estado()
        
        # 1. Validación de Turno
        if asiento_id != str(estado.get('turno_actual_asiento')):
            return

        # 2. 🛡️ REGLA: Solo puede pasar si ya robó (y el Árbitro ya validó que no podía jugar)
        if not estado.get('ya_robo_en_turno', False):
            emit('error_jugada', {'mensaje': '⚠️ Debes intentar robar del pozo antes de pasar tu turno.'}, to=request.sid)
            return

        # 3. CONSECUENCIA: Al pasar sin tirar, su marcador (tren) se queda ABIERTO
        estado['marcadores'][asiento_id] = True
        
        # 4. PREPARAR SIGUIENTE TURNO
        # Limpiamos el flag de robo para el que sigue
        estado['ya_robo_en_turno'] = False
        
        # Calculamos el relevo
        proximo = arbitro.calcular_siguiente_turno(asiento_id, estado['jugadores'])
        estado['turno_actual_asiento'] = proximo
        
        # 🔦 Calculamos los extremos legales para el nuevo jugador
        estado['extremos_legales'] = arbitro.obtener_todos_los_extremos_legales(proximo, estado)

        # 5. GUARDAR Y NOTIFICAR
        notario.guardar_estado(estado)
        print(f"⏭️ PASAR: Asiento {asiento_id} cedió el turno. Siguiente: {proximo}")
        
        emitir_permisos_vias(estado)   

    @socketio.on('reconectar_jugador')
    def handle_reconectar(data):
        asiento_id = str(data.get('asiento_id'))
        nuevo_sid = request.sid
        
        # 1. Cargamos el estado oficial de la partida desde SQLite a través del Notario
        estado = notario.cargar_estado()
        
        # 🚨 LA LLAVE DE SEGURIDAD: Si no hay juego activo en el servidor, prohibimos saltar el lobby
        if not estado.get('partida_iniciada', False):
            print(f"🛑 RECONEXIÓN RECHAZADA: No hay ninguna partida activa en el servidor. Enviando asiento {asiento_id} al Lobby.")
            # Le avisamos al jugador que su juego viejo ya no existe
            emit('ticket_acceso', {
                'autorizado': False,
                'mensaje': 'La partida anterior ya concluyó. Por favor, regístrate de nuevo.'
            }, to=nuevo_sid)
            return

        print(f"🔄 Intentando reconexión médica para el asiento {asiento_id} (Nuevo sid: {nuevo_sid})")
        
        # 2. Verificar que el asiento exista en el juego en curso
        if asiento_id in estado.get('jugadores', {}):
            jugador_estado = estado['jugadores'][asiento_id]
            
            if jugador_estado:
                # 3. ACTUALIZACIÓN EN TAQUILLA (Usando la estructura real: self.asientos)
                if hasattr(taquillero, 'asientos') and asiento_id in taquillero.asientos:
                    if taquillero.asientos[asiento_id]:
                        taquillero.asientos[asiento_id]['sid'] = nuevo_sid
                        print(f"🔑 Taquilla actualizada para asiento {asiento_id} con nuevo sid.")
                
                # 4. ACTUALIZACIÓN EN EL ESTADO DEL NOTARIO
                estado['jugadores'][asiento_id]['sid'] = nuevo_sid
                notario.guardar_estado(estado)
                
                # 5. Si el jugador que se reconecta es el dueño del asiento "1", actualizamos el anfitrión
                if asiento_id == "1":
                    taquillero.anfitrion_sid = nuevo_sid
                
                # 6. Enviamos ticket de acceso autorizado para saltar el lobby
                emit('ticket_acceso', {
                    'autorizado': True,
                    'asiento_id': asiento_id,
                    'es_anfitrion': (asiento_id == "1"),
                    'estado_completo': estado
                }, to=nuevo_sid)
                
                # 7. Sintonizamos la mesa verde de nuevo en su pantalla con todas sus fichas
                emitir_permisos_vias(estado)
                print(f"✅ ¡RECONECTADO exitosamente el asiento {asiento_id} en la partida activa!")
                return
                
        print(f"❌ No se pudo procesar la reconexión para el asiento {asiento_id}")

    @socketio.on('disconnect')
    def handle_disconnect():
        sid_perdido = request.sid
        print(f"📡 TELEFONISTA: Conexión perdida con {sid_perdido}")
        
        # 1. Cargamos el estado para buscar al dueño de la conexión
        estado = notario.cargar_estado()
        asiento_afectado = None
        
        for asiento_id, datos_jugador in estado.get('jugadores', {}).items():
            if datos_jugador and datos_jugador.get('sid') == sid_perdido:
                asiento_afectado = asiento_id
                break
                
        # 2. Si encontramos al jugador que se le cerró la pestaña
        if asiento_afectado:
            print(f"⚠️ El jugador del asiento {asiento_afectado} se ha ido a negro.")
            
            # Avisamos a toda la mesa mediante un evento global de alerta
            emit('alerta_desconexion_jugador', {
                'asiento_id': asiento_afectado,
                'nombre': estado['jugadores'][asiento_afectado]['nombre'],
                'mensaje': f"🔌 {estado['jugadores'][asiento_afectado]['nombre']} se ha desconectado. Esperando su regreso..."
            }, broadcast=True)

    @socketio.on('enviar_chat')
    def manejar_chat(data):
        try:
            asiento_id = data.get('asiento_id')
            mensaje = data.get('mensaje')
            estado_actual = notario.cargar_estado()
            
            # Intentamos obtener el nombre
            if hasattr(notario, 'obtener_nombre_por_asiento'):
                nombre_jugador = notario.obtener_nombre_por_asiento(asiento_id, estado_actual)
            else:
                nombre_jugador = f"Asiento {asiento_id}"

            # Enviamos a los demás
            emit('recibir_chat', {
                'nombre': nombre_jugador,
                'mensaje': mensaje,
                'es_propio': False
            }, broadcast=True, include_self=False)

            # Enviamos al autor
            emit('recibir_chat', {
                'nombre': "Tú",
                'mensaje': mensaje,
                'es_propio': True
            })
        except Exception as e:
            print(f"❌ Error en la Telefonista al repartir chisme: {e}")