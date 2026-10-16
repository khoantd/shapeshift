import '../settings/settings_core.dart';

class NewsFeedItem {
  const NewsFeedItem({
    required this.id,
    required this.title,
    required this.excerpt,
    required this.canonicalUrl,
    required this.publishedAt,
    this.isRead = false,
    this.isPinned = false,
    this.sourceDisplayName,
    this.thumbnailUrl,
  });

  final String id;
  final String title;
  final String excerpt;
  final String canonicalUrl;
  final String publishedAt;
  final bool isRead;
  final bool isPinned;
  final String? sourceDisplayName;
  final String? thumbnailUrl;

  factory NewsFeedItem.fromJson(Map<String, dynamic> json) {
    return NewsFeedItem(
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? ''}',
      excerpt: '${json['excerpt'] ?? ''}',
      canonicalUrl: '${json['canonicalUrl'] ?? ''}',
      publishedAt: '${json['publishedAt'] ?? ''}',
      isRead: json['isRead'] == true,
      isPinned: json['isPinned'] == true,
      sourceDisplayName: json['sourceDisplayName'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
    );
  }
}

class IntentResult {
  const IntentResult({
    this.topIntent,
    this.intent,
    this.confidence,
    this.error,
    this.raw = const {},
  });

  final String? topIntent;
  final String? intent;
  final num? confidence;
  final String? error;
  final Map<String, dynamic> raw;

  factory IntentResult.fromJson(Map<String, dynamic> json) {
    return IntentResult(
      topIntent: json['topIntent'] as String?,
      intent: json['intent'] as String?,
      confidence: json['confidence'] as num?,
      error: json['error'] as String?,
      raw: json,
    );
  }
}

class YouTubeVideo {
  const YouTubeVideo({
    required this.videoId,
    required this.title,
    this.channelTitle,
    this.thumbnailUrl,
    this.publishedAt,
    this.duration,
  });

  final String videoId;
  final String title;
  final String? channelTitle;
  final String? thumbnailUrl;
  final String? publishedAt;
  final String? duration;

  factory YouTubeVideo.fromJson(Map<String, dynamic> json) {
    return YouTubeVideo(
      videoId: '${json['videoId'] ?? ''}',
      title: '${json['title'] ?? ''}',
      channelTitle: json['channelTitle'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      publishedAt: json['publishedAt'] as String?,
      duration: json['duration'] as String?,
    );
  }
}

String formatRelativeTime(String iso, {DateTime? now}) {
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  final nowMs = (now ?? DateTime.now()).millisecondsSinceEpoch;
  final diff = (nowMs - t.millisecondsSinceEpoch).clamp(0, 1 << 62);
  final m = diff ~/ 60000;
  if (m < 1) return 'now';
  if (m < 60) return '${m}m';
  final h = m ~/ 60;
  if (h < 48) return '${h}h';
  final d = h ~/ 24;
  return '${d}d';
}

bool newsCategoryMatch(NewsFeedItem item, String cat) {
  if (cat.isEmpty || cat == 'Top') return true;
  final hay =
      '${item.sourceDisplayName ?? ''} ${item.title} ${item.excerpt}'
          .toLowerCase();
  const needles = {
    'Tech': ['tech', 'ai', 'software', 'apple', 'google', 'chip', 'rust', 'code'],
    'World': ['world', 'market', 'bank', 'policy', 'nation', 'global'],
    'Science': ['science', 'nature', 'space', 'battery', 'research', 'climate'],
  };
  final list = needles[cat] ?? [cat.toLowerCase()];
  return list.any(hay.contains);
}

String intentTopKey(IntentResult? result) {
  if (result == null) return 'none';
  final top = result.topIntent ?? result.intent ?? 'none';
  final trimmed = top.trim().toLowerCase();
  return trimmed.isEmpty ? 'none' : trimmed;
}

String oauthStartUrl(String apiBase, {String? returnTo}) {
  final base =
      '${apiBase.replaceAll(RegExp(r'/+$'), '')}/api/youtube/oauth/start';
  final rt = returnTo?.trim();
  if (rt == null || rt.isEmpty) return base;
  return Uri.parse(base).replace(queryParameters: {'returnTo': rt}).toString();
}

String languageFromLocale(MeanboxLocale locale) =>
    locale == 'vi' ? 'vi' : 'en';
