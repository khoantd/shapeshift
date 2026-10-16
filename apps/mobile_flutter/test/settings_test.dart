import 'package:flutter_test/flutter_test.dart';
import 'package:meanbox/settings/settings_core.dart';

void main() {
  test('normalizeApiBase', () {
    expect(normalizeApiBase('https://meanbox.vercel.app/'), 'https://meanbox.vercel.app');
    expect(normalizeApiBase('ftp://x'), '');
    expect(normalizeApiBase(''), '');
  });

  test('normalizeLocale', () {
    expect(normalizeLocale('vi'), 'vi');
    expect(normalizeLocale('EN'), 'en');
  });

  test('meanboxHref', () {
    expect(
      meanboxHref('/news', const MeanboxSettings()),
      'https://meanbox.vercel.app/news',
    );
    expect(
      meanboxHref(
        '/news',
        const MeanboxSettings(locale: 'vi'),
      ),
      'https://meanbox.vercel.app/vi/news',
    );
  });
}
