"""Fetch me the NARR

Appears that data for the previous month is available by the 9th of current mon

    called from RUN_2AM.sh
"""
from __future__ import print_function
import sys
import os
import glob
import datetime
import subprocess

import requests
import pygrib
from pyiem.util import get_properties

TMP = "/mesonet/tmp"


def process(tarfn):
    """Process this tarfn"""
    os.chdir(TMP)
    subprocess.call("tar -xf %s" % (tarfn, ), shell=True)
    for grbfn in glob.glob("merged_AWIP32*sfc"):
        grbs = pygrib.open(grbfn)
        for grb in grbs.select(parameterName='204', stepType='avg'):
            dt = grb['dataDate']
            hr = int(grb['dataTime']) / 100
            ts = datetime.datetime.strptime("%s %s" % (dt, hr),
                                            "%Y%m%d %H")
            fn = "rad_%s.grib" % (ts.strftime("%Y%m%d%H%M"), )
            fh = open(fn, 'wb')
            fh.write(grb.tostring())
            fh.close()

            cmd = ("/home/ldm/bin/pqinsert -p 'data a %s bogus "
                   "model/NARR/rad_%s.grib grib' %s"
                   ) % (ts.strftime("%Y%m%d%H%M"),
                        ts.strftime("%Y%m%d%H%M"), fn)
            subprocess.call(cmd, shell=True)
            # print("grbfn: %s fn: %s" % (grbfn, fn))
            os.remove(fn)
        os.remove(grbfn)


def fetch_rda(year, month):
    """Get data please from RDA"""
    props = get_properties()
    req = requests.post('https://rda.ucar.edu/cgi-bin/login',
                        dict(email=props['rda.user'],
                             passwd=props['rda.password'],
                             action='login'),
                        timeout=30)
    if req.status_code != 200:
        print("download_narr RDA login failed with code %s" % (
            req.status_code,))
        return
    cookies = req.cookies

    days = ['0109', '1019']
    lastday = (datetime.date(year, month, 1) + datetime.timedelta(days=35)
               ).replace(day=1) - datetime.timedelta(days=1)
    days.append("20%s" % (lastday.day, ))
    for day in days:
        uri = ("https://rda.ucar.edu/data/ds608.0/3HRLY/"
               "%i/NARRsfc_%i%02i_%s.tar"
               ) % (year, year, month, day)
        req = requests.get(uri, timeout=30, cookies=cookies, stream=True)
        tmpfn = "%s/narr.tar" % (TMP, )
        with open(tmpfn, 'wb') as fh:
            for chunk in req.iter_content(chunk_size=1024):
                if chunk:
                    fh.write(chunk)
        process(tmpfn)
        os.unlink(tmpfn)

    # Now call coop script
    subprocess.call(("python /opt/iem/scripts/coop/narr_solarrad.py %s %s"
                     ) % (year, month), shell=True)

def main(argv):
    """Go Main Go"""
    year = int(argv[1])
    month = int(argv[2])
    fetch_rda(year, month)


if __name__ == '__main__':
    main(sys.argv)
