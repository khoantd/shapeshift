const recentPageSize = 5;

enum RecentKind {
  ask,
  link,
  split,
  translate,
  news,
  study,
  gadget,
}

class RecentItem {
  const RecentItem({
    required this.id,
    required this.title,
    required this.meta,
    required this.kind,
    required this.createdAt,
    this.href,
  });

  final String id;
  final String title;
  final String meta;
  final RecentKind kind;
  final int createdAt;
  final String? href;

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'meta': meta,
        'kind': kind.name,
        'createdAt': createdAt,
        if (href != null) 'href': href,
      };

  static RecentItem? tryParse(Object? v) {
    if (v is! Map) return null;
    final o = Map<String, dynamic>.from(v);
    if (o['id'] is! String ||
        o['title'] is! String ||
        o['meta'] is! String ||
        o['kind'] is! String ||
        o['createdAt'] is! num) {
      return null;
    }
    RecentKind? kind;
    for (final k in RecentKind.values) {
      if (k.name == o['kind']) {
        kind = k;
        break;
      }
    }
    if (kind == null) return null;
    return RecentItem(
      id: o['id'] as String,
      title: o['title'] as String,
      meta: o['meta'] as String,
      kind: kind,
      createdAt: (o['createdAt'] as num).toInt(),
      href: o['href'] as String?,
    );
  }
}

List<RecentItem> filterRecentItems(List<RecentItem> items, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return items;
  return items
      .where(
        (item) =>
            '${item.title} ${item.meta} ${item.kind.name}'.toLowerCase().contains(q),
      )
      .toList();
}

List<RecentItem> pageRecentItems(
  List<RecentItem> items,
  int page, [
  int pageSize = recentPageSize,
]) {
  final p = page < 1 ? 1 : page;
  final size = pageSize < 1 ? 1 : pageSize;
  final end = (p * size).clamp(0, items.length);
  return items.sublist(0, end);
}
