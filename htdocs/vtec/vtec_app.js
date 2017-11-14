// Functionality to replicate
// var CONFIG is set in the base HTML page
// previous hashlinking looks like 2017-O-NEW-KALY-WI-Y-0015

var olmap;
var productVectorCountyLayer;
var productVectorPolygonLayer;
var radarTMSLayer;
var radartimes = [];
var lsrTable;
var eventTable;
var ugcTable;
var sbwLsrTable;

Number.prototype.padLeft = function (n,str){
    return Array(n-String(this).length+1).join(str||'0')+this;
}

var sbwLookup = {
        "TO": 'red',
        "MA": 'purple',
        "FF": 'green',
        "EW": 'green',
        "FA": 'green',
        "FL": 'green',
        "SV": 'yellow'
       };

var sbwStyle = [new ol.style.Style({
	stroke: new ol.style.Stroke({
		color: '#FFF',
		width: 4.5
	})
	}), new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: '#319FD3',
			width: 3
		})
	})
];


function updateHash(){
	// Set the hashlink as per our current CONFIG
	window.location.href = "#" + CONFIG.year +"-O-NEW-"+
    CONFIG.wfo +"-"+ CONFIG.phenomena +"-"+
    CONFIG.significance +"-"+
    CONFIG.etn.padLeft(4);
}

function parseHash(){
	// See what we have for a hash and update the CONFIG if appropriate
	var tokens = window.location.href.split('#');
	if (tokens.length == 2){
	    var subtokens = tokens[1].split("/");
	    var vtectokens = subtokens[0].split("-");
	    if (vtectokens.length == 7){
	    	CONFIG.year = parseInt(vtectokens[0]);
	    	CONFIG.wfo = vtectokens[3];
	    	CONFIG.phenomena = vtectokens[4];
	    	CONFIG.significance = vtectokens[5];
	    	CONFIG.etn = parseInt(vtectokens[6]);
	    }
	    if (subtokens.length > 1){
            var radartokens = subtokens[1].split("-");
            if (radartokens.length == 3){
                CONFIG.radar = radartokens[0];
                CONFIG.radarProduct = radartokens[1];
                CONFIG.radarProductTime = Date.parseDate(radartokens[2],'YmdHi');
            }
	    }
	}
}

function readHTMLForm(){
	// See what the user has set
	CONFIG.year = parseInt($("#year").val());
	CONFIG.wfo = $("#wfo").val();
	CONFIG.phenomena = $("#phenomena").val();
	CONFIG.significance = $("#significance").val();
	CONFIG.etn = parseInt($("#etn").val());
	
}

function make_iem_tms(title, layername, visible, type){
    return new ol.layer.Tile({
            title : title,
            visible: visible,
            type: type,
            source : new ol.source.XYZ({
                    url : '/c/tile.py/1.0.0/'+layername+'/{z}/{x}/{y}.png'
            })
    })
}

function getRADARSource(){
    var dt = radartimes[$("#timeslider").slider("value")];
    if (dt === undefined){
        return new ol.source.XYZ({
            url: '/cache/tile.py/1.0.0/ridge::USCOMP-N0Q-0/{z}/{x}/{y}.png'
        });
    }
    radarTMSLayer.set('title', '@ '+ dt.format());
    var src = $("#radarsource").val();
    var prod = $("#radarproduct").val();
    var url = '/cache/tile.py/1.0.0/ridge::'+src+'-'+prod+'-'+dt.utc().format('YMMDDHHmm')+'/{z}/{x}/{y}.png';
    console.log("radarTMSLayer source url now: " + url);
    return new ol.source.XYZ({
            url: url
    });
}


