import 'dart:convert';

import 'package:http/http.dart' as http;

import '../auth/session.dart';
import '../settings/settings_core.dart';
import 'api_core.dart';

class MeanboxApiException implements Exception {
  MeanboxApiException(this.message, {this.status, this.data});

  final String message;
  final int? status;
  final Object? data;

  @override
  String toString() => message;
}

class MeanboxClient {
  MeanboxClient({
    required this.settings,
    http.Client? httpClient,
    this.sessionLoader = loadSession,
  }) : _http = httpClient ?? http.Client();

  final MeanboxSettings settings;
  final http.Client _http;
  final Future<MeanboxSession?> Function() sessionLoader;

  Future<T> fetch<T>(
    String path, {
    String method = 'GET',
    Map<String, String?>? query,
    Object? body,
    String? apiBase,
    T Function(Map<String, dynamic> json)? map,
  }) async {
    final base = _normalizeOverrideBase(apiBase) ?? settings.apiBase;
    final uri = Uri.parse('$base/').resolve(path.startsWith('/') ? path.substring(1) : path);
    final withQuery = (query == null || query.isEmpty)
        ? uri
        : uri.replace(
            queryParameters: {
              ...uri.queryParameters,
              for (final e in query.entries)
                if (e.value != null && e.value!.isNotEmpty) e.key: e.value!,
            },
          );

    final session = await sessionLoader();
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (session?.bridge != null)
        meanboxSessionCookieHeader: session!.bridge,
    };

    final http.Response res;
    switch (method.toUpperCase()) {
      case 'POST':
        res = await _http.post(
          withQuery,
          headers: headers,
          body: body is String ? body : jsonEncode(body),
        );
      case 'PUT':
        res = await _http.put(
          withQuery,
          headers: headers,
          body: body is String ? body : jsonEncode(body),
        );
      default:
        res = await _http.get(withQuery, headers: headers);
    }

    Object? data;
    try {
      data = jsonDecode(res.body);
    } catch (_) {
      data = null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw MeanboxApiException(
        _extractErrorMessage(data) ?? 'HTTP ${res.statusCode}',
        status: res.statusCode,
        data: data,
      );
    }

    if (map != null) {
      if (data is Map<String, dynamic>) return map(data);
      if (data is Map) return map(Map<String, dynamic>.from(data));
      throw MeanboxApiException('Unexpected response shape');
    }
    return data as T;
  }

  Future<Map<String, dynamic>> fetchNews({
    String? q,
    int limit = 50,
    String? apiBase,
  }) {
    return fetch(
      '/api/news',
      query: {'q': q, 'limit': '$limit'},
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<Map<String, dynamic>> generateNewsDeepDive({
    required String title,
    required String excerpt,
    String? canonicalUrl,
    String? id,
    String language = 'en',
    bool force = false,
    String? apiBase,
  }) {
    String clip(String s, int max) {
      final t = s.trim();
      return t.length <= max ? t : t.substring(0, max);
    }

    final payload = <String, dynamic>{
      'title': clip(title, 500),
      'excerpt': clip(excerpt, 4000),
      'language': language == 'vi' ? 'vi' : 'en',
    };
    final cu = (canonicalUrl ?? '').trim();
    if (cu.isNotEmpty) {
      payload['canonicalUrl'] = clip(cu, 2000);
    }
    final sid = (id ?? '').trim();
    if (sid.isNotEmpty) {
      payload['id'] = clip(sid, 128);
    }
    if (force) payload['force'] = true;
    return fetch(
      '/api/news/deep-dive',
      method: 'POST',
      body: payload,
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<Map<String, dynamic>> searchYouTube(String q, {String? apiBase}) {
    return fetch(
      '/api/youtube/search',
      query: {'q': q},
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<Map<String, dynamic>> fetchVideoDetails(
    String videoId, {
    String? apiBase,
  }) {
    return fetch(
      '/api/youtube/details',
      query: {'videoId': videoId},
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<Map<String, dynamic>> fetchTranscript(
    String videoId, {
    String? apiBase,
  }) {
    return fetch(
      '/api/youtube/transcript',
      query: {'videoId': videoId},
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<Map<String, dynamic>> generateLearningPack({
    required String videoId,
    required String title,
    String? channelTitle,
    required String transcript,
    String language = 'en',
    String? apiBase,
  }) {
    return fetch(
      '/api/youtube/learning-pack',
      method: 'POST',
      body: {
        'contentType': 'lecture',
        'language': language,
        'videoId': videoId,
        'title': title,
        'channelTitle': ?channelTitle,
        'transcript': transcript,
      },
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<Map<String, dynamic>> fetchSavedLearningPack(
    String videoId, {
    String? apiBase,
  }) async {
    try {
      return await fetch(
        '/api/youtube/learning-packs',
        query: {'videoId': videoId},
        apiBase: apiBase,
        map: (j) => j,
      );
    } on MeanboxApiException catch (e) {
      if (e.status == 401) {
        return {'success': false, 'pack': null, 'unauthorized': true};
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> fetchOAuthSession({String? apiBase}) {
    return fetch(
      '/api/youtube/oauth/session',
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  Future<IntentResult> classifyIntent(String text, {String? apiBase}) {
    final t = text.trim();
    final clipped = t.length <= 2000 ? t : t.substring(0, 2000);
    return fetch(
      '/api/intent',
      method: 'POST',
      body: {'text': clipped},
      apiBase: apiBase,
      map: IntentResult.fromJson,
    );
  }

  Future<Map<String, dynamic>> structureRtcfc({
    required String text,
    bool force = false,
    String? apiBase,
  }) {
    final t = text.trim();
    final clipped = t.length <= 8000 ? t : t.substring(0, 8000);
    final payload = <String, dynamic>{
      'text': clipped,
    };
    if (force) payload['force'] = true;
    return fetch(
      '/api/rtcfc/structure',
      method: 'POST',
      body: payload,
      apiBase: apiBase,
      map: (j) => j,
    );
  }

  String? _normalizeOverrideBase(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      return Uri.parse(raw.trim().replaceAll(RegExp(r'/+$'), '')).origin;
    } catch (_) {
      return null;
    }
  }

  String? _extractErrorMessage(Object? data) {
    if (data is! Map) return null;
    final error = data['error'];
    if (error is String && error.trim().isNotEmpty) return error;
    if (error is Map && error['message'] is String) {
      return error['message'] as String;
    }
    final message = data['message'];
    if (message is String && message.trim().isNotEmpty) return message;
    return null;
  }
}
