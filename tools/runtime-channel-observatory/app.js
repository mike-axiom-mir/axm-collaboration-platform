'use strict';

(function () {
  const map = window.AXM_RUNTIME_CHANNEL_MAP;
  const request = window.AXM_RUNTIME_CHANNEL_REVIEW_REQUEST;
  const byId = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const card = (label, value, tone) => {
    const element = make('article', 'card ' + tone);
    element.append(make('strong', null, value), make('span', null, label));
    byId('summary').appendChild(element);
  };
  if (!map || map.schema !== 'axm.runtime-channel-map/v1') {
    byId('channels').appendChild(make('p', 'empty', 'Generate current-runtime-channel-map.js.'));
    return;
  }
  byId('measured').textContent = 'Measured ' + map.measuredAt + ' · graph ' + map.source.graphFingerprint.slice(0, 12);
  byId('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  card('Observations', map.summary.observations, 'neutral');
  card('Named channels', map.summary.namedChannels, 'good');
  card('postMessage', map.summary.postMessageCalls, 'neutral');
  card('Dynamic holds', map.summary.dynamicNotResolved, 'hold');
  card('Review seams', map.summary.reviewSeams, 'review');
  card('Read issues', map.summary.readIssues, 'issue');
  if (request && request.schema === 'axm.runtime-channel-review-request/v1') {
    byId('request-state').textContent = request.summary.questionsAnswered + ' ANSWERED · ' + request.summary.questionsRequested + ' REQUESTED';
    byId('request').replaceChildren(make('strong', null, request.selectedChannel.family + ' · ' + request.selectedChannel.name), make('p', null, request.selectedChannel.state.replaceAll('_', ' ') + ' · questions only'));
  }
  map.channels.forEach(channel => {
    const row = make('article', 'row');
    row.append(make('code', null, channel.family), make('strong', null, channel.name), make('span', null, channel.producerCount + ' producer · ' + channel.consumerCount + ' consumer'), make('small', null, channel.state.replaceAll('_', ' ')));
    byId('channels').appendChild(row);
  });
  map.observations.forEach(item => {
    const row = make('article', 'row');
    row.append(make('code', null, item.family), make('strong', null, item.name || 'unnamed / dynamic'), make('span', null, item.role.replaceAll('_', ' ')), make('small', null, item.path + ':' + item.line));
    byId('observations').appendChild(row);
  });
}());
