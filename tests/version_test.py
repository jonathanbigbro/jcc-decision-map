import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'src'))
from server import VersionCache, parse_version_page


def page(patch='18.2a', summary_patch=None, season=18):
    record = {'props': {
        'hydration': {
            'setId': season, 'gameVersion': patch,
            'gameVersions': [{'gameVersion': '99.9'}, {'gameVersion': patch}],
            'gameSetList': [
                {'id': 99, 'name': '其他赛季', 'isEnabled': True},
                {'id': season, 'name': '自然之力', 'isEnabled': True},
            ],
        },
        'initialSummary': {'setId': season, 'gameVersion': summary_patch or patch,
                           'dataUpdatedAt': '2026-09-22T19:23:45.336Z'},
    }}
    flight = 'invalid record\n13:' + json.dumps(record, ensure_ascii=False) + '\n'
    # The structured record can span multiple transport chunks.
    chunks = [flight[:70], flight[70:]]
    return ''.join('<script>self.__next_f.push([1,' + json.dumps(c) + '])</script>' for c in chunks)


class VersionTests(unittest.TestCase):
    def test_selected_version_not_historical_maximum(self):
        result = parse_version_page(page())
        self.assertEqual((result['seasonId'], result['patch']), (18, '18.2a'))
        self.assertEqual(result['seasonName'], '自然之力')

    def test_new_season_supported(self):
        self.assertEqual(parse_version_page(page('19.1', season=19))['seasonId'], 19)

    def test_inconsistent_summary_rejected(self):
        with self.assertRaises(ValueError):
            parse_version_page(page(summary_patch='18.1'))

    def test_missing_metadata_rejected(self):
        with self.assertRaises(ValueError):
            parse_version_page('<html>New version 18.3</html>')

    def test_cache_ttl_and_manual_refresh_cooldown(self):
        now, calls = [0], []
        def fetch():
            calls.append(1)
            return parse_version_page(page())
        cache = VersionCache(fetch, lambda: now[0])
        self.assertFalse(cache.get()['cached'])
        now[0] = 14
        self.assertTrue(cache.get(force=True)['cached'])
        now[0] = 15
        self.assertFalse(cache.get(force=True)['cached'])
        now[0] = 314
        self.assertTrue(cache.get()['cached'])
        now[0] = 315
        self.assertFalse(cache.get()['cached'])
        self.assertEqual(len(calls), 3)

    def test_failed_check_keeps_last_good_result_and_retries(self):
        now, failing = [0], [False]
        def fetch():
            if failing[0]:
                raise OSError('network unavailable')
            return parse_version_page(page())
        cache = VersionCache(fetch, lambda: now[0])
        original = cache.get()
        failing[0], now[0] = True, 300
        failed = cache.get()
        self.assertEqual(failed['status'], 'error')
        self.assertEqual(failed['checkedAt'], original['checkedAt'])
        self.assertEqual(failed['latest'], original['latest'])
        now[0] = 359
        self.assertTrue(cache.get()['cached'])
        failing[0], now[0] = False, 360
        self.assertEqual(cache.get()['status'], 'ok')

    def test_initial_failure_never_claims_a_verified_version(self):
        def fetch():
            raise ValueError('invalid upstream')
        result = VersionCache(fetch).get()
        self.assertEqual(result['status'], 'error')
        self.assertIsNone(result['latest'])
        self.assertIsNone(result['checkedAt'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
