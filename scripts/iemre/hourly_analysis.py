"""I produce the hourly analysis used by IEMRE"""
from __future__ import print_function
import sys
import datetime

import netCDF4
import numpy as np
import pytz
import pandas as pd
from pandas.io.sql import read_sql
from metpy.gridding.interpolation import inverse_distance
from pyiem import iemre
from pyiem import meteorology
from pyiem import reference
import pyiem.datatypes as dt
from pyiem.util import get_dbconn


def get_domain():
    """Return where we should be estimating"""
    nc = netCDF4.Dataset('/mesonet/data/iemre/state_weights.nc')
    nc.set_auto_mask(False)
    domain = nc.variables['domain'][:]
    nc.close()
    return domain


def grid_wind(df, domain):
    """
    Grid winds based on u and v components
    @return uwnd, vwnd
    """
    # compute components
    u = []
    v = []
    for _station, row in df.iterrows():
        (_u, _v) = meteorology.uv(dt.speed(row['sknt'], 'KT'),
                                  dt.direction(row['drct'], 'DEG'))
        u.append(_u.value("MPS"))
        v.append(_v.value("MPS"))
    df['u'] = u
    df['v'] = v
    ugrid = generic_gridder(df, 'u', domain)
    vgrid = generic_gridder(df, 'v', domain)
    return ugrid, vgrid


def grid_skyc(df, domain):
    """Hmmmm"""
    v = []
    for _station, row in df.iterrows():
        _v = max(row['max_skyc1'], row['max_skyc2'], row['max_skyc3'])
        v.append(_v)
    df['skyc'] = v
    return generic_gridder(df, 'skyc', domain)


def generic_gridder(df, idx, domain):
    """Generic gridding algorithm for easy variables"""
    df2 = df[pd.notnull(df[idx])]
    xi, yi = np.meshgrid(iemre.XAXIS, iemre.YAXIS)
    res = np.ones(xi.shape) * np.nan
    # set a sentinel of where we won't be estimating
    res = np.where(domain > 0, res, -9999)
    # do our gridding
    grid = inverse_distance(df2['lon'].values, df2['lat'].values,
                            df2[idx].values, xi, yi, 1.5)
    # replace nan values in res with whatever now is in grid
    res = np.where(np.isnan(res), grid, res)
    # Do we still have missing values?
    if np.isnan(res).any():
        # very aggressive with search radius
        grid = inverse_distance(df2['lon'].values, df2['lat'].values,
                                df2[idx].values, xi, yi, 5.5)
        # replace nan values in res with whatever now is in grid
        res = np.where(np.isnan(res), grid, res)
    # replace sentinel back to np.nan
    # replace sentinel back to np.nan
    res = np.where(res == -9999, np.nan, res)
    return np.ma.array(res, mask=np.isnan(res))


