<?php 
// List out HPD data for a date and station of your choice
require_once "../../config/settings.inc.php";
define("IEM_APPID", 91);
require_once "../../include/myview.php";
require_once "../../include/imagemaps.php";
require_once "../../include/forms.php";
require_once "../../include/database.inc.php";

$station = isset($_GET["station"]) ? xssafe($_GET['station']): null;
$year = isset($_GET["year"]) ? intval($_GET["year"]): date("Y");
$month = isset($_GET["month"]) ? intval($_GET["month"]): date("m");
$day = isset($_GET["day"]) ? intval($_GET["day"]): date("d");

$yselect = yearSelect2(2008, $year, "year");
$mselect = monthSelect2($month, "month");
$dselect = daySelect2($day, "day");

$table = "<p>Please select a station and date.</p>";
if ($station){
	$dbconn = iemdb('other');
	$rs = pg_prepare($dbconn, "SELECT", "select * from hpd_alldata
			WHERE station = $1 and valid >= $2 and valid < $3
			ORDER by valid ASC");
	$valid = mktime(0, 0, 0, $month, $day, $year);
	$sts = date("Y-m-d 00:00", $valid);
	$ets = date("Y-m-d 23:59", $valid);
	$rs = pg_execute($dbconn, "SELECT", Array($station, $sts, $ets));
	$table = '<table class="table table-striped"><tr><th>Valid</th><th>Precip</th><th>Counter</th><th>Temp C</th><th>Battery</th></tr>';
	for($i=0;$row=@pg_fetch_assoc($rs,$i);$i++){
		$table .= sprintf("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>",
				$row["valid"], $row["calc_precip"], $row["counter"],
				$row["tmpc"], $row["battery"]);
	}
	$table .= "</table>";
}

$t = new MyView();
$t->title = "COOP HPD FisherPorter Precip";

$sselect = networkSelect("IA_HPD", $station);
$t->content = <<<EOF
<ol class="breadcrumb">
<li><a href="/COOP/">COOP Data</a></li>
<li class="active">Fisher Porter Rain Gauge Data</li>
</ol>

<p>The IEM maintains an archive of processed rain gauge data from the "Fisher Porter"
equipment that is run at some NWS COOP locations in Iowa.  There is considerable
delay to the availability of this data from
<a href="https://www1.ncdc.noaa.gov/pub/data/hpd/data/">NCEI</a>.  Currently, a process
runs on the 15th each month and downloads data for the previous 3rd, 6th, and 12th month
to the current date.</p>

<form method="GET" name="st">
		<table class="table table-bordered">
		<tr><th>Select Station:</th><th>Select Date</th></tr>
		<tr><td>{$sselect}</td><td>{$yselect} {$mselect} {$dselect}</td></tr>
		<tr><td colspan="2"><input type="submit"></td></tr>
		</table>
		</form>

		
		{$table}
		
EOF;
$t->render('single.phtml');

?>