// Functionality to replicate
// var CONFIG is set in the base HTML page
// previous hashlinking looks like 2017-O-NEW-KALY-WI-Y-0015

var olmap;
var productVectorCountyLayer;
var productVectorPolygonLayer;
var sbwIntersectionLayer;
var radarTMSLayer;
var radartimes = [];
var eventTable;
var ugcTable;
var lsrTable;
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

var sbwIntersectionStyle = [new ol.style.Style({
	stroke: new ol.style.Stroke({
		color: '#551A8B',
		width: 10
	})
	})
];

function urlencode(){
	// Make our CONFIG object a URI
	var uri = "?";
	uri += "year=" + CONFIG.year;
	uri += "phenomena=" + CONFIG.phenomena;
	uri += "significance=" + CONFIG.significance;
	uri += "eventid=" + CONFIG.etn;
	uri += "wfo="+ CONFIG.wfo;
	return uri;
}

//https://stackoverflow.com/questions/2044616
function selectElementContents(elid) {
        var el = document.getElementById(elid);
        var body = document.body, range, sel;
    if (document.createRange && window.getSelection) {
        range = document.createRange();
        sel = window.getSelection();
        sel.removeAllRanges();
        try {
            range.selectNodeContents(el);
            sel.addRange(range);
        } catch (e) {
            range.selectNode(el);
            sel.addRange(range);
        }
        document.execCommand("copy");
    } else if (body.createTextRange) {
        range = body.createTextRange();
        range.moveToElementText(el);
        range.select();
        range.execCommand("Copy");
    }
}



function updateHash(){
	// Set the hashlink as per our current CONFIG
	var href = "#" + CONFIG.year +"-O-NEW-"+
    CONFIG.wfo +"-"+ CONFIG.phenomena +"-"+
    CONFIG.significance +"-"+
    CONFIG.etn.padLeft(4);
	if (CONFIG.radarProductTime != null && CONFIG.radarProduct != null &&
			CONFIG.radar != null){
		href += "/" + CONFIG.radar + "-" + CONFIG.radarProduct +
		"-" + CONFIG.radarProductTime.utc().format('YMMDDHHmm');
	}
	window.location.href = href;
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
                console.log("setting radarProducTime from parseHash()");
                CONFIG.radarProductTime = moment.utc(radartokens[2],
                		'YYYYMMDDHHmm');
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

	sbwIntersectionLayer = new ol.layer.Vector({
		title: 'SBW County Intersection',
		style: sbwIntersectionStyle,
		source: new ol.source.Vector({
			format: new ol.format.GeoJSON()
		})
	});

	
	productVectorPolygonLayer = new ol.layer.Vector({
		title: 'VTEC Product Polygon',
		style: function(feature, resolution){
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
			sbwIntersectionLayer,
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
			if (CONFIG.radarProductTime == null && radartimes.length > 0){
				CONFIG.radarProducTime = radartimes[0];
			}
			var idx = 0;
			$.each(radartimes, function(i, rt){
				if (rt.isSame(CONFIG.radarProductTime)){
					idx = i;
				};
			});
			$("#timeslider").slider("option", "max", radartimes.length).slider('value', idx);
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
			if (CONFIG.radarProduct){
				$("#radarproduct").val(CONFIG.radarProduct);
			} else {
				CONFIG.radarProduct = $("#radarproduct").val();
			}
			// step3
			updateRADARTimeSlider();
		}
	});
}
function updateRADARSources(){
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
			if (CONFIG.radar){
				$("#radarsource").val(CONFIG.radar);
			} else {
				CONFIG.radar = $("#radarsource").val();
			}
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
	// Intersection
	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			eventid: CONFIG.etn,
			year: CONFIG.year
		},
		url: "/geojson/sbw_county_intersect.php",
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
			sbwIntersectionLayer.setSource(vectorSource);
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
				lsrTable.row.add(prop);		
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
				sbwLsrTable.row.add(prop);		
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
function remarkformat(d){
    
    // `d` is the original data object for the row
    return '<div style="margin-left: 10px;"><strong>Remark:</strong> ' + d.remark + '</div>';
}
function makeLSRTable(div){
	var table = $("#"+div).DataTable({
		select:"single",
        "columns": [
            {
                "className": 'details-control',
                "orderable": false,
                "data": null,
                "defaultContent": '',
                "render": function () {
                    return '<i class="fa fa-plus-square" aria-hidden="true"></i>';
                },
                width:"15px"
            },
            { "data": "utc_valid" },
            { "data": "event" },
            { "data": "magnitude" },
            { "data": "city" },
            { "data": "county" },
            {"data": "remark", visible: false}
        ],
        "order": [[1, 'asc']]
	});
    // Add event listener for opening and closing details
    $('#'+div+' tbody').on('click', 'td.details-control', function () {
        var tr = $(this).closest('tr');
        var tdi = tr.find("i.fa");
        var row = table.row(tr);

        if (row.child.isShown()) {
            // This row is already open - close it
            row.child.hide();
            tr.removeClass('shown');
            tdi.first().removeClass('fa-minus-square');
            tdi.first().addClass('fa-plus-square');
        }
        else {
            // Open this row
            row.child(remarkformat(row.data())).show();
            tr.addClass('shown');
            tdi.first().removeClass('fa-plus-square');
            tdi.first().addClass('fa-minus-square');
        }
    });

    table.on("user-select", function (e, dt, type, cell, originalEvent) {
        if ($(cell.node()).hasClass("details-control")) {
            e.preventDefault();
        }
    });
    return table;
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
	lsrTable = makeLSRTable("lsrtable");
	sbwLsrTable = makeLSRTable("sbwlsrtable");

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
        	console.log("setting radarProductTime");
        	CONFIG.radarProductTime = radartimes[ui.value];
        	$("#radartime").html(radartimes[ui.value].format());
        	radarTMSLayer.setSource(getRADARSource());
    		updateHash();
        }
	});
	$("#radarsource").change(function(){
		CONFIG.radar = $("#radarsource").val();
		updateRADARProducts();
		updateHash();
	});
	$("#radarproduct").change(function(){
		// we can safely(??) assume that radartimes does not update when we
		// switch products
		CONFIG.radarProduct = $("#radarproduct").val();
    	radarTMSLayer.setSource(getRADARSource());
    	updateHash();
	});
	$("#lsr_kml_button").click(function(){
		window.location.href = "/kml/sbw_lsrs.php?" + urlencode();
	});
	$("#warn_kml_button").click(function(){
		window.location.href = "/kml/vtec.php?" + urlencode();
	});
	$("#ci_kml_button").click(function(){
		window.location.href = "/kml/sbw_county_intersect.php?" + urlencode();
	});
	$("#gr_button").click(function(){
		window.location.href = "/request/grx/vtec.php?" + urlencode();
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