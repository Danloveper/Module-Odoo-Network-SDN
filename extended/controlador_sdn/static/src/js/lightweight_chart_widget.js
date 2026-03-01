odoo.define('controlador_sdn.CombinedChartWidget', function (require) {
    "use strict";
    var AbstractAction = require('web.AbstractAction');
    var core = require('web.core');

    function getRandomColor() {
        var color = Math.floor(Math.random() * 16777215).toString(16);
        while (color.length < 6) { color = "0" + color; }
        return "#" + color;
    }

    var BandwidthInterfacesChartWidget = AbstractAction.extend({
        template: 'LightweightChartWidget',
        events: { 'click #export_excel_btn': '_onExportData' },

        start: function () {
            this._super.apply(this, arguments);
            this.latencyData = {};
            this.bandwidthData = {};
            this.trafficData = {};
            this.bandwidthLog = [];

            this.latencyMapping = { "CSR1K": "container2", "CSR1K2": "container4", "CSR1K3": "container6" };
            this.bandwidthMapping = { "CSR1K": "container1", "CSR1K2": "container3", "CSR1K3": "container5" };
            this.latencyCharts = {};
            this.bandwidthCharts = {};

            // Añadir botón exportar
            var btn = document.createElement('button');
            btn.id = 'export_excel_btn';
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-primary';
            btn.innerText = 'Exportar a Excel';
            btn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:1000;';
            var root = this.el.querySelector('.o_lightweight_chart_widget');
            if (root) { root.style.position = 'relative'; root.appendChild(btn); }

            setTimeout(this._initCharts.bind(this), 50);
            setTimeout(this._startPolling.bind(this), 100);
        },

        _initCharts: function () {
            var self = this;
            // Inicializar estructuras de datos
            Object.values(this.latencyMapping).forEach(function (cid) {
                self.latencyData[cid] = [];
                self.trafficData[cid] = [];
            });
            Object.values(this.bandwidthMapping).forEach(function (cid) {
                self.bandwidthData[cid] = {};
            });

            // Latencia
            Object.values(this.latencyMapping).forEach(function (cid) {
                var c = self.el.querySelector('#' + cid);
                if (!c) return;
                var chart = LightweightCharts.createChart(c, {
                    width: c.offsetWidth,
                    height: 300,
                    layout: { background: { color: '#000' }, textColor: '#fff' },
                    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
                    timeScale: { timeVisible: true, secondsVisible: true }
                });
                var s = chart.addLineSeries({ color: '#ff073a', lineWidth: 2 });
                s.setData([]);
                self.latencyCharts[cid] = { chart: chart, series: s };
            });

            // Bandwidth
            Object.values(this.bandwidthMapping).forEach(function (cid) {
                var c = self.el.querySelector('#' + cid);
                if (!c) return;
                var chart = LightweightCharts.createChart(c, {
                    width: c.offsetWidth,
                    height: 300,
                    layout: { background: { color: '#000' }, textColor: '#fff' },
                    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
                    timeScale: { timeVisible: true, secondsVisible: true }
                });
                var legend = document.createElement('div');
                legend.style.cssText = 'position:absolute;top:5px;left:5px;background:rgba(0,0,0,0.6);padding:5px;border-radius:5px;color:#fff;z-index:999';
                c.style.position = 'relative';
                c.appendChild(legend);
                self.bandwidthCharts[cid] = { chart: chart, series: {}, legendContainer: legend };
            });
        },

        _startPolling: function () {
            this._updateCharts();
            this.pollingInterval = setInterval(this._updateCharts.bind(this), 20000);
        },

        _updateCharts: function () {
            var self = this;
            if (self.updating) return;
            self.updating = true;
            self.bandwidthLog = [];
            this._rpc({ model: 'network.monitor', method: 'update_router_stats', args: [[]] }, { shadow: true })
                .then(function () {
                    return self._rpc({
                        model: 'network.monitor',
                        method: 'search_read',
                        args: [[]],
                        kwargs: { fields: ['latency', 'last_update', 'bandwidth', 'traffic', 'device_id'] }
                    });
                })
                .then(function (records) {
                    records.forEach(function (r) {
                        var name = r.device_id[1];
                        if (!(name in self.latencyMapping) || !(name in self.bandwidthMapping)) return;
                        var latId = self.latencyMapping[name], bwId = self.bandwidthMapping[name];
                        var ts = (function (u) {
                            var d = new Date(u + (u.endsWith('Z') ? '' : 'Z'));
                            return isNaN(d) ? null : Math.floor(d.getTime() / 1000) - d.getTimezoneOffset() * 60;
                        })(r.last_update);
                        if (ts === null) return;

                        // Latencia
                        var lat = r.latency || 0;
                        self.latencyCharts[latId].series.update({ time: ts, value: lat });
                        self.latencyData[latId].push({ time: ts, value: lat });
                        self.latencyCharts[latId].chart.timeScale().scrollToRealTime();

                        // Traffic
                        var traf = r.traffic || '';
                        self.trafficData[latId].push({ time: ts, text: traf });
                        var trafEl = self.el.querySelector('#traffic_' + bwId);
                        if (trafEl) { trafEl.innerHTML = traf; }

                        // Bandwidth
                        var obj = {};
                        try { obj = JSON.parse(r.bandwidth || '{}'); } catch (e) {}
                        Object.entries(obj).forEach(function ([iface, val]) {
                            if (!self.bandwidthCharts[bwId].series[iface]) {
                                var col = getRandomColor();
                                var series = self.bandwidthCharts[bwId].chart.addLineSeries({
                                    color: col,
                                    lineWidth: 2,
                                    lastValueVisible: true,
                                    priceLineVisible: true,
                                    crosshairMarkerVisible: true
                                });
                                series.setData([]);
                                series.__ifaceName = iface;
                                series.__color = col;
                                self.bandwidthCharts[bwId].series[iface] = series;
                                self.bandwidthData[bwId][iface] = [];
                            }
                            self.bandwidthCharts[bwId].series[iface].update({ time: ts, value: val || 0 });
                            self.bandwidthData[bwId][iface].push({ time: ts, value: val || 0 });
                            self.bandwidthLog.push(val || 0);
                        });
                        console.log('Valores en kbps:', self.bandwidthLog.join(', '));

                        var html = '';
                        Object.values(self.bandwidthCharts[bwId].series).forEach(function (s) {
                            html += '<div style="display:flex;align-items:center;margin-bottom:2px;">'
                                  + '<span style="width:12px;height:12px;background:' + s.__color + ';display:inline-block;margin-right:5px;"></span>'
                                  + s.__ifaceName + '</div>';
                        });
                        self.bandwidthCharts[bwId].legendContainer.innerHTML = html;
                    });
                }).catch(console.error).finally(function () { self.updating = false; });
        },

        _onExportData: function () {
            var wb = XLSX.utils.book_new();
            // Recorrer por dispositivo (mismo nombre en latencyMapping)
            var self = this;
            Object.keys(this.latencyMapping).forEach(function (device) {
                var latCid = self.latencyMapping[device];
                var bwCid = self.bandwidthMapping[device];
                // Interfaces del contenedor de ancho de banda
                var interfaces = Object.keys(self.bandwidthData[bwCid] || {});
                // Cabeceras: timestamp + cada interfaz + latency + traffic + bandwidth
                var header = ['timestamp'].concat(interfaces).concat(['latency', 'traffic', 'bandwidth']);
                var rows = [header];
                // Unir todos los timestamps
                var times = Array.from(new Set(
                    (self.latencyData[latCid] || []).map(d => d.time)
                    .concat(...interfaces.map(iface => (self.bandwidthData[bwCid][iface] || []).map(d => d.time)))
                    .concat((self.trafficData[latCid] || []).map(d => d.time))
                )).sort();
                var offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
                // Construir filas
                times.forEach(function (t) {
                    var date = new Date((t * 1000) + offsetMs);
                    var formatted = date.getFullYear() + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2)
                                   + ' ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ':' + ('0' + date.getSeconds()).slice(-2);
                    var row = [formatted];
                    // Valores por interfaz
                    interfaces.forEach(function(iface) {
                        var val = (self.bandwidthData[bwCid][iface] || []).find(x => x.time === t)?.value || 0;
                        row.push(val);
                    });
                    // Latencia
                    var lat = (self.latencyData[latCid] || []).find(x => x.time === t)?.value || 0;
                    row.push(lat);
                    // Traffic
                    var traf = (self.trafficData[latCid] || []).find(x => x.time === t)?.text || '';
                    row.push(traf);
                    // Concatenado de bandwidth
                    var bwConcat = interfaces.map(function(iface) {
                        return (self.bandwidthData[bwCid][iface] || []).find(x => x.time === t)?.value || 0;
                    }).join(', ');
                    row.push(bwConcat);
                    rows.push(row);
                });
                // Añadir hoja
                var ws = XLSX.utils.aoa_to_sheet(rows);
                XLSX.utils.book_append_sheet(wb, ws, device, true);
            });
            // Generar archivo
            XLSX.writeFile(wb, 'sdn_stats_interfaces_por_dispositivo.xlsx');
        },
        

        destroy: function () {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
            this._super.apply(this, arguments);
        }
    });

    core.action_registry.add('BandwidthInterfacesChartWidget', BandwidthInterfacesChartWidget);
    return BandwidthInterfacesChartWidget;
});
