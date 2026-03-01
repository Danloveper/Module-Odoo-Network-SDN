from odoo import _, api, fields, models

class NetworkConfig(models.Model):
    _name = 'network.config'
    _description = 'Config SDN'
    
    description = fields.Char('Descripción')
    
    message_rpc = fields.Text('Mensaje RPC')
    
    name = fields.Char('Nombre')

    