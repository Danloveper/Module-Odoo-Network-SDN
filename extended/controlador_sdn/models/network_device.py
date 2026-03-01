
from odoo import fields, models

class NetworkDevice(models.Model):
    _name = 'network.device'
    _description = 'Device'
    
    name = fields.Char('Nombre')
    
    host = fields.Char('Host')
        
    username = fields.Char('Usuario')

    password = fields.Char('Contraseña')

    interfaces_ids = fields.One2many(
        comodel_name='network.device.interfaces',
        inverse_name='device_id'
    )

    type_device = fields.Selection(
        selection=[
            ('router', 'Router'),
            ('switch', 'Switch'),
            ('pc', 'PC'),
        ],
        default='router',
        string='Categoria'
    )

    topology = fields.Char('Topología')


class NetworkDeviceInterfaces(models.Model):
    _name = 'network.device.interfaces'
    _description = 'Device Interfaces'
    
    name = fields.Char('Interfaz')
    
    ip = fields.Char('Dirección IP')

    device_id = fields.Many2one('network.device')

    connect_to = fields.Many2one('network.device.interfaces')