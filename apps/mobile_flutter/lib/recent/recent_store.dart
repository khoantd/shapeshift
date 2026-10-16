import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'recent_core.dart';

const _key = 'meanbox.recent';

Future<List<RecentItem>> loadRecent() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    final list = jsonDecode(raw);
    if (list is! List) return [];
    return list
        .map(RecentItem.tryParse)
        .whereType<RecentItem>()
        .toList();
  } catch (_) {
    return [];
  }
}

Future<List<RecentItem>> appendRecent({
  required String title,
  required String meta,
  required RecentKind kind,
  String? href,
}) async {
  final items = await loadRecent();
  final next = [
    RecentItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      meta: meta,
      kind: kind,
      createdAt: DateTime.now().millisecondsSinceEpoch,
      href: href,
    ),
    ...items,
  ].take(40).toList();
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(
    _key,
    jsonEncode(next.map((e) => e.toJson()).toList()),
  );
  return next;
}
