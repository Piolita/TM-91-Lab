
# contador.py
class Contador:
    def __init__(self):
        ### 🔢 CONTADOR: El encargado de las sumas y el ranking
        pass

    def calcular_puntos_mano(self, mano):
        """Suma el valor de las fichas que le quedaron al jugador."""
        suma = 0
        for ficha in mano:
            # Regla de Oro: El Doble Blanca (0-0) es la ficha más castigada
            if ficha['l1'] == 0 and ficha['l2'] == 0:
                suma += 50
            else:
                # Sumamos ambos lados de la ficha (l1 y l2)
                suma += (int(ficha['l1']) + int(ficha['l2']))
        return suma

    def tabular_ronda(self, jugadores):
        """Crea un mapa rápido de puntos de esta ronda específica."""
        puntuaciones_ronda = {}
        for asiento_id, datos in jugadores.items():
            if datos and 'mano' in datos:
                puntos = self.calcular_puntos_mano(datos['mano'])
                puntuaciones_ronda[asiento_id] = puntos
            
        return puntuaciones_ronda

    def obtener_ganador_partida(self, historial_puntos):
        """
        Recibe un diccionario con los puntos acumulados y 
        devuelve el ID del asiento con la puntuación más baja.
        """
        if not historial_puntos:
            return None
        
        # El ganador es el que tiene el MINIMO de puntos
        ganador_id = min(historial_puntos, key=historial_puntos.get)
        return ganador_id, historial_puntos[ganador_id]