#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def compute_event_hash(event):
    copy = dict(event)
    copy.pop('event_hash', None)
    return 'sha256:' + hashlib.sha256(canonical(copy)).hexdigest()


def rebuild(stream_path: Path):
    state = {'contract_version': '0.1.0', 'entities': {}, 'last_event_hash': None, 'event_count': 0}
    previous = None
    expected_sequence = 1
    for lineno, line in enumerate(stream_path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        event = json.loads(line)
        if event['sequence'] != expected_sequence:
            raise ValueError(f'Line {lineno}: expected sequence {expected_sequence}, got {event["sequence"]}')
        if event['previous_event_hash'] != previous:
            raise ValueError(f'Line {lineno}: previous_event_hash mismatch')
        actual = compute_event_hash(event)
        if event['event_hash'] != actual:
            raise ValueError(f'Line {lineno}: event_hash mismatch')
        key = f'{event["entity_type"]}:{event["entity_id"]}'
        if event['operation'] == 'UPSERT':
            state['entities'][key] = event['payload']
        elif event['operation'] == 'DEPRECATE':
            prior = state['entities'].get(key, {})
            prior = dict(prior)
            prior['_derived_status'] = 'DEPRECATED'
            state['entities'][key] = prior
        else:
            prior = state['entities'].get(key, {})
            prior = dict(prior)
            prior.setdefault('_derived_events', []).append(event['payload'])
            state['entities'][key] = prior
        previous = event['event_hash']
        expected_sequence += 1
        state['event_count'] += 1
    state['last_event_hash'] = previous
    state['state_hash'] = 'sha256:' + hashlib.sha256(canonical({'contract_version':state['contract_version'],'entities':state['entities'],'last_event_hash':state['last_event_hash'],'event_count':state['event_count']})).hexdigest()
    return state


def main():
    base = Path(__file__).resolve().parents[1]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else base/'examples/event_stream.jsonl'
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else base/'generated/reconstructed_state.json'
    state = rebuild(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(state, indent=2, sort_keys=True, ensure_ascii=False)+'\n', encoding='utf-8')
    print(json.dumps({'status':'PASS','events':state['event_count'],'entities':len(state['entities']),'state_hash':state['state_hash'],'output':str(target)}, indent=2))

if __name__ == '__main__':
    main()
