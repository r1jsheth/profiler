import queryString from 'query-string';
import { stringifyRangeFilters, parseRangeFilters } from './range-filters';
import { stringifyCallTreeFilters, parseCallTreeFilters } from './call-tree-filters';

// {
//   // general:
//   dataSource: 'from-addon', 'local', 'public',
//   hash: '' or 'aoeurschsaoeuch',
//   selectedTab: 'summary' or 'calltree' or ...,
//   rangeFilters: [] or [{ start, end }, ...],
//   selectedThread: 0 or 1 or ...,
//   
//   // only when selectedTab === 'calltree':
//   callTreeSearchString: '' or '::RunScript' or ...,
//   callTreeFilters: [[], [{type:'prefix', matchJSOnly:true, prefixFuncs:[1,3,7]}, {}, ...], ...], // one per thread
//   jsOnly: false or true,
//   invertCallstack: false or true,
// }

function dataSourceDirs(urlState) {
  const { dataSource } = urlState;
  switch (dataSource) {
    case 'from-addon':
      return ['from-addon'];
    case 'local':
      return ['local', urlState.hash];
    case 'public':
      return ['public', urlState.hash];
    default:
      return [];
  }
}

export function urlFromState(urlState) {
  const { dataSource } = urlState;
  if (dataSource === 'none') {
    return '/';
  }
  const pathname = '/' + [
    ...dataSourceDirs(urlState),
    urlState.selectedTab,
  ].join('/') + '/';
  const query = Object.assign({
    range: stringifyRangeFilters(urlState.rangeFilters) || undefined,
    thread: `${urlState.selectedThread}`,
  }, urlState.selectedTab === 'calltree' ? {
    search: urlState.callTreeSearchString || undefined,
    invertCallstack: urlState.invertCallstack ? null : undefined,
    jsOnly: urlState.jsOnly ? null : undefined,
    callTreeFilters: stringifyCallTreeFilters(urlState.callTreeFilters[urlState.selectedThread]) || undefined,
  } : {});
  const qString = queryString.stringify(query);
  return pathname + (qString ? '?' + qString : '');
}

export function stateFromCurrentLocation() {
  const pathname = window.location.pathname;
  const qString = window.location.search.substr(1);
  const hash = window.location.hash;
  const query = queryString.parse(qString);

  if (pathname === '/') {
    const legacyQuery = Object.assign({}, query, queryString.parse(hash));
    if ('filter' in legacyQuery) {
      const filters = JSON.parse(legacyQuery.filter);
      // We can't convert these parameters to the new URL parameters here
      // because they're relative to different things - the legacy range
      // filters were relative to profile.meta.startTime, and the new
      // rangeFilters param is relative to
      // getTimeRangeIncludingAllThreads(profile).start.
      // So we stuff this information into a global here, and then later,
      // once we have the profile, we convert that information into URL params
      // again. This is not pretty.
      window.legacyRangeFilters =
        filters.filter(f => f.type === 'RangeSampleFilter').map(({ start, end }) => ({ start, end }));

      return {
        dataSource: 'public',
        hash: ('report' in legacyQuery) ? legacyQuery.report : '',
        selectedTab: 'calltree',
        rangeFilters: [],
        selectedThread: 0,
        callTreeSearchString: '',
        callTreeFilters: {},
        jsOnly: false,
        invertCallstack: false,
      };
    }
  }

  const dirs = pathname.split('/').filter(d => d);
  const dataSource = dirs[0] || 'none';
  if (!['none', 'from-addon', 'local', 'public'].includes(dataSource)) {
    throw new Error('unexpected data source');
  }
  const needHash = ['local', 'public'].includes(dataSource);
  const selectedThread = query.thread !== undefined ? +query.thread : 0;
  return {
    dataSource,
    hash: needHash ? dirs[1] : '',
    selectedTab: (needHash ? dirs[2] : dirs[1]) || 'calltree',
    rangeFilters: query.range ? parseRangeFilters(query.range) : [],
    selectedThread: selectedThread,
    callTreeSearchString: query.search || '',
    callTreeFilters: {
      [selectedThread]: query.callTreeFilters ? parseCallTreeFilters(query.callTreeFilters) : [],
    },
    jsOnly: query.jsOnly !== undefined,
    invertCallstack: query.invertCallstack !== undefined,
  };
}
