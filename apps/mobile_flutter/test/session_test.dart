import 'package:flutter_test/flutter_test.dart';
import 'package:meanbox/auth/session.dart';

void main() {
  test('parseMobileOAuthRedirect success', () {
    final result = parseMobileOAuthRedirect(
      'meanbox://oauth?bridge=yt_oauth_token%3Dabc%3Byt_oauth_email%3Dme%40ex.com&email=me%40ex.com',
    );
    expect(result, isA<OAuthRedirectOk>());
    final ok = result as OAuthRedirectOk;
    expect(ok.session.bridge, contains('yt_oauth_'));
    expect(ok.session.email, 'me@ex.com');
  });

  test('parseMobileOAuthRedirect error', () {
    final result =
        parseMobileOAuthRedirect('meanbox://oauth?error=not_connected');
    expect(result, isA<OAuthRedirectErr>());
    expect((result as OAuthRedirectErr).error, 'not_connected');
  });

  test('parseMobileOAuthRedirect missing bridge', () {
    final result = parseMobileOAuthRedirect('meanbox://oauth');
    expect(result, isA<OAuthRedirectErr>());
  });
}
