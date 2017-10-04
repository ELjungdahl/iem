<?php
require_once "../../config/settings.inc.php";
require_once "../../include/myview.php";
$t = new MyView();
$t->thispage = "severe-vtec";
$t->title = "Valid Time Extent Code (VTEC) App";

$v = isset($_GET["vtec"]) ? $_GET["vtec"] : "2012-O-NEW-KBMX-TO-W-0001";
$tokens = preg_split('/-/', $v);
$year = $tokens[0];
$operation = $tokens[1];
$vstatus = $tokens[2];
$wfo4 = $tokens[3];
$wfo = substr($wfo4,1,3);
$phenomena = $tokens[4];
$significance = $tokens[5];
$etn = intval($tokens[6]);

$t->headextra = <<<EOM
<link rel="stylesheet" href="/vendor/jquery-datatables/1.10.16/datatables.min.css" />
<link rel="stylesheet" href="/vendor/jquery-ui/1.11.4/jquery-ui.min.css" />
<link rel="stylesheet" href="vtec_static.css" />
EOM;
$t->jsextra = <<<EOM
<script src="/vendor/jquery-datatables/1.10.16/datatables.min.js"></script>
<script src="/vendor/jquery-ui/1.11.4/jquery-ui.js"></script>
<script type="text/javascript" src="vtec_static.js"></script>
<script>
var CONFIG = {
  year: {$year},
  wfo: "{$wfo}",
  phenomena: "{$phenomena}",
  significance: "{$significance}",
  etn: "{$etn}"
};
</script>
<script type="text/javascript" src="vtec_app.js"></script>
EOM;

$theform = <<<EOM
<form name="control" id="myform">

<p><strong>Find VTEC Product:</strong></p>

<div class="form-group">
<label for="wfo">Select Forecast Office</label>
<select name="wfo" id="wfo" class="form-control"></select>
</div>

<div class="form-group">
<label for="phenomena">Phenomena</label>
<select name="phenomena" id="phenomena" class="form-control"></select>
</div>

<div class="form-group">
<label for="significance">Significance</label>
<select name="significance" id="significance" class="form-control"></select>
</div>

<div class="form-group">
<label for="etn">Event Number</label>
<input type="text" name="etn" id="etn" class="form-control" maxlength="4">
</div>

<div class="form-group">
<label for="year">Event Year</label>
<select name="year" id="year" class="form-control"></select>
</div>


<p><button type="button" id="myform-submit" class="btn btn-default"><i class="fa fa-search"></i> Load Product</button></p>

</form>

EOM;

$helpdiv = <<<EOM
<div id="help">
 <h2>IEM VTEC Product Browser 4.0</h2>

 <p>This application allows easy navigation of National Weather Service
issued products with Valid Time Extent Coding (VTEC).</p>

<p style="margin-top: 10px;"><b>Tab Functionality:</b>
<br /><i>Above this section, you will notice 9 selectable tabs. Click on 
the tab to show the information.</i>
<br /><ul>
 <li><b>Help:</b>  This page!</li>
 <li><b>RADAR Map:</b>  Simple map displaying the product geography.</li>
 <li><b>Text Data:</b>  The raw text based products issued by the National Weather Service.  Any follow-up products are included as well.</li>
 <li><b>Google Map:</b>  Product and Storm Reports over Google Maps.</li>
 <li><b>SBW History:</b>  Displays changes in storm based warnings.</li>
 <li><b>Storm Reports within SBW:</b>  Storm Reports inside Storm Based Warning.</li>
 <li><b>All Storm Reports:</b>  Any Storm Reports during the time of the product for the issuing office.</li>
 <li><b>Geography Included:</b>  Counties/Zones affected by this product.</li>
 <li><b>List Events:</b>  List all events of the given phenomena, significance, year, and issuing office.</li>
</ul>
</div>
EOM;

$ugcdiv = <<<EOM

<table id="ugctable">
<thead>
<tr>
 <th>UGC</th>
 <th>Name</th>
 <th>Status</th>
 <th>Issuance</th>
 <th>Issue</th>
 <th>Initial Expire</th>
 <th>Expire</th>
</tr>
</thead>
<tbody>

</tbody>
</table>

EOM;

$eventsdiv = <<<EOM

<table id="eventtable">
<thead>
<tr>
 <th>ID</th>
</tr>
</thead>
<tbody>

</tbody>
</table>

EOM;

$t->content = <<<EOF

<div class="clearfix">&nbsp;</div>

<div class="row">
  <div class="col-md-3 well">
    {$theform}
  </div><!-- ./col-md-3 -->
  <div class="col-md-9">

<div class="panel with-nav-tabs panel-default" id="thetabs">
    <div class="panel-heading">
      <ul class="nav nav-tabs">
         <li class="active"><a href="#help" data-toggle="tab">Help</a></li>
         <li><a href="#radarmap" data-toggle="tab">RADAR Map</a></li>
         <li><a href="#textdata" data-toggle="tab">Text Data</a></li>
         <li><a href="#googlemap" data-toggle="tab">Google Map</a></li>
         <li><a href="#sbwhistory" data-toggle="tab">SBW History</a></li>
         <li><a href="#stormreports" data-toggle="tab">Storm Reports within SBW</a></li>
         <li><a href="#geo" data-toggle="tab">Geography Included</a></li>
         <li><a href="#listevents" data-toggle="tab">List Events</a></li>
      </ul>
    </div><!-- ./panel-heading -->
    <div class="panel-body">
     <div class="tab-content clearfix">

       <div class="tab-pane active" id="help">{$helpdiv}</div><!-- ./help -->
       <div class="tab-pane" id="radarmap">RADAR MAP</div><!-- ./radarmap -->
       <div class="tab-pane" id="textdata">Text Data</div><!-- ./textdata -->
       <div class="tab-pane" id="googlemap">Google MAP</div><!-- ./googlemap -->
       <div class="tab-pane" id="sbwhistory">SBW History</div><!-- ./sbwhistory -->
       <div class="tab-pane" id="stormreports">Storm Reports</div><!-- ./stormreports -->
       <div class="tab-pane" id="geo">{$ugcdiv}</div><!-- ./geo -->
       <div class="tab-pane" id="listevents">{$eventsdiv}</div><!-- ./listevents -->
    </div><!-- ./tab-content -->
    </div><!-- ./panel-body -->
  </div><!-- ./col-md-9 -->
</div><!-- ./row -->


EOF;
$t->render('full.phtml');
?>
