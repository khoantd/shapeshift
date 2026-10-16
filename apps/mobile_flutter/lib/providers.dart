import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/meanbox_client.dart';
import 'auth/session.dart';
import 'settings/settings_core.dart';

class SettingsNotifier extends AsyncNotifier<MeanboxSettings> {
  static const _apiKey = 'meanbox.settings.apiBase';
  static const _localeKey = 'meanbox.settings.locale';

  @override
  Future<MeanboxSettings> build() async {
    final prefs = await SharedPreferences.getInstance();
    final api = normalizeApiBase(prefs.getString(_apiKey));
    return MeanboxSettings(
      apiBase: api.isEmpty ? defaultApiBase : api,
      locale: normalizeLocale(prefs.getString(_localeKey)),
    );
  }

  Future<void> setApiBase(String raw) async {
    final next = normalizeApiBase(raw);
    if (next.isEmpty) {
      throw ArgumentError('Use an http(s) URL');
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_apiKey, next);
    state = AsyncData(
      (state.value ??
              const MeanboxSettings(
                apiBase: defaultApiBase,
                locale: defaultLocale,
              ))
          .copyWith(apiBase: next),
    );
  }

  Future<void> setLocale(MeanboxLocale locale) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localeKey, normalizeLocale(locale));
    state = AsyncData(
      (state.value ??
              const MeanboxSettings(
                apiBase: defaultApiBase,
                locale: defaultLocale,
              ))
          .copyWith(locale: normalizeLocale(locale)),
    );
  }
}

final settingsProvider =
    AsyncNotifierProvider<SettingsNotifier, MeanboxSettings>(
  SettingsNotifier.new,
);

final meanboxClientProvider = Provider<MeanboxClient>((ref) {
  final settings = ref.watch(settingsProvider).value ??
      const MeanboxSettings(
        apiBase: defaultApiBase,
        locale: defaultLocale,
      );
  return MeanboxClient(settings: settings);
});

class SessionNotifier extends AsyncNotifier<MeanboxSession?> {
  @override
  Future<MeanboxSession?> build() => loadSession();

  Future<void> save(MeanboxSession session) async {
    await saveSession(session);
    state = AsyncData(session);
  }

  Future<void> clear() async {
    await clearSession();
    state = const AsyncData(null);
  }

  Future<void> refresh() async {
    state = AsyncData(await loadSession());
  }
}

final sessionProvider =
    AsyncNotifierProvider<SessionNotifier, MeanboxSession?>(
  SessionNotifier.new,
);