function buildMap(){
	// Build up the mapping
	radarTMSLayer = new ol.layer.Tile({
        title: 'NEXRAD Base Reflectivity',
        source: getRADARSource()
	});
	productVectorCountyLayer = new ol.layer.Vector({
		title: 'VTEC Product Geometry',
		style: function(feature, resolution){
			return [new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: '#000000',
					width: 2
				})
			})];
		},
		source: new ol.source.Vector({
			format: new ol.format.GeoJSON()
		})
	});

	productVectorPolygonLayer = new ol.layer.Vector({
		title: 'VTEC Product Polygon',
		style: function(feature, resolution){
			console.log(feature.get('phenomena'));
            sbwStyle[1].getStroke().setColor(sbwLookup[feature.get('phenomena')]);
            return sbwStyle;
		},
		source: new ol.source.Vector({
			format: new ol.format.GeoJSON()
		})
	});

	olmap = new ol.Map({
		target: 'map',
		view: new ol.View({
			enableRotation: false,
			center: ol.proj.transform([-94.5, 42.1], 'EPSG:4326', 'EPSG:3857'),
			zoom: 7
		}),
		layers : [
			new ol.layer.Tile({
				title : 'OpenStreetMap',
				visible : true,
				source : new ol.source.OSM()}),
			radarTMSLayer,
			make_iem_tms('US States', 's-900913', true, ''),
			productVectorCountyLayer,
			productVectorPolygonLayer]
	});
    var layerSwitcher = new ol.control.LayerSwitcher();
    olmap.addControl(layerSwitcher);
    
    olmap.on('moveend', function(){
    	console.log('map moveend event');
    });
}
function updateRADARTimeSlider(){
	// operation=list&product=N0Q&radar=USCOMP&start=2012-01-23T08%3A10Z&end=2012-01-23T08%3A45Z
	$.ajax({
		data: {
			radar: $("#radarsource").val(),
			product: $("#radarproduct").val(),
			start: CONFIG.issue.utc().format(),
			end: CONFIG.expire.utc().format(),
			operation: 'list'
		},
		url: '/json/radar',
		method: 'GET',
		dataType: 'json',
		success: function(data){
			// remove previous options
			radartimes = [];
			$.each(data.scans, function(idx, scan){
				radartimes.push(moment(scan.ts));
			});
			$("#timeslider").slider("option", "max", radartimes.length).slider('value', 0);
		}
	});
	
}
function updateRADARProducts(){
	// operation=products&radar=USCOMP&start=2012-01-23T08%3A10Z
	$.ajax({
		data: {
			radar: $("#radarsource").val(),
			start: (CONFIG.issue != null) ? CONFIG.issue.utc().format(): '',
			operation: 'products'
		},
		url: '/json/radar',
		method: 'GET',
		dataType: 'json',
		success: function(data){
			// remove previous options
			$("#radarproduct").empty();
			$.each(data.products, function(idx, product){
				$("#radarproduct").append('<option value="'+ product.id + '">' + product.name + '</option>');
			});
			// step3
			updateRADARTimeSlider();
		}
	});
}
function updateRADARSources(){
	//Update the Time Slider for the NEXRAD products available
	// /json/radar to get radars, products, then scans
	// Use these x, y coordinates to drive our RADAR availablility work
	var center = ol.proj.transform(olmap.getView().getCenter(),
			'EPSG:3857', 'EPSG:4326');
	$.ajax({
		data: {
			lat: center[1],
			lon: center[0],
			start: (CONFIG.issue != null) ? CONFIG.issue.utc().format(): '',
			operation: 'available'
		},
		url: '/json/radar',
		method: 'GET',
		dataType: 'json',
		success: function(data){
			// remove previous options
			$("#radarsource").empty();
			$.each(data.radars, function(idx, radar){
				$("#radarsource").append('<option value="'+ radar.id + '">' + radar.name + '</option>');
			});
			// step2
			updateRADARProducts();
		}
	});	
}
function getVTECGeometry(){
	// After the initial metadata is fetched, we get the geometry
	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			etn: CONFIG.etn,
			year: CONFIG.year,
			sbw: 0,
			lsrs: 0
		},
		url: "/geojson/vtec_event.py",
		method: "GET",
		dataType: "json",
		success: function(geodata){
			// The below was way painful on how to get the EPSG 4326 data
			// to load
			var format = new ol.format.GeoJSON({
				featureProjection: "EPSG:3857"
			});
			var vectorSource = new ol.source.Vector({
				features: format.readFeatures(geodata)
			});
			productVectorCountyLayer.setSource(vectorSource);
			var e = productVectorCountyLayer.getSource().getExtent();
			x = (e[2] + e[0]) / 2.;
			y = (e[3] + e[1]) / 2.;
			olmap.getView().setCenter([x, y]);
			updateRADARSources();
		}
	});
	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			etn: CONFIG.etn,
			year: CONFIG.year,
			sbw: 1,
			lsrs: 0
		},
		url: "/geojson/vtec_event.py",
		method: "GET",
		dataType: "json",
		success: function(geodata){
			// The below was way painful on how to get the EPSG 4326 data
			// to load
			var format = new ol.format.GeoJSON({
				featureProjection: "EPSG:3857"
			});
			var vectorSource = new ol.source.Vector({
				features: format.readFeatures(geodata)
			});
			productVectorPolygonLayer.setSource(vectorSource);
		}
	});
	// All LSRs
	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			etn: CONFIG.etn,
			year: CONFIG.year,
			sbw: 0,
			lsrs: 1
		},
		url: "/geojson/vtec_event.py",
		method: "GET",
		dataType: "json",
		success: function(geodata){
			lsrTable.clear();
			$.each(geodata.features, function(idx, feat){
				prop = feat.properties;
				lsrTable.row.add([prop.utc_valid, prop.event,
					prop.magnitude, prop.city, prop.county]);		
			});
			lsrTable.draw();
		}
	});
	// SBW LSRs
	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			etn: CONFIG.etn,
			year: CONFIG.year,
			sbw: 1,
			lsrs: 1
		},
		url: "/geojson/vtec_event.py",
		method: "GET",
		dataType: "json",
		success: function(geodata){
			sbwLsrTable.clear();
			$.each(geodata.features, function(idx, feat){
				prop = feat.properties;
				sbwLsrTable.row.add([prop.utc_valid, prop.event,
					prop.magnitude, prop.city, prop.county]);		
			});
			sbwLsrTable.draw();
		}
	});
}

