"""iemre stuff"""
import datetime

import numpy as np
import matplotlib.dates as mdates
import netCDF4
import pandas as pd
from pyiem import iemre
from pyiem.util import get_autoplot_context
from pyiem import reference


def get_description():
    """ Return a dict describing how to call this plotter """
    desc = dict()
    today = datetime.date.today()
    desc['description'] = """This is a complex plot to describe!  For each
    24 hour period (roughly ending 7 AM), the IEM computes a gridded
    precipitation estimate.  This chart displays the daily coverage of a
    specified intensity for that day.  The chart also compares this coverage
    against the portion of the state that was below a second given threshold
    over X number of days.  This provides some insight into if the
    precipitation fell over locations that needed it.
    """
    desc['data'] = True
    desc['arguments'] = [
        dict(type='year', name='year', default=today.year,
             label='Select Year (1893-)'),
        dict(type='float', name='daythres', default='0.50',
             label='1 Day Precipitation Threshold [inch]'),
        dict(type='int', name='period', default='7',
             label='Over Period of Trailing Days'),
        dict(type='float', name='trailthres', default='0.50',
             label='Trailing Day Precipitation Threshold [inch]'),
        dict(type='clstate', name='state', default='IA', label='For State'),
    ]
    return desc


def plotter(fdict):
    """ Go """
    import matplotlib
    matplotlib.use('agg')
    import matplotlib.pyplot as plt
    ctx = get_autoplot_context(fdict, get_description())
    year = ctx['year']
    daythres = ctx['daythres']
    trailthres = ctx['trailthres']
    period = ctx['period']
    state = ctx['state'][:2]

    nc2 = netCDF4.Dataset("/mesonet/data/iemre/state_weights.nc")
    iowa = nc2.variables[state][:]
    iowapts = np.sum(np.where(iowa > 0, 1, 0))
    nc2.close()

    nc = netCDF4.Dataset('/mesonet/data/iemre/%s_mw_daily.nc' % (year, ))
    precip = nc.variables['p01d']

    now = datetime.datetime(year, 1, 1)
    now += datetime.timedelta(days=(period-1))
    ets = datetime.datetime(year, 12, 31)
    today = datetime.datetime.now()
    if ets > today:
        ets = today - datetime.timedelta(days=1)
    days = []
    coverage = []
    hits = []
    efficiency = []
    rows = []
    needed = []
    while now < ets:
        idx = iemre.daily_offset(now)
        sevenday = np.sum(precip[(idx-period):idx, :, :], 0)
        ptrail = np.where(iowa > 0, sevenday[:, :], -1)
        pday = np.where(iowa > 0, precip[idx, :, :], -1)
        tots = np.sum(np.where(pday >= (daythres * 25.4),
                               1, 0))
        need = np.sum(np.where(np.logical_and(ptrail < (trailthres * 25.4),
                                              ptrail >= 0),
                      1, 0))
        htot = np.sum(np.where(np.logical_and(ptrail < (trailthres * 25.4),
                                              pday >= (daythres * 25.4)),
                               1, 0))
        days.append(now)
        c = tots / float(iowapts) * 100.0
        h = htot / float(iowapts) * 100.0
        e = htot / float(need) * 100.
        n = need / float(iowapts) * 100.
        coverage.append(c)
        hits.append(h)
        efficiency.append(e)
        needed.append(n)
        rows.append(dict(day=now.strftime("%Y-%m-%d"), coverage=c,
                         hits=h, efficiency=e, needed=n))

        now += datetime.timedelta(days=1)
    df = pd.DataFrame(rows)
    hits = np.array(hits)
    coverage = np.array(coverage)

    (fig, ax) = plt.subplots(2, 1, sharex=True, figsize=(10, 7))
    ax[0].bar(days, coverage, fc='tan', ec='tan', zorder=1,
              label='Daily %.2fin' % (daythres, ))
    ax[0].bar(days, hits, fc='b', ec='b', zorder=2,
              label='Over "Dry" Areas')
    ax[0].legend(loc=2, ncol=2, fontsize=10)
    ax[0].set_title(("IEM Estimated Areal Coverage Percent of %s\n"
                     " receiving daily %.2fin vs trailing %s day %.2fin"
                     ) % (reference.state_names[state], daythres, period,
                          trailthres))
    ax[0].set_ylabel("Areal Coverage [%]")
    ax[0].grid(True)

    ax[1].bar(days, needed, fc='tan', ec='tan', zorder=1)
    ax[1].bar(days, efficiency, fc='b', ec='b', zorder=2)
    ax[1].xaxis.set_major_formatter(mdates.DateFormatter('%b\n%Y'))
    ax[1].grid(True)
    ax[1].set_ylabel("Areal Coverage [%]")
    ax[1].set_title(("Percentage of Dry Area (tan) below (%.2fin over %s days)"
                     " got %.2fin precip (blue) that day"
                     ) % (trailthres, period, daythres),
                    fontsize=12)
    return fig, df


if __name__ == '__main__':
    plotter(dict())
