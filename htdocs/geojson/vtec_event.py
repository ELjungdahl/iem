#!/usr/bin/env python
"""GeoJSON source for VTEC event"""
import cgi
import sys
import json
import datetime

import memcache
import psycopg2.extras


def run(wfo, year, phenomena, significance, etn):
    """Do great things"""
    pgconn = psycopg2.connect(database='postgis', host='iemdb', user='nobody')
    cursor = pgconn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    table = "warnings_%s" % (year,)
    cursor.execute("""
    SELECT
    w.ugc,
    ST_asGeoJson(u.geom) as geojson,
    issue at time zone 'UTC' as utc_issue,
    init_expire at time zone 'UTC' as utc_init_expire
    from """+table+""" w JOIN ugcs u on (w.gid = u.gid)
    WHERE w.wfo = %s and eventid = %s and
    phenomena = %s and significance = %s
    """, (wfo, etn, phenomena, significance))
    res = {'type': 'FeatureCollection',
           'crs': {'type': 'EPSG',
                   'properties': {'code': 4326, 'coordinate_order': [1, 0]}},
           'features': [],
           'generation_time': datetime.datetime.utcnow().strftime(
               "%Y-%m-%dT%H:%M:%SZ"),
           'count': cursor.rowcount}
    for row in cursor:
        res['features'].append(dict(type="Feature",
                                    id=row['ugc'],
                                    properties=dict(),
                                    geometry=json.loads(row['geojson'])
                                    ))

    return json.dumps(res)


def main():
    """Main()"""
    sys.stdout.write("Content-type: application/vnd.geo+json\n\n")

    form = cgi.FieldStorage()
    wfo = form.getfirst("wfo", "MPX")
    if len(wfo) == 4:
        wfo = wfo[1:]
    year = int(form.getfirst("year", 2015))
    phenomena = form.getfirst('phenomena', 'SV')[:2]
    significance = form.getfirst('significance', 'W')[:1]
    etn = int(form.getfirst('etn', 1))
    cb = form.getfirst("callback", None)

    mckey = "/geojson/vtec_event/%s/%s/%s/%s/%s" % (wfo, year, phenomena,
                                                    significance, etn)
    mc = memcache.Client(['iem-memcached:11211'], debug=0)
    res = mc.get(mckey)
    if not res:
        res = run(wfo, year, phenomena, significance, etn)
        mc.set(mckey, res, 3600)

    if cb is None:
        sys.stdout.write(res)
    else:
        sys.stdout.write("%s(%s)" % (cb, res))


if __name__ == '__main__':
    main()
