# Module-Odoo-Network-SDN
El siguiente proyecto es un modulo de Odoo 14.0 para administrar dispositivos en una red LAN utilizando el protocolo de comunicación Netconf.

## Requerimientos

Primeramente debe clonar el repositorio del codigo fuente de <a href="https://github.com/odoo/odoo/tree/14.0">Odoo 14.0</a> y la libreria <a href="https://github.com/ncclient/ncclient.git">Ncclient</a> para poder comunicarse con los dispositivos de la Red.

Antes de ejecutar el servicio de odoo cree un entorno virtual de python 3.8 para trabajar de forma aislada en el proyecto con ``python3.8 -m venv odoo-env``, luego debe activarlo.

* __Para Windows:__ odoo-env\Scripts\activate

* __En Unix o MacOS:__ source odoo-env/bin/activate

Finalmente siga la <a href="https://www.odoo.com/documentation/14.0/es/administration/install/source.html">Guia de instalación</a> para instalar la base de datos y dependencias necesarias.

Antes de lanzar el servicio de odoo el proyecto debería tener la siguiente estructura

```text
Module-Odoo-Network-SDN/
├── extended/
│   ├── controlador_sdn/
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── network_device_config.py
│   │   ├── views/
│   │   │   └── network_device_config_view.xml
│   │   ├── __init__.py
│   │   └── __manifest__.py
├── odoo-env/
|── ncclient/
└── README.md
```