def grid_hour(nc, ts):
    """
    I proctor the gridding of data on an hourly basis
    @param ts Timestamp of the analysis, we'll consider a 20 minute window
    """
    domain = get_domain()
    ts0 = ts - datetime.timedelta(minutes=10)
    ts1 = ts + datetime.timedelta(minutes=10)
    offset = iemre.hourly_offset(ts)
    utcnow = datetime.datetime.utcnow()
    utcnow = (utcnow.replace(tzinfo=pytz.utc) -
              datetime.timedelta(hours=36))

    # If we are near realtime, look in IEMAccess instead of ASOS database
    mybuf = 2.
    params = (reference.MW_WEST - mybuf, reference.MW_SOUTH - mybuf,
              reference.MW_WEST - mybuf, reference.MW_NORTH + mybuf,
              reference.MW_EAST + mybuf, reference.MW_NORTH + mybuf,
              reference.MW_EAST + mybuf, reference.MW_SOUTH - mybuf,
              reference.MW_WEST - mybuf, reference.MW_SOUTH - mybuf,
              ts0, ts1)
    if utcnow < ts:
        dbconn = get_dbconn('iem', user='nobody')
        sql = """SELECT t.id as station, ST_x(geom) as lon,
        ST_y(geom) as lat,
 max(case when tmpf > -60 and tmpf < 130 THEN tmpf else null end) as max_tmpf,
 max(case when sknt > 0 and sknt < 100 then sknt else 0 end) as max_sknt,
 max(getskyc(skyc1)) as max_skyc1,
 max(getskyc(skyc2)) as max_skyc2,
 max(getskyc(skyc3)) as max_skyc3,
 max(case when phour > 0 and phour < 1000 then phour else 0 end) as phour,
 max(case when dwpf > -60 and dwpf < 100 THEN dwpf else null end) as max_dwpf,
 max(case when sknt >= 0 then sknt else 0 end) as sknt,
 max(case when sknt >= 0 then drct else 0 end) as drct
 from current_log s JOIN stations t on (s.iemid = t.iemid)
 WHERE ST_Contains(
  ST_GeomFromEWKT('SRID=4326;POLYGON((%s %s, %s  %s, %s %s, %s %s, %s %s))'),
  geom) and valid >= %s and valid < %s GROUP by station, lon, lat
         """
    else:
        dbconn = get_dbconn('asos', user='nobody')
        sql = """SELECT station, ST_x(geom) as lon, st_y(geom) as lat,
 max(case when tmpf > -60 and tmpf < 130 THEN tmpf else null end) as max_tmpf,
 max(case when sknt > 0 and sknt < 100 then sknt else 0 end) as max_sknt,
 max(getskyc(skyc1)) as max_skyc1,
 max(getskyc(skyc2)) as max_skyc2,
 max(getskyc(skyc3)) as max_skyc3,
 max(case when p01i > 0 and p01i < 1000 then p01i else 0 end) as phour,
 max(case when dwpf > -60 and dwpf < 100 THEN dwpf else null end) as max_dwpf,
 max(case when sknt >= 0 then sknt else 0 end) as sknt,
 max(case when sknt >= 0 then drct else 0 end) as drct
 from alldata a JOIN stations t on (a.station = t.id) WHERE
 ST_Contains(
  ST_GeomFromEWKT('SRID=4326;POLYGON((%s %s, %s  %s, %s %s, %s %s, %s %s))'),
  geom) and (t.network ~* 'ASOS' or t.network = 'AWOS') and
 valid >= %s and valid < %s GROUP by station, lon, lat"""

    df = read_sql(sql, dbconn, params=params, index_col='station')
    if df.empty:
        print(("%s has no entries, FAIL"
               ) % (ts.strftime("%Y-%m-%d %H:%M"), ))
        return
    ures, vres = grid_wind(df, domain)
    if ures is None:
        print("iemre.hourly_analysis failure for uwnd at %s" % (ts, ))
    else:
        nc.variables['uwnd'][offset] = ures
        nc.variables['vwnd'][offset] = vres

    tmpk = generic_gridder(df, 'max_tmpf', domain)
    if tmpk is None:
        print("iemre.hourly_analysis failure for tmpk at %s" % (ts, ))
    else:
        dwpk = generic_gridder(df, 'max_dwpf', domain)
        # require that dwpk <= tmpk
        mask = ~np.isnan(dwpk)
        mask[mask] &= dwpk[mask] > tmpk[mask]
        dwpk = np.where(mask, tmpk, dwpk)
        nc.variables['tmpk'][offset] = dt.temperature(tmpk, 'F').value('K')
        nc.variables['dwpk'][offset] = dt.temperature(dwpk, 'F').value('K')

    res = grid_skyc(df, domain)
    if res is None:
        print("iemre.hourly_analysis failure for skyc at %s" % (ts, ))
    else:
        nc.variables['skyc'][offset] = res


def main(argv):
    """Go Main"""
    if len(argv) == 5:
        ts = datetime.datetime(int(argv[1]), int(argv[2]),
                               int(argv[3]), int(argv[4]))
    else:
        ts = datetime.datetime.utcnow()
        ts = ts.replace(second=0, minute=0)
    ts = ts.replace(tzinfo=pytz.utc)
    # Load up our netcdf file!
    nc = netCDF4.Dataset("/mesonet/data/iemre/%s_mw_hourly.nc" % (ts.year,),
                         'a')
    grid_hour(nc, ts)
    nc.close()


if __name__ == "__main__":
    main(sys.argv)
