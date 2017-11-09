// Functionality to replicate
// var CONFIG is set in the base HTML page
// previous hashlinking looks like 2017-O-NEW-KALY-WI-Y-0015

var olmap;
var productVectorLayer;

Number.prototype.padLeft = function (n,str){
    return Array(n-String(this).length+1).join(str||'0')+this;
}

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


function buildMap(){
	// Build up the mapping
	productVectorLayer = new ol.layer.Vector({
		title: 'VTEC Product',
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
			make_iem_tms('US States', 's-900913', true, ''),
			productVectorLayer]
	});
    var layerSwitcher = new ol.control.LayerSwitcher();
    olmap.addControl(layerSwitcher);
    
    olmap.on('moveend', function(){
    	console.log('hi');
    });
}
function loadTabs(){
	// OK, lets load up the tab content
	var vstring = CONFIG.year +"."+ CONFIG.wfo +"."+ CONFIG.phenomena +
		"."+ CONFIG.significance +"." + CONFIG.etn;
	$("#radarmap").html("<img src=\"/GIS/radmap.php?layers[]=nexrad&"+
			"layers[]=sbw&layers[]=sbwh&layers[]=uscounties&"+
			"vtec=2012.O.NEW.KBMX.TO.W.0001\" class=\"img img-responsive\">");
	$("#sbwhistory").html("<img src=\"/GIS/sbw-history.php?vtec="+ vstring +
			"\" class=\"img img-responsive\">");
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
			var dt = $("#ugctable").DataTable();
			dt.clear();
			$.each(data.ugcs, function(idx, ugc){
				dt.row.add([ugc.ugc, ugc.name, ugc.status,
					ugc.utc_product_issue, ugc.utc_issue,
					ugc.utc_init_expire, ugc.utc_expire]);		
			});
			dt.draw();
		}
	});

	$.ajax({
		data: {
			wfo: CONFIG.wfo,
			phenomena: CONFIG.phenomena,
			significance: CONFIG.significance,
			etn: CONFIG.etn,
			year: CONFIG.year
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
			productVectorLayer.setSource(vectorSource);
			var e = productVectorLayer.getSource().getExtent();
			x = (e[2] + e[0]) / 2.;
			y = (e[3] + e[1]) / 2.;
			olmap.getView().setCenter([x, y]);
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
			var dt = $("#eventtable").DataTable();
			dt.clear();
			$.each(data.events, function(idx, vtec){
				dt.row.add([vtec.eventid, vtec.product_issue, vtec.issue,
					vtec.init_expire, vtec.expire, vtec.area, vtec.locations]);		
			});
			dt.draw();
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
	$("#ugctable").DataTable();
	$("#eventtable").DataTable();

	$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
		  var target = $(e.target).attr("href") // activated tab
		  if (target == "#themap"){
			  olmap.updateSize();
		  }
		});
	$("#timeslider").slider({
		min: 0,
		max: 100,
        slide: function( event, ui ) {
        }
	}).slider("pips").slider("float");
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