/// Soft-split threshold: shorter single blocks stay one paragraph.
const longBlockChars = 280;
const sentencesPerParagraph = 2;

final _sentenceBoundary = RegExp(
  r'(?<=[.!?…])\s+(?=[\p{Lu}"“«])',
  unicode: true,
);

List<String> splitProseParagraphs(String? text) {
  final normalized =
      (text ?? '').replaceAll('\r\n', '\n').trim();
  if (normalized.isEmpty) return [];

  final blankSplit = normalized
      .split(RegExp(r'\n\s*\n+'))
      .map(_collapseInlineWhitespace)
      .where((c) => c.isNotEmpty)
      .toList();

  if (blankSplit.length > 1) return blankSplit;

  if (normalized.contains('\n')) {
    final lineSplit = normalized
        .split(RegExp(r'\n+'))
        .map(_collapseInlineWhitespace)
        .where((l) => l.isNotEmpty)
        .toList();
    if (lineSplit.length > 1) return lineSplit;
  }

  final single =
      blankSplit.isNotEmpty ? blankSplit[0] : _collapseInlineWhitespace(normalized);
  if (single.isEmpty) return [];
  if (single.length <= longBlockChars) return [single];
  return _softSplitLongBlock(single);
}

String _collapseInlineWhitespace(String s) =>
    s.replaceAll(RegExp(r'\s+'), ' ').trim();

List<String> _softSplitLongBlock(String text) {
  final sentences = text
      .split(_sentenceBoundary)
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();
  if (sentences.length <= 1) return [text];

  final paragraphs = <String>[];
  for (var i = 0; i < sentences.length; i += sentencesPerParagraph) {
    final end = (i + sentencesPerParagraph).clamp(0, sentences.length);
    final group = sentences.sublist(i, end).join(' ');
    if (group.isNotEmpty) paragraphs.add(group);
  }
  return paragraphs.isNotEmpty ? paragraphs : [text];
}

class PackChapter {
  const PackChapter({
    required this.id,
    required this.time,
    required this.title,
  });
  final String id;
  final String time;
  final String title;
}

List<String> extractKeyPoints(String markdown, [int limit = 8]) {
  final lines = markdown
      .split(RegExp(r'\n+'))
      .map((l) => l.trim())
      .where((l) => l.isNotEmpty);
  final points = <String>[];
  for (final line in lines) {
    final bullet = RegExp(r'^[-*•]\s+(.+)').firstMatch(line);
    if (bullet != null) {
      points.add(bullet.group(1)!.replaceAll('**', '').trim());
    } else if (RegExp(r'^\d+[.)]\s+').hasMatch(line)) {
      points.add(
        line
            .replaceFirst(RegExp(r'^\d+[.)]\s+'), '')
            .replaceAll('**', '')
            .trim(),
      );
    }
    if (points.length >= limit) break;
  }
  if (points.isNotEmpty) return points;

  final paras = markdown
      .split(RegExp(r'\n\s*\n+'))
      .map((p) => p.replaceAll(RegExp(r'\s+'), ' ').trim())
      .where((p) => p.length > 40)
      .toList();
  return paras.take(limit.clamp(0, 3)).toList();
}

List<PackChapter> extractChapters(String markdown, [int limit = 12]) {
  final chapters = <PackChapter>[];
  final lines = markdown.split(RegExp(r'\n+'));
  var i = 0;
  for (final line in lines) {
    final h = RegExp(r'^#{2,3}\s+(.+)').firstMatch(line);
    final timed = RegExp(
      r'^(?:[-*•]\s+)?(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s+[-–—]?\s*(.+)$',
    ).firstMatch(line);
    if (h != null) {
      i += 1;
      chapters.add(
        PackChapter(
          id: 'c$i',
          time: '—',
          title: h.group(1)!.replaceAll('**', '').trim(),
        ),
      );
    } else if (timed != null) {
      i += 1;
      chapters.add(
        PackChapter(
          id: 'c$i',
          time: timed.group(1)!,
          title: timed.group(2)!.replaceAll('**', '').trim(),
        ),
      );
    }
    if (chapters.length >= limit) break;
  }
  return chapters;
}

const youtubeEmbedOrigin = 'https://app.meanbox.mobile';

String youtubeWatchUrl(String videoId) {
  final id = videoId.trim();
  if (id.isEmpty) return '';
  return 'https://www.youtube.com/watch?v=${Uri.encodeComponent(id)}';
}

String youtubeEmbedUrl(String videoId) {
  final id = videoId.trim();
  if (id.isEmpty) return '';
  final origin = Uri.encodeComponent(youtubeEmbedOrigin);
  return 'https://www.youtube.com/embed/${Uri.encodeComponent(id)}?playsinline=1&rel=0&origin=$origin';
}

String youtubeEmbedHtml(String videoId) {
  final src = youtubeEmbedUrl(videoId);
  if (src.isEmpty) return '';
  return '''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe
    src="$src"
    title="YouTube"
    referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    allowfullscreen
  ></iframe>
</body>
</html>''';
}
