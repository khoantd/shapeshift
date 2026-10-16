import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const meanboxSessionCookieHeader = 'X-Meanbox-Cookie';
const mobileOauthRedirect = 'meanbox://oauth';
const mobileOauthReturnTo = '/api/youtube/oauth/mobile-bridge';
const _storageKey = 'meanbox.oauth.bridge';

class MeanboxSession {
  const MeanboxSession({required this.bridge, this.email});

  final String bridge;
  final String? email;
}

sealed class OAuthRedirectParse {}

class OAuthRedirectOk extends OAuthRedirectParse {
  OAuthRedirectOk(this.session);
  final MeanboxSession session;
}

class OAuthRedirectErr extends OAuthRedirectParse {
  OAuthRedirectErr(this.error);
  final String error;
}

OAuthRedirectParse parseMobileOAuthRedirect(String url) {
  try {
    final parsed = Uri.parse(url);
    if (parsed.scheme != 'meanbox') {
      return OAuthRedirectErr('unexpected_scheme');
    }
    final error = parsed.queryParameters['error'];
    if (error != null && error.isNotEmpty) {
      return OAuthRedirectErr(error);
    }
    final bridge = (parsed.queryParameters['bridge'] ?? '').trim();
    if (bridge.isEmpty || !bridge.contains('yt_oauth_')) {
      return OAuthRedirectErr('missing_bridge');
    }
    final emailRaw = (parsed.queryParameters['email'] ?? '').trim();
    return OAuthRedirectOk(
      MeanboxSession(
        bridge: bridge,
        email: emailRaw.isNotEmpty ? emailRaw : emailFromBridge(bridge),
      ),
    );
  } catch (_) {
    return OAuthRedirectErr('invalid_url');
  }
}

String? emailFromBridge(String bridge) {
  for (final part in bridge.split(';')) {
    final idx = part.indexOf('=');
    if (idx <= 0) continue;
    final name = part.substring(0, idx).trim();
    final value = part.substring(idx + 1).trim();
    if (name == 'yt_oauth_email' && value.isNotEmpty) return value;
  }
  return null;
}

Future<MeanboxSession?> loadSession() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null) return null;
    final parsed = jsonDecode(raw) as Map<String, dynamic>;
    final bridge = parsed['bridge'];
    if (bridge is! String || !bridge.contains('yt_oauth_')) return null;
    final email = parsed['email'];
    return MeanboxSession(
      bridge: bridge,
      email: email is String && email.isNotEmpty ? email : null,
    );
  } catch (_) {
    return null;
  }
}

Future<void> saveSession(MeanboxSession session) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(
    _storageKey,
    jsonEncode({'bridge': session.bridge, 'email': session.email}),
  );
}

Future<void> clearSession() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_storageKey);
}
