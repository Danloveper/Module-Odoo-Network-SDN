odoo.define('controlador_sdn.NetworkTopology', function (require) {
    "use strict";

    var AbstractField = require('web.AbstractField');
    var fieldRegistry = require('web.field_registry');
    var rpc = require('web.rpc');

    var NetworkTopology = AbstractField.extend({
        template: 'TemplateNetworkTopology',

        start: function () {
            this._super.apply(this, arguments);
            this.draw();
        },

        draw: function () {
            var self = this;
            var nodes = [];
            var edges = [];
            var EDGE_LENGTH_MAIN = 500;
            var DIR = '/controlador_sdn/static/src/img/';

            rpc.query({
                model: 'network.device',
                method: 'search_read',
                args: [[], ['name', 'type_device']],
                kwargs: { context: self.getSession().user_context }
            }).then(function (devices) {
                devices.forEach(function (device) {
                    var image = device.type_device === 'router' ? DIR + 'enrutador.png' :
                                device.type_device === 'switch' ? DIR + 'conmutador-de-red.png' :
                                DIR + 'computadora.png';

                    nodes.push({
                        id: device.id,
                        label: device.name,
                        image: image,
                        shape: 'image',
                        opacity: 0.7
                    });
                });

                var promises = devices.map(function (device) {
                    return rpc.query({
                        model: 'network.device.interfaces',
                        method: 'search_read',
                        args: [[['device_id', '=', device.id]], ['name', 'ip', 'connect_to']],
                        kwargs: { context: self.getSession().user_context }
                    }).then(function (interfaces) {
                        var ifacePromises = [];
                        interfaces.forEach(function (iface) {
                            if (iface.connect_to) {
                                var p = rpc.query({
                                    model: 'network.device.interfaces',
                                    method: 'read',
                                    args: [[iface.connect_to[0]], ['device_id', 'ip', 'name']],
                                    kwargs: { context: self.getSession().user_context }
                                }).then(function (result) {
                                    if (result && result.length && result[0].device_id) {
                                        var exists = edges.some(function (edge) {
                                            return (edge.from === device.id && edge.to === result[0].device_id[0]) ||
                                                   (edge.from === result[0].device_id[0] && edge.to === device.id);
                                        });

                                        if (!exists) {
                                            edges.push({
                                                from: device.id,
                                                to: result[0].device_id[0],
                                                length: EDGE_LENGTH_MAIN,
                                                font: { size: 18 },
                                                width: 3,
                                                arrows: { to: { enabled: false } },
                                                labelFrom: iface.name + ': ' + iface.ip,
                                                labelTo: result[0].name + ': ' + result[0].ip
                                            });
                                        }
                                    }
                                });
                                ifacePromises.push(p);
                            }
                        });
                        return Promise.all(ifacePromises);
                    });
                });

                Promise.all(promises).then(function () {
                    var container = self.$el[0];
                    var data = {
                        nodes: new vis.DataSet(nodes),
                        edges: new vis.DataSet(edges)
                    };
                    var options = {
                        layout: {
                            randomSeed: 2,
                            improvedLayout: true,
                            hierarchical: false
                        },
                        physics: {
                            enabled: true,
                            solver: 'forceAtlas2Based',  // Mejora estabilidad sin atracción excesiva
                            forceAtlas2Based: {
                                gravitationalConstant: -50,  // Reduce la atracción global
                                centralGravity: 0,  // Elimina atracción hacia el centro
                                springLength: 200,  // Aumenta la distancia natural de las conexiones
                                springConstant: 0.02  // Hace los enlaces más suaves
                            },
                            stabilization: {
                                enabled: true,
                                iterations: 1000
                            }
                        },
                        interaction: {
                            dragNodes: true,  // Permite mover los nodos
                            dragView: true,  // Evita que toda la red se mueva al arrastrar un nodo
                            zoomView: true  // Permite hacer zoom sin afectar la disposición
                        },
                        edges: {
                            smooth: false,  // Desactiva las curvas para que las líneas sean rectas
                            font: {
                                align: 'middle' // Alinea mejor las etiquetas en el centro de la línea
                            },
                            arrows: {
                                to: { enabled: false }
                            }
                        },
                        groups: {
                            computer: { opacity: 0.3 }
                        }
                    };
                    var network = new vis.Network(container, data, options);

                    // Se actualiza el label concatenando ambas etiquetas.
                    edges.forEach(function (edge) {
                        network.body.data.edges.update({
                            id: edge.id,
                            label: edge.labelFrom + '                    ' + edge.labelTo
                        });
                    });
                });
            });
        }
    });

    fieldRegistry.add('NetworkTopology', NetworkTopology);
});
