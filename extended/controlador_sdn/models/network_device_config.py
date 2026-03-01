
from ncclient import manager,xml_
import xml.dom.minidom
import re


from odoo.exceptions import UserError
from odoo import _, api, fields, models

ip_format = r'^(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})$'
prefix_format = r'^([0-9]|[12][0-9]|3[0-2])$'
vlan_format = r"^(100|[1-9][0-9]?)$"
privilege_format = r"^(?:[0-9]|1[0-5])$"

class NetworkDeviceConfig(models.Model):
    _name = 'network.device.config'
    _description = 'Device Config'

    address_ip = fields.Char('Dirección IP')
    
    address_mask = fields.Char('Mascara de Red')

    config_id = fields.Many2one(
        comodel_name='network.config',
        string='Operación'    
    )

    device_id = fields.Many2one(
        comodel_name='network.device',
        string='Dispositivo'
    )
    
    description = fields.Char()
    
    hostname = fields.Char()
    
    interface = fields.Selection(
        selection=[
            ('1', 'GigabitEthernet1'),
            ('2', 'GigabitEthernet2'),
            ('3', 'GigabitEthernet3'),
            ('4', 'GigabitEthernet4'),
        ],
        default='1',
        tracking=True,
        copy=False
    )
    
    interface_active = fields.Boolean('Activar')
    
    interface_prefix = fields.Integer('Prefijo de la interfaz')
    
    interface_mask = fields.Char('Mascara de red')
    
    name = fields.Char(
        required=True,
        string='Nombre',
        default='Nuevo'
    )
    
    password = fields.Char('Contraseña')
    
    privilege = fields.Integer('Privilegio')
    
    state = fields.Selection(
        selection=[
            ('draft', 'Borrador'),
            ('done', 'Hecho'),
            ('cancel', 'Cancelado')
        ], 
        required=True,
        default='draft',
        tracking=True,
        copy=False,
        string="Estado"
    )
    
    username = fields.Char('Usuario')
    
    vlan_subinterface = fields.Integer('Vlan')
    
    @api.model
    def create(self, vals):
        Sequence = self.env['ir.sequence']
        if vals.get('name', 'Nuevo'):
            code = 'network.device.config'
            vals['name'] = Sequence.next_by_code(code) or 'Nuevo'
        return super(NetworkDeviceConfig, self).create(vals)
    
    def validate_format_config(self):
        if self.config_id.id == 2 and not re.match(privilege_format, str(self.privilege)):
            raise UserError ('El privilegio del usuario debe asignarse con un numero de 0-15')
        elif self.config_id.id in [3,4] and not re.match(ip_format, self.address_ip):
            raise UserError ('La dirección IP debe corresponder a un numero de 4 octetos en decimal\nDonde cada segmento tiene un rango de 0-255 Ejemplo: 192.168.50.2')
        elif self.config_id.id == 3 and not re.match(prefix_format, str(self.interface_prefix)):
            raise UserError ('El prefijo corresponde al numero bits destinados a definir la red, el rango debe ser de 0-32')
        elif self.config_id.id == 4 and not re.match(ip_format, self.address_mask):
            raise UserError ('La mascara de red consta de 4 octetos donde cada segmento varia de 0-255\nEl numero disponible de dispositivos para la interfaz dependera de los bits que no se ocupen\nEjemplo: una mascara de 255.255.255.0 Permite conectar 255 PCs')
        elif self.config_id.id == 4 and not re.match(vlan_format, str(self.vlan_subinterface)):
            raise UserError ('El rango de Vlan disponibles es de 1-100')
        
    def prepare_config(self):
        interface_dict = dict(self._fields['interface'].selection)
        return self.config_id.message_rpc.format(
            hostname=self.hostname,
            username=self.username,
            password=self.password,
            privilege=str(self.privilege),
            interface=interface_dict.get(self.interface),
            description=self.description,
            active=str(self.interface_active).lower(),
            ip=self.address_ip,
            prefix=str(self.interface_prefix),
            name_ref=self.interface,
            vlan=str(self.vlan_subinterface),
            mask=self.address_mask
        )
   
    def edit_config(self):
        self.validate_format_config()
        config = self.prepare_config()
        with manager.connect(
        host= self.device_id.host,
        port= '830',
        username= self.device_id.username,
        password= self.device_id.password,
        hostkey_verify= False
        ) as m:
            
            config_response = m.edit_config(target="running", config=config)
            netconf_save = '<save-config xmlns="http://cisco.com/yang/cisco-ia"/>'
            m.dispatch(xml_.to_ele(netconf_save))
            print(xml.dom.minidom.parseString(config_response.xml).toprettyxml())
            
        return self.write({'state': 'done'})
    
    def cancel_config(self):
        return self.write({'state':'cancel'})
            