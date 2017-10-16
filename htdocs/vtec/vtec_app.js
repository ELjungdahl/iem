// Functionality to replicate
// [ ] RADAR Map
// [ ] Text Data
//     [ ] print function
// [ ] Google Map
//     [ ] overlay LSRs with popup details
//     [ ] select RADAR, product, time, opacity
//     [ ] county intersection
// [ ] SBW History
// [ ] Storm Reports within SBW
// [ ] All Storm Reports
// [ ] Geography Included
// [ ] List Events

// var CONFIG is set in the base HTML page

var olmap;
var productVectorLayer;

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
		format: new ol.format.GeoJSON(),
		style: function(feature, resolution){
			console.log("style was called");
			console.log(feature);
		},
		source: new ol.source.Vector({
			projection: ol.proj.get('EPSG:4326')
		})
	});
	olmap = new ol.Map({
		target: 'map',
		view: new ol.View({
			enableRotation: false,
			projection: ol.proj.get('EPSG:3857'),
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
    // get the map to display properly
    setTimeout(function(){ olmap.updateSize(); }, 1500);
	
}
function loadTabs(){
	// OK, lets load up the tab content
	$("#radarmap").html("<img src=\"/GIS/radmap.php?layers[]=nexrad&"+
			"layers[]=sbw&layers[]=sbwh&layers[]=uscounties&"+
			"vtec=2012.O.NEW.KBMX.TO.W.0001\" class=\"img img-responsive\">");
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
			productVectorLayer.getSource().addFeatures(
				new ol.format.GeoJSON().readFeatures(geodata),
				{
					featureProjection: ol.proj.get('EPSG:3857')
			});
			var e = productVectorLayer.getSource().getExtent();
			x = (e[2] + e[0]) / 2.;
			y = (e[3] + e[1]) / 2.;
			olmap.getView().setCenter(ol.proj.transform([x, y], 'EPSG:4326',
					'EPSG:3857'));
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
				dt.row.add([vtec.eventid]);		
			});
			dt.draw();
		}
	});
	
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
		loadTabs();
		$(this).blur();
	});
	$("#ugctable").DataTable();
	$("#eventtable").DataTable();
	
}

$(function(){
	//onReady
	buildUI();
	buildMap();
	loadTabs();
});