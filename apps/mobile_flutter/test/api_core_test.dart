import 'package:flutter_test/flutter_test.dart';
import 'package:meanbox/api/api_core.dart';

void main() {
  test('formatRelativeTime', () {
    final now = DateTime.parse('2026-01-01T12:00:00Z');
    expect(
      formatRelativeTime('2026-01-01T11:59:00Z', now: now),
      '1m',
    );
    expect(
      formatRelativeTime('2026-01-01T10:00:00Z', now: now),
      '2h',
    );
  });

  test('intentTopKey', () {
    expect(intentTopKey(null), 'none');
    expect(
      intentTopKey(const IntentResult(topIntent: ' YouTube ')),
      'youtube',
    );
  });

  test('oauthStartUrl includes returnTo', () {
    final url = oauthStartUrl(
      'https://meanbox.vercel.app',
      returnTo: '/api/youtube/oauth/mobile-bridge',
    );
    expect(url, contains('/api/youtube/oauth/start'));
    expect(url, contains('returnTo='));
  });

  test('newsCategoryMatch', () {
    const item = NewsFeedItem(
      id: '1',
      title: 'Apple chip news',
      excerpt: 'silicon',
      canonicalUrl: 'https://example.com',
      publishedAt: '',
      sourceDisplayName: 'TechCrunch',
    );
    expect(newsCategoryMatch(item, 'Top'), isTrue);
    expect(newsCategoryMatch(item, 'Tech'), isTrue);
    expect(newsCategoryMatch(item, 'Science'), isFalse);
  });
}
