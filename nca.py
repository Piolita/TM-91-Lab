# nca.py


import json
import os
import random

# =================================================================
# 1. EL NOTARIO (La Memoria y Persistencia)
# =================================================================
class Notario:
    def __init__(self):
        self.archivo = "partida_save.json"
        self.estado_inicial = {
            "anfitrion_sid": None,
            "jugadores": {}, 
            "partida_iniciada": False,
            "estacion_central": None,
            "vias": {str(i): [] for i in range(1, 7)},
            "marcadores": {str(i): False for i in range(1, 7)}, 
            "pozo": [],
            "turno_actual_asiento": None,
            "mula_apertura": 12 
        }
        self._estado_en_memoria = None

    def cargar_estado(self):
        if self._estado_en_memoria is not None:
            return self._estado_en_memoria
            
        if not os.path.exists(self.archivo):
            self._estado_en_memoria = json.loads(json.dumps(self.estado_inicial))
            self.guardar_estado_en_disco(self._estado_en_memoria)
            return self._estado_en_memoria
            
        with open(self.archivo, 'r') as f:
            self._estado_en_memoria = json.load(f)
            return self._estado_en_memoria

    def guardar_estado(self, datos):
        self._estado_en_memoria = datos
        self.guardar_estado_en_disco(datos)

    def guardar_estado_en_disco(self, datos):
        with open(self.archivo, 'w') as f:
            json.dump(datos, f, indent=4)

    def transferir_ficha_a_mesa(self, asiento_id, ficha_lista, via_destino, estado):
        via_destino_str = str(via_destino) 
        asiento_str = str(asiento_id)      
        
        # 1. LA QUITA de la mano
        mano = estado['jugadores'][asiento_str]['mano']
        estado['jugadores'][asiento_str]['mano'] = [f for f in mano if f['id'] != ficha_lista['id']]
        
        # 2. LA PONE en la vía
        # Verificamos si es mula para activar la bifurcación visual
        if int(ficha_lista.get('v1', 0)) == int(ficha_lista.get('v2', 0)):
            ficha_lista['es_bifurcacion'] = True
        
        estado['vias'][via_destino_str].append(ficha_lista)

        # 3. LA LIBERA: Si puso en su vía, quita el tren
        if via_destino_str == asiento_str:
            estado['marcadores'][asiento_str] = False
            
        return "Transferencia completada"
    
    def registrar_robo_pozo(self, asiento_id, estado, crupier):
        asiento_str = str(asiento_id)
        
        # 1. Le pedimos al crupier que nos dé la ficha física
        ficha = crupier.extraer_ficha_del_pozo(estado)
        
        if ficha:
            # 2. La anotamos en la mano del jugador
            estado['jugadores'][asiento_str]['mano'].append(ficha)
            
            # 3. Al robar, el marcador se pone en True (Tren abierto)
            estado['marcadores'][asiento_str] = True
            
            # 4. Guardamos los cambios en el JSON
            self.guardar_estado(estado)
            return ficha # Devolvemos la ficha para avisar al jugador
        
        return None

    def avanzar_turno(self, estado, arbitro):
        # 1. Antes de cambiar, reseteamos el estado de robo para el siguiente
        estado['ya_robo_en_turno'] = False 
        
        # 2. Calculamos el siguiente
        actual = estado['turno_actual_asiento']
        siguiente = arbitro.calcular_siguiente_turno(actual, estado['jugadores'])
        estado['turno_actual_asiento'] = siguiente
        
        self.guardar_estado(estado)
        return siguiente

       # En nca.py, dentro de la clase Notario

    def anotar_permisos_via(self, estado, arbitro):
        # Para cada jugador, calculamos sus permisos y extremos legales personalizados
        for asiento_id in estado['jugadores'].keys():
            # El Árbitro ahora devuelve un dict con "vias" y "extremos_legales"
            permisos_completos = arbitro.generar_permisos_via(estado, asiento_id)
            
            # Guardamos el paquete completo
            estado['jugadores'][asiento_id]['permisos_actuales'] = permisos_completos
            
        self.guardar_estado(estado)

    def obtener_nombre_por_asiento(self, asiento_id, estado):
        """El Notario busca en el estado actual quién está sentado ahí."""
        asiento_str = str(asiento_id)
        jugadores = estado.get('jugadores', {})
        
        if asiento_str in jugadores:
            jugador = jugadores[asiento_str]
            if isinstance(jugador, dict):
                return jugador.get('nombre', f"Jugador {asiento_str}")
        return f"Asiento {asiento_str}"