function loadTabs(){
	// OK, lets load up the tab content
	var vstring = CONFIG.year +".O.NEW."+ CONFIG.wfo +"."+ CONFIG.phenomena +
		"."+ CONFIG.significance +"." + CONFIG.etn.padLeft(4);
	var vstring2 = CONFIG.year +"."+ CONFIG.wfo +"."+ CONFIG.phenomena +
		"."+ CONFIG.significance +"." + CONFIG.etn.padLeft(4);
	$("#radarmap").html("<img src=\"/GIS/radmap.php?layers[]=nexrad&"+
			"layers[]=sbw&layers[]=sbwh&layers[]=uscounties&"+
			"vtec="+vstring+"\" class=\"img img-responsive\">");
	$("#sbwhistory").html("<img src=\"/GIS/sbw-history.php?vtec="+ vstring2 +
			"\" class=\"img img-responsive\">");
	
	$("#vtec_label").html(CONFIG.year + " " + $("#wfo option:selected").text()
			+ " " + $("#phenomena option:selected").text()
			+ " " + $("#significance option:selected").text()
			+ " Number " + $("#etn").val());
	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			etn: CONFIG.etn,
			year: CONFIG.year
		},
		url: "/json/vtec_event.py",
		method: "GET",
		dataType: "json",
		success: function(data){
			$("#textdata").html("<pre>"+ data.report +"</pre>");
			ugcTable.clear();
			$.each(data.ugcs, function(idx, ugc){
				ugcTable.row.add([ugc.ugc, ugc.name, ugc.status,
					ugc.utc_product_issue, ugc.utc_issue,
					ugc.utc_init_expire, ugc.utc_expire]);		
			});
			ugcTable.draw();
			CONFIG.issue = moment(data.utc_issue);
			CONFIG.expire = moment(data.utc_expire);
			getVTECGeometry();
		}
	});

	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			year: CONFIG.year
		},
		url: "/json/vtec_events.py",
		method: "GET",
		dataType: "json",
		success: function(data){
			eventTable.clear();
			$.each(data.events, function(idx, vtec){
				eventTable.row.add([vtec.eventid, vtec.product_issue, vtec.issue,
					vtec.init_expire, vtec.expire, vtec.area, vtec.locations]);		
			});
			eventTable.draw();
		}
	});
	updateHash();
}

function buildUI(){
	// build the UI components
	var html = "";
	$.each(iemdata.wfos, function(idx, arr){
		html += "<option value=\""+arr[0]+"\">["+arr[0]+"] "+ arr[1] +"</option>";
	});
	$("#wfo").append(html);
	$("#wfo option[value='" + CONFIG.wfo + "']").prop('selected', true)

	var html = "";
	$.each(iemdata.vtec_phenomena_dict, function(idx, arr){
		html += "<option value=\""+arr[0]+"\">"+ arr[1] +" ("+arr[0]+")</option>";
	});
	$("#phenomena").append(html);
	$("#phenomena option[value='" + CONFIG.phenomena + "']").prop('selected', true)

	var html = "";
	$.each(iemdata.vtec_sig_dict, function(idx, arr){
		html += "<option value=\""+arr[0]+"\">"+ arr[1] +" ("+arr[0]+")</option>";
	});
	$("#significance").append(html);
	$("#significance option[value='" + CONFIG.significance + "']").prop('selected', true)

	var html = "";
	for (var year=1986; year <= (new Date()).getFullYear(); year++){
		html += "<option value=\""+year+"\">"+ year +"</option>";		
	}
	$("#year").append(html);
	$("#year option[value='" + CONFIG.year + "']").prop('selected', true)

	$("#etn").val(CONFIG.etn);
	$("#myform-submit").click(function(){
		readHTMLForm();
		loadTabs();
		$(this).blur();
	});
	ugcTable = $("#ugctable").DataTable();
	lsrTable = $("#lsrtable").DataTable();
	sbwLsrTable = $("#sbwlsrtable").DataTable();

	eventTable = $("#eventtable").DataTable();
	$('#eventtable tbody').on('click', 'tr', function () {
        var data = eventTable.row( this ).data();
        if (data[0] == CONFIG.etn) return;
        CONFIG.etn = data[0];
        loadTabs();
        // Switch to the details tab after the click
        $('#event_tab').trigger('click');
    });

	$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
		  var target = $(e.target).attr("href") // activated tab
		  if (target == "#themap"){
			  olmap.updateSize();
		  }
		});
	$("#timeslider").slider({
		min: 0,
		max: 100,
        change: function( event, ui ) {
        	console.log("timeslider#change called('" + ui.value + "')...");
        	$("#radartime").html(radartimes[ui.value].format());
        	radarTMSLayer.setSource(getRADARSource());
        }
	});
	$("#radarsource").change(function(){
		updateRADARProducts();
	});
	$("#radarproduct").change(function(){
		// we can safely(??) assume that radartimes does not update when we
		// switch products
    	radarTMSLayer.setSource(getRADARSource());
	});
}

$(function(){
	//onReady
	try{
		parseHash();
	} catch(err) {};
	buildUI();
	buildMap();
	loadTabs();
});