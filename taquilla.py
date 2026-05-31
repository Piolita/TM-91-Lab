# =================================================================
# EL TAQUILLERO (Gestión de Asientos y Acceso)
# =================================================================
class Taquillero:
    def __init__(self):
        # 1. El mapa de asientos empieza vacío (None)
        self.asientos = {
            "1": None, "2": None, "3": None, 
            "4": None, "5": None, "6": None
        }
        # 2. El primer jugador en llegar será el jefe de la estación
        self.anfitrion_sid = None

    # --- CONSULTAS (Lectura) ---

    def revisar_asiento_libre(self, asiento_id):
        """
        Mira si el asiento solicitado está libre (es None).
        """
        return self.asientos.get(str(asiento_id)) is None

    def obtener_mapa_completo(self):
        """
        Retorna la foto actual de la mesa para que la Telefonista la reparta.
        """
        return {
            "anfitrion_sid": self.anfitrion_sid,
            "jugadores": self.asientos
        }

    # --- ACCIONES (Escritura) ---

    def ocupar_asiento(self, asiento_id, nombre, sid):
        """
        Esta es la función que trajimos del Notario. 
        Asigna el nombre y el ID de conexión al asiento.
        """
        # Si la taquilla está vacía, el primero es el Anfitrión
        if not self.anfitrion_sid:
            self.anfitrion_sid = sid

        # Creamos el perfil del jugador en el asiento
        self.asientos[str(asiento_id)] = {
            "nombre": nombre,
            "sid": sid,
            "mano": [],    # El Notario llenará esto después
            "penny": False # Estado inicial del tren
        }
        return True