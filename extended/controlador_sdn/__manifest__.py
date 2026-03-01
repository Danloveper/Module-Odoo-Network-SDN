# -*- coding: utf-8 -*-
{
    'name': 'Controlador SDN',

    'summary': 'El siguiente modulo implementa la configuración de equipos de red mediante el protocolo Netconf',

    'description': 'La aplicación permite configurar parametros de la red',

    'author': 'William Daniel Vargas',

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/master/odoo/addons/base/module/module_data.xml
    # for the full list
    'category': 'Uncategorized',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base'],

    # always loaded
    'data': [
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'views/assest.xml',
        'views/network_config_view.xml',
        'views/network_device_config_view.xml',
        'views/network_device_view.xml',
        'views/network_monitor_view.xml',
        'views/network_monitoring_view.xml',
        'views/network_sdn_menu.xml',
    ],
    'qweb':[
        'static/src/xml/network_topology_template.xml'
    ],
}