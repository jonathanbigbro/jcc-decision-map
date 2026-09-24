"""Local static app server with a read-only, cached upstream version check."""
import argparse
import functools
import json
import pathlib
import re
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

SOURCE_URL = 'https://www.dataj.cc/'
CHECK_SECONDS = 300
MAX_BYTES = 3 * 1024 * 1024


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def walk_dicts(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def parse_version_page(html):
    # Parse structured hydration; never pick the first number in page text or
    # the highest historical version, which may belong to a different season.
    chunks = []
    for match in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html):
        chunks.append(json.loads(match[1]))
    hydration, summary = None, None
    for line in ''.join(chunks).splitlines():
        try:
            record = json.loads(line.split(':', 1)[1])
        except (ValueError, IndexError):
            continue
        for item in walk_dicts(record):
            if isinstance(item.get('hydration'), dict) and 'gameSetList' in item['hydration']:
                hydration = item['hydration']
            if isinstance(item.get('initialSummary'), dict):
                summary = item['initialSummary']
    if not hydration or not summary:
        raise ValueError('Upstream structured version metadata is unavailable')
    season_id, patch = hydration.get('setId'), hydration.get('gameVersion')
    if not isinstance(season_id, int) or not isinstance(patch, str) or not re.fullmatch(r'\d{1,2}\.\d{1,2}(?:\.?[a-z]{1,3})?', patch):
        raise ValueError('Invalid upstream version metadata')
    if summary.get('setId') != season_id or summary.get('gameVersion') != patch:
        raise ValueError('Summary and selected version disagree')
    season = next((s for s in hydration['gameSetList'] if s.get('id') == season_id and s.get('isEnabled')), None)
    if not season or not isinstance(season.get('name'), str) or len(season['name']) > 50:
        raise ValueError('Current season not found')
    updated = summary.get('dataUpdatedAt')
    if not isinstance(updated, str):
        raise ValueError('Data timestamp is unavailable')
    parsed = datetime.fromisoformat(updated.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Data timestamp lacks timezone')
    return {'seasonId': season_id, 'seasonName': season['name'], 'patch': patch,
            'dataUpdatedAt': updated, 'sourceUrl': SOURCE_URL, 'sourceName': '金铲铲大数据'}


def fetch_version():
    request = urllib.request.Request(SOURCE_URL, headers={
        'User-Agent': 'JCC-Decision-Map/1.1 (public version metadata check)',
        'Cache-Control': 'no-cache', 'Accept': 'text/html',
    })
    with urllib.request.urlopen(request, timeout=10) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Source page exceeded size limit')
    return parse_version_page(raw.decode('utf-8'))


class VersionCache:
    def __init__(self, fetcher=fetch_version, clock=time.monotonic):
        self.fetcher = fetcher
        self.clock = clock
        self.lock = threading.Lock()
        self.value = None
        self.payload = None
        self.last_attempt = None
        self.last_checked = None

    def get(self, force=False):
        with self.lock:
            now = self.clock()
            ttl = 15 if force else (60 if self.payload and self.payload['status'] == 'error' else CHECK_SECONDS)
            if self.payload is not None and self.last_attempt is not None and now - self.last_attempt < ttl:
                return {**self.payload, 'cached': True}
            self.last_attempt = now
            attempted = utc_now()
            try:
                value = self.fetcher()
                self.value, self.last_checked = value, utc_now()
                self.payload = {'status': 'ok', 'latest': value, 'checkedAt': self.last_checked}
            except Exception:
                # Keep last successful timestamp, rather than presenting an
                # old cached value as a new successful online verification.
                self.payload = {'status': 'error', 'latest': self.value, 'checkedAt': self.last_checked,
                                'message': '数据源暂时无法访问或版本信息解析失败，请稍后重试。'}
            self.payload.update({'attemptedAt': attempted, 'pollSeconds': CHECK_SECONDS})
            return {**self.payload, 'cached': False}


VERSION_CACHE = VersionCache()


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/api/version':
            return self.send_json(VERSION_CACHE.get(parse_qs(url.query).get('refresh') == ['1']))
        if url.path == '/api/health':
            return self.send_json({'app': 'jcc-decision-map', 'versionMonitor': True})
        if url.path.startswith('/api/'):
            return self.send_json({'error': 'Not found'}, 404)
        return super().do_GET()

    def end_headers(self):
        if urlsplit(self.path).path in ('/', '/index.html'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--directory', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parent)
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(args.directory.resolve()))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print(f'JCC Decision Map: http://127.0.0.1:{args.port}/', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
