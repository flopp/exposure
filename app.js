$(function() {
    App.init();
});

var App = {
    init: function() {
        this.map = null;
        this.heatmap = null;
        this.initMap();
        this.initEventHandlers();
    },
    
    initMap: function() {
        const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
            attribution:'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
            minZoom: 0
        });
        const openstreetmap = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: 'map data: © <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'});
    
        const cfg = {
            // radius should be small ONLY if scaleRadius is true (or small radius is intended)
            // if scaleRadius is false it will be the constant radius used in pixels
            "radius": 0.0005,
            "maxOpacity": .8,
            // scales the radius based on map zoom
            "scaleRadius": true,
            // if set to false the heatmap uses the global maximum for colorization
            // if activated: uses the data maximum within the current map boundaries
            //   (there will always be a red spot with useLocalExtremas true)
            "useLocalExtrema": false,
            // which field name in your data represents the latitude - default "lat"
            latField: 'lat',
            // which field name in your data represents the longitude - default "lng"
            lngField: 'lng',
            // which field name in your data represents the data value - default "value"
            valueField: 'count'
        };
        this.heatmap = new HeatmapOverlay(cfg);

        this.map = L.map('map', {
            center: [50.790317, 10.513450],
            zoom: 6,
            layers: [positron, this.heatmap]
        });
    
        L.control.layers({"Positron/Carto": positron, "OpenStreetMap": openstreetmap}, {}).addTo(this.map);
    },

    initEventHandlers: function() {
        $(".upload-button").click(event => {
            $("#uploadInput").click();
            event.preventDefault(); 
        });

        $(".info-button").click(event => {
            $("#info-dialog").addClass("is-active");
        });
        $("#info-dialog .close-button").click(event => {
            $("#info-dialog").removeClass("is-active");
        });
        $("#heatmap-dialog .close-button").click(event => {
            $("#heatmap-dialog").removeClass("is-active");
        });
    },

    importFiles: files => {
        const self = this;
        if (files && files.length > 0) {
            var reader = new FileReader();
            reader.onloadend = function() {
                if (reader.result) {
                    const config = {
                        locateFile: filename => `https://cdn.jsdelivr.net/npm/sql.js@1.3.0/dist/${filename}`
                    }
                    initSqlJs(config).then(function(SQL) {
                        const Uints = new Uint8Array(reader.result);
                        const db = new SQL.Database(Uints);
                        const stmt = db.prepare("select latitude as lat, longitude as lng from locations inner join devices where locations.device_id == devices.id and devices.service_uuids == 'fd6f'");
                        var points = new Map();
                        var count = 0;
                        while (stmt.step()) {
                            var row = stmt.getAsObject();
                            const lat = row['lat'];
                            const lng = row['lng'];
                            const key = `${lat}/${lng}`;
                            if (points.has(key)) {
                                var d = points.get(key);
                                d['count'] += 1;
                                points.set(key, d);
                            } else {
                                points.set(key, {lat: lat, lng: lng, count: 1});
                            }
                            count += 1;
                        }
                        var max = 0;
                        var data = [];
                        var bounds = null;
                        points.forEach(function(d) {
                            if (d['count'] > max) {
                                max = d['count'];
                            }
                            data.push(d);
                            if (bounds === null) {
                                bounds = L.latLngBounds(L.latLng(d['lat'], d['lng']), L.latLng(d['lat'], d['lng']));
                            } else {
                                bounds.extend(L.latLng(d['lat'], d['lng']));
                            }
                        });
                        if (data.length > 0) {
                            App.map.fitBounds(bounds);
                        }
                        App.heatmap.setData({max: max, data: data});
                        App.showHeatmapDialog(count, max);
                    });
                }
            };
            reader.readAsArrayBuffer(files[0]);
        }

        // reset file input
        $('#uploadInput').wrap('<form>').closest('form').get(0).reset();
        $('#uploadInput').unwrap();
    },

    showHeatmapDialog: function(count, max) {
        $("#beacon-count").text("" + count);
        $("#beacon-max").text("" + max);
        $("#heatmap-dialog").addClass("is-active");
    }
};
