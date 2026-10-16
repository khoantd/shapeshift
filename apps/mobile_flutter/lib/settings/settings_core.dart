const defaultApiBase = 'https://meanbox.vercel.app';
const defaultLocale = 'en';

typedef MeanboxLocale = String; // 'en' | 'vi'

class MeanboxSettings {
  const MeanboxSettings({
    this.apiBase = defaultApiBase,
    this.locale = defaultLocale,
  });

  final String apiBase;
  final MeanboxLocale locale;

  MeanboxSettings copyWith({String? apiBase, MeanboxLocale? locale}) {
    return MeanboxSettings(
      apiBase: apiBase ?? this.apiBase,
      locale: locale ?? this.locale,
    );
  }
}

String normalizeApiBase(String? raw) {
  if (raw == null) return '';
  final trimmed = raw.trim().replaceAll(RegExp(r'/+$'), '');
  if (trimmed.isEmpty) return '';
  try {
    final u = Uri.parse(trimmed);
    if (u.scheme != 'http' && u.scheme != 'https') return '';
    return u.origin;
  } catch (_) {
    return '';
  }
}

MeanboxLocale normalizeLocale(String? raw) {
  final v = (raw ?? '').trim().toLowerCase();
  return v == 'vi' ? 'vi' : defaultLocale;
}

String deepDiveLanguage(MeanboxLocale locale) =>
    locale == 'vi' ? 'vi' : 'en';

String meanboxHref(
  String path,
  MeanboxSettings settings,
) {
  final clean = path.startsWith('/') ? path : '/$path';
  final localePrefix =
      settings.locale.isNotEmpty && settings.locale != 'en'
          ? '/${settings.locale}'
          : '';
  return '${settings.apiBase}$localePrefix$clean';
}
