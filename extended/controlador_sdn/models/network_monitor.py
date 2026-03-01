from odoo import models, fields, api
import time
import os
from ncclient import manager
import xml.dom.minidom
from datetime import datetime
import json
import subprocess
import re

class NetworkMonitor(models.Model):
    _name = 'network.monitor'
    _description = 'Monitoreo del Dispositivo'

    name = fields.Char(
        related='device_id.name'
    )
    device_id = fields.Many2one(
        'network.device', 
        string='Dispositivo',
        domain=[('type_device', '=', 'router')],
        required=True,
        help="El dispositivo (router) a monitorear"
    )
    bandwidth = fields.Text(
        string='Ancho de Banda',
        help="Datos de ancho de banda por interfaz en formato JSON (ej: {\"Gig0/0\": 50.5, \"Gig0/1\": 35.2})"
    )
    bandwidth_info = fields.Text(
        string='Ancho de Banda valores'
    )
    latency = fields.Float(string='Latencia (ms)')
    traffic = fields.Text(string='Tráfico')
    availability = fields.Boolean(string='Disponibilidad')
    last_update = fields.Datetime(string='Última actualización')

    def update_router_stats(self):
        """Actualiza los datos de monitoreo para cada registro de router."""
        devices = self.env['network.monitor'].search([])
        for router in devices:
            bw = router._calculate_bandwidth()[0]
            bw_values = router._calculate_bandwidth()[1]
            ping_stats_text, avg_latency = router._get_ping_stats()
            avail = router._ping_router()
            router.write({
                'bandwidth': bw,
                'bandwidth_info': bw_values,
                'latency': avg_latency,
                'traffic': ping_stats_text,
                'availability': avail,
                'last_update': fields.Datetime.now(),
            })

    def _calculate_bandwidth(self):
        """Obtiene el ancho de banda por interfaz mediante NETCONF.
        Retorna un string JSON con los datos."""
        try:
            t1 = time.time()
            dom1 = self._get_router_data()
            time.sleep(5)
            dom2 = self._get_router_data()
            t2 = time.time()
            delta_t = t2 - t1  
            interfaces1 = dom1.getElementsByTagName("interface")
            interfaces2 = dom2.getElementsByTagName("interface")
            bw_data = {}
            bw_values = []
            for i in range(len(interfaces1)):
                iface_name = interfaces1[i].getElementsByTagName("name")[0].firstChild.nodeValue
                if iface_name == 'Control Plane':
                    continue
                in_octets1 = int(interfaces1[i].getElementsByTagName("in-octets")[0].firstChild.nodeValue)
                in_octets2 = int(interfaces2[i].getElementsByTagName("in-octets")[0].firstChild.nodeValue)
                # Cálculo en kbps
                in_bandwidth = (in_octets2 - in_octets1) * 8 / (delta_t*1000)
                bw_data[iface_name] = in_bandwidth
                bw_values.append(in_bandwidth)
            return json.dumps(bw_data), bw_values
        except Exception as e:
            return "{}"

    def _get_router_data(self):
        """Establece la conexión NETCONF y retorna el DOM de la respuesta."""
        with manager.connect(
            host=self.device_id.host, 
            port='830', 
            username=self.device_id.username, 
            password=self.device_id.password, 
            hostkey_verify=False
        ) as m:
            netconf_filter = """
            <filter>
                <interfaces-state xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
                    <interface>
                        <name></name>
                        <statistics/>
                    </interface>
                </interfaces-state>
            </filter>
            """
            response = m.get(netconf_filter)
            return xml.dom.minidom.parseString(response.xml)

    def _ping_router(self):
        """Ejecuta un ping simple para verificar la disponibilidad."""
        response = os.system(f"ping -n 1 {self.device_id.host} > nul")
        return response == 0

    def _get_ping_stats(self):
        try:
            result = subprocess.run(["ping", "-n", "4", self.device_id.host],
                                    capture_output=True, text=True)
            output = result.stdout

            # Extraer información de paquetes
            packets_match = re.search(
                r"enviados\s*=\s*(\d+),\s*recibidos\s*=\s*(\d+),\s*perdidos\s*=\s*(\d+)",
                output, re.IGNORECASE)
            if packets_match:
                sent = int(packets_match.group(1))
                received = int(packets_match.group(2))
                lost = int(packets_match.group(3))
                # Calcular porcentaje de pérdida (si se enviaron paquetes)
                pct_lost = (lost / sent * 100) if sent > 0 else 0
            else:
                sent = received = lost = pct_lost = 0

            # Extraer latencia promedio
            latency_match = re.search(r"media\s*=\s*(\d+)\s*ms", output, re.IGNORECASE)
            if latency_match:
                avg_latency = float(latency_match.group(1))
            else:
                avg_latency = 0.0

            # Formatear la cadena de salida
            ping_text = f"Paquetes: enviados = {sent}, recibidos = {received}, perdidos = {lost} ({pct_lost:.0f}% perdidos)"
            return ping_text, avg_latency
        except Exception as e:
            return "No se pudo obtener el ping", 0.0


{
    "GigabitEthernet1": 9.101621078201509,
    "GigabitEthernet2": 0.5117859793180891,
    "GigabitEthernet3": 0.0,
    "GigabitEthernet4": 0.0
}