# =================================================================
# 2. EL CRUPIER (El Material y el Pozo)
# =================================================================
class Crupier:
    def __init__(self):
        # Ajustamos a raciones más generosas para que la partida sea fluida
        # Si no está en la lista (ej. 7 u 8 jugadores), por defecto da 10.
        self.raciones = {2: 15, 3: 15, 4: 15, 5: 12, 6: 12}

    def generar_91_fichas(self):
        fichas = []
        for i in range(13):
            for j in range(i, 13):
                # Guardamos l1 y l2, pero también una versión 'valores' 
                # para que el Árbitro compare fácil sin importar el orden.
                fichas.append({
                    "l1": i, 
                    "l2": j, 
                    "valores": sorted([i, j]), 
                    "id": f"f-{i}-{j}"
                })
        random.shuffle(fichas)
        return fichas

    def preparar_partida(self, asientos_ocupados):
        mazo = self.generar_91_fichas()
        num_j = len(asientos_ocupados)
        
        # Obtenemos la cantidad de la tabla, o 10 si son muchos jugadores
        cantidad = self.raciones.get(num_j, 10)
        
        reparto = {}
        for asiento in asientos_ocupados:
            mano = [mazo.pop() for _ in range(cantidad)]
            # Aseguramos que el ID del asiento sea siempre String para el JSON
            reparto[str(asiento)] = mano
            
        return reparto, mazo
    
    def extraer_ficha_del_pozo(self, estado):
        # Buscamos 'pozo' en el estado (antes era 'reserva')
        pozo = estado.get('pozo', [])
        if pozo:
            return pozo.pop() 
        return None
    
# =================================================================
# 3. EL ÁRBITRO (La Ley y Validación)
# =================================================================
class Arbitro:
    def __init__(self):
        pass

    def buscar_mula_apertura(self, jugadores, mula_objetivo):
        mula_id = f"f-{mula_objetivo}-{mula_objetivo}"      
        for asiento_id, datos in jugadores.items():
            if datos and "mano" in datos:
                for ficha in datos["mano"]:
                    if ficha["id"] == mula_id:
                        return str(asiento_id), ficha
        return None, None
    
    def preparar_apertura_oficial(self, jugadores, asientos_reales):
        """
        El Árbitro busca la mula y prepara los datos iniciales.
        Extraído de la lógica original de la telefonista.
        """
        for valor in range(12, -1, -1):
            asiento_mula, ficha_mula = self.buscar_mula_apertura(jugadores, valor)
            
            if asiento_mula:
                # Calculamos lo que la mesa necesita
                cantidad_vias = len(asientos_reales) + 1
                turno_que_sigue = self.calcular_siguiente_turno(asiento_mula, jugadores)
                
                # Devolvemos un paquete listo para la telefonista
                return {
                    "asiento_mula": asiento_mula,
                    "ficha_mula": ficha_mula,
                    "extremos": [valor] * cantidad_vias,
                    "turno_que_sigue": turno_que_sigue,
                    "nombre_mula": jugadores[asiento_mula]["nombre"]
                }
        return None

    def calcular_siguiente_turno(self, asiento_actual, jugadores):
        asientos_ocupados = sorted([int(k) for k in jugadores.keys() if jugadores[k] is not None])
        asiento_actual = int(asiento_actual)
        
        # Buscamos la posición del asiento actual en la lista de ocupados
        try:
            idx = asientos_ocupados.index(asiento_actual)
            siguiente_idx = (idx + 1) % len(asientos_ocupados)
            return str(asientos_ocupados[siguiente_idx])
        except ValueError:
            # Si el asiento actual no está (error raro), devolvemos el primero que haya
            return str(asientos_ocupados[0]) if asientos_ocupados else "1"
        
    def autorizar_y_preparar_ficha_exacta(self, ficha, puntas_disponibles, padre_destino, rama_destino):
        """
        Valida y prepara la ficha basándose rigurosamente en la punta 
        específica (padre y rama) que el usuario seleccionó en la pantalla.
        """
        # 1. Convertimos los datos que vienen del frontend a texto limpio
        id_buscado = str(padre_destino).replace("mesa-ficha-", "")
        rama_buscada = str(rama_destino)

        valor_extremo_tablero = None

        # 2. Buscamos de forma segura barriendo las llaves del diccionario
        for (p_id, rama), valor in puntas_disponibles.items():
            if str(p_id) == id_buscado and str(rama) == rama_buscada:
                valor_extremo_tablero = valor
                break
        
        # 3. Si después de buscar no encontramos coincidencia:
        if valor_extremo_tablero is None:
            return None, None, "La rama seleccionada ya no está disponible."
            
        f_l1 = int(ficha["l1"])
        f_l2 = int(ficha["l2"])
        
        # Validamos cuál lado de nuestra ficha conecta con el valor exacto de esa punta
        if f_l1 == valor_extremo_tablero:
            valor_conexion = f_l1
            nuevo_extremo = f_l2
        elif f_l2 == valor_extremo_tablero:
            valor_conexion = f_l2
            nuevo_extremo = f_l1
        else:
            return None, None, "La ficha no conecta numéricamente con la punta elegida."
            
        return valor_conexion, nuevo_extremo, "OK"
    
    def obtener_puntas_de_via(self, via_id, estado):
        """
        Calcula qué números están disponibles al final de un riel, manejando bifurcaciones de mulas.
        Devuelve un diccionario {(padre_id, rama): valor_disponible}
        """
        via_id_str = str(via_id)
        tren = estado['vias'].get(via_id_str, [])

        estacion = estado.get('estacion_central')
        valor_inicial = int(estacion['l1']) if estacion else int(estado.get('mula_apertura', 12))
        
        puntas = { ("estacion", "unica"): valor_inicial }
        
        for ficha in tren:
            p_id = ficha.get("padre_id", "estacion")
            rama = ficha.get("rama", "unica")
            
            # Consumimos la punta a la que se conectó
            if (p_id, rama) in puntas:
                del puntas[(p_id, rama)]
                
            # Agregamos las nuevas puntas
            f_id = ficha["id"]
            v1 = int(ficha.get("v1", ficha["l1"]))
            v2 = int(ficha.get("v2", ficha["l2"]))
            
            if v1 == v2: # Es mula, genera 2 ramas (izq, der)
                puntas[(f_id, "izq")] = v2
                puntas[(f_id, "der")] = v2
            else: # Normal, genera 1 rama
                puntas[(f_id, "unica")] = v2
                
        return puntas
    
    def validar_movimiento_completo(self, ficha, via_destino, mi_asiento, estado):
        via_destino_str = str(via_destino)
        mi_asiento_str = str(mi_asiento)

        puntas_disponibles = self.obtener_puntas_de_via(via_destino_str, estado)
        
        # 1 ¿Conecta numéricamente con alguno de los extremos?
        f_l1 = int(ficha['l1'])
        f_l2 = int(ficha['l2'])
        
        conecta = any(f_l1 == int(v) or f_l2 == int(v) for v in puntas_disponibles.values())
        
        if not conecta:
            return False, "La ficha no conecta con los extremos disponibles de esta vía."

        # 2. ¿Es su propia vía? 
        if via_destino_str == mi_asiento_str:
            return True, "OK"
        
        # 3. ¿Ya abrió su vía propia? (Regla Estricta)
        tren_propio = estado['vias'].get(mi_asiento_str, [])
        if len(tren_propio) == 0:
            return False, "Debes abrir tu propia vía antes de jugar en vías ajenas."

        # 4. ¿Es vía ajena? Solo si tiene el marcador/tren puesto
        marcadores = estado.get('marcadores', {}) 
        if not marcadores.get(via_destino_str, False):
            return False, "Esta vía está cerrada (marcador quitado)."

        # 5. 🚨 REGLA CLAVE: Si TU vía está pública, debes cerrarla PRIMERO
        #    No puedes tirar en vía ajena si tienes ficha para tu propia vía.
        mi_via_es_publica = marcadores.get(mi_asiento_str, False)
        if mi_via_es_publica:
            puntas_propias = self.obtener_puntas_de_via(mi_asiento_str, estado)
            f_l1 = int(ficha['l1'])
            f_l2 = int(ficha['l2'])
            puedo_cerrar_mi_via = any(
                f_l1 == int(v) or f_l2 == int(v)
                for v in puntas_propias.values()
            )
            if puedo_cerrar_mi_via:
                return False, "Tu vía está pública. Debes cerrar tu propia vía antes de jugar en la de otro."

        return True, "OK"

    def obtener_todos_los_extremos_legales(self, mi_asiento, estado):
        mi_asiento_str = str(mi_asiento)
        extremos = []
        
        # Verificar si ya abrió su vía
        tren_propio = estado['vias'].get(mi_asiento_str, [])
        ya_abrio_su_via = len(tren_propio) > 0

        # Siempre puede tirar en SU vía
        puntas_propias = self.obtener_puntas_de_via(mi_asiento_str, estado)
        extremos.extend(puntas_propias.values())

        # Puntas de vías AJENAS abiertas (Solo si ya abrió su propia vía)
        if ya_abrio_su_via:
            for asiento, esta_abierto in estado['marcadores'].items():
                if esta_abierto and asiento != mi_asiento_str:
                    puntas_ajenas = self.obtener_puntas_de_via(asiento, estado)
                    extremos.extend(puntas_ajenas.values())
        
        # También la Vía Mexicana si existiera, pero por ahora limpiamos duplicados
        return list(set(int(x) for x in extremos))
    
    def validar_turno_para_robar(self, asiento_id, estado):
        # 1. ¿Es su turno?
        if str(asiento_id) != str(estado.get('turno_actual_asiento')):
            return False, "No es tu turno."

        # 2. ¿Ya robó en este turno?
        if estado.get('ya_robo_en_turno', False):
            return False, "Ya robaste en este turno."

        # 3. 🛡️ LA PRUEBA DE FUEGO: ¿Realmente necesita robar?
        # Obtenemos todos los lugares donde PODRÍA tirar
        extremos_legales = self.obtener_todos_los_extremos_legales(asiento_id, estado)
        mano = estado['jugadores'][str(asiento_id)]['mano']

        for ficha in mano:
            # Si el Árbitro encuentra TAN SOLO UNA ficha que sirva...
            if self.validar_ficha_jugable(ficha, extremos_legales):
                return False, "⚠️ Tienes fichas que puedes jugar. ¡No puedes robar por estrategia!"

        return True, "OK"
    
    def validar_ficha_jugable(self, ficha, extremos_legales):
        """
        Revisa si una sola ficha puede entrar en cualquiera 
        de los extremos permitidos actualmente.
        """
        f_l1 = int(ficha['l1'])
        f_l2 = int(ficha['l2'])
        
        for ext in extremos_legales:
            if f_l1 == int(ext) or f_l2 == int(ext):
                return True
        return False

    def generar_permisos_via(self, estado, mi_asiento):
        asiento_str = str(mi_asiento)
        marcadores = estado.get('marcadores', {}) 
        vias_datos = estado.get('vias', {})
        
        # Verificar si ya abrió su vía
        tren_propio = vias_datos.get(asiento_str, [])
        ya_abrio_su_via = len(tren_propio) > 0

        # 🚨 REGLA CLAVE: Si mi vía está pública, verifico si tengo ficha
        #    que conecta con ella. Si la tengo, solo puedo tirar en la mía.
        mi_via_es_publica = marcadores.get(asiento_str, False)
        debo_cerrar_mi_via_primero = False
        if mi_via_es_publica:
            puntas_propias = self.obtener_puntas_de_via(asiento_str, estado)
            extremos_propios = list(puntas_propias.values())
            # Revisamos si alguna ficha en mano conecta con la vía propia
            mano = estado['jugadores'][asiento_str].get('mano', [])
            for ficha in mano:
                if self.validar_ficha_jugable(ficha, extremos_propios):
                    debo_cerrar_mi_via_primero = True
                    break

        extremos_jugables = self.obtener_todos_los_extremos_legales(mi_asiento, estado)

        permisos_finales = {
            "vias": {},
            "extremos_legales": extremos_jugables
        }

        # Analizamos solo los rieles de los jugadores
        for id_via_str, fichas in vias_datos.items():
            es_mia = (id_via_str == asiento_str)
            tiene_tren = marcadores.get(id_via_str, False) 
            
            if debo_cerrar_mi_via_primero:
                # Solo mi propia vía tiene permiso
                tiene_permiso = es_mia
            else:
                tiene_permiso = es_mia or (tiene_tren and ya_abrio_su_via)

            permisos_finales["vias"][id_via_str] = {
                "tren": tiene_tren,
                "semaforo": "amarillo" if es_mia else ("verde" if tiene_tren else "rojo"),
                "permiso": tiene_permiso
            }

        return permisos_finales

    def procesar_jugada_completa(self, asiento_id, ficha_jugada, via_id, estado, padre_destino=None, rama_destino=None):
        # 1. ¿Es su turno?
        if str(estado["turno_actual_asiento"]) != str(asiento_id):
            return False, "No es tu turno", None

        # 1.5. ¿Realmente tiene la ficha en la mano?
        mano_jugador = estado['jugadores'][str(asiento_id)]['mano']
        if not any(f['id'] == ficha_jugada['id'] for f in mano_jugador):
            return False, "No tienes esa ficha en tu mano", None

        # ¡NUEVO! Llamamos a validar_movimiento_completo para asegurar TODAS las reglas.
        valido, msg = self.validar_movimiento_completo(ficha_jugada, via_id, asiento_id, estado)
        if not valido:
            return False, msg, None

        # 2. Obtener las puntas legales de esa vía
        puntas_legales = self.obtener_puntas_de_via(via_id, estado)
        
        # 3. Validar conexión
        f_l1 = int(ficha_jugada["l1"])
        f_l2 = int(ficha_jugada["l2"])
        
        # Si el jugador especificó un destino exacto, verificamos que sea válido
        if padre_destino and rama_destino:

            # 🔎 TESTIGOS DE DEPURACIÓN (MIRA TU TERMINAL AQUÍ)
            print("\n=== 🕵️‍♂️ AUDITORÍA DEL ÁRBITRO ===")
            print(f"Frontend mandó padre_destino: '{padre_destino}' (tipo: {type(padre_destino)})")
            print(f"Frontend mandó rama_destino: '{rama_destino}' (tipo: {type(rama_destino)})")
            print(f"Puntas legales en Python: {list(puntas_legales.keys())}")
            print("=================================\n")
            
            id_buscado = str(padre_destino).replace("mesa-ficha-", "")
            rama_buscada = str(rama_destino)
            
            punta_elegida = None
            v_ext = None
            
            # Buscamos barriendo el diccionario convirtiendo a texto
            for (p_id, rama), valor in puntas_legales.items():
                if str(p_id) == id_buscado and str(rama) == rama_buscada:
                    punta_elegida = (p_id, rama)
                    v_ext = valor
                    break
            
            if punta_elegida is not None:
                if f_l1 == v_ext or f_l2 == v_ext:
                    # Encontrado y conecta numéricamente
                    pass 
                else:
                    return False, "La ficha no encaja en la rama seleccionada.", None
            else:
                return False, "La rama seleccionada ya no está disponible.", None
        else:
            # Buscamos si alguno de los lados de la ficha conecta con alguna punta (Plan de contingencia)
            opciones_validas = []
            for clave, valor in puntas_legales.items():
                if f_l1 == valor or f_l2 == valor:
                    opciones_validas.append((clave, valor))
            
            if not opciones_validas:
                return False, "La ficha no encaja en esta vía", None
            
            punta_elegida, v_ext = opciones_validas[0]

        # 4. Preparar la ficha para la mesa (orientar v1 y v2)
        ficha_lista = ficha_jugada.copy()
        if f_l1 == v_ext:
            ficha_lista["v1"] = f_l1 # Lado que conecta
            ficha_lista["v2"] = f_l2 # Nueva punta
        else:
            ficha_lista["v1"] = f_l2
            ficha_lista["v2"] = f_l1

        ficha_lista["padre_id"] = punta_elegida[0]
        ficha_lista["rama"] = punta_elegida[1]

        return True, "Jugada legal", ficha_lista
    