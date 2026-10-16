String capitalize(String s) =>
    s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

String collapse(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();

String tidy(String s) {
  var out = collapse(
    s.replaceAll(RegExp(r'[,;]+\s*$'), '').replaceAll(RegExp(r'^\s*[,;:-]+'), ''),
  );
  final dangling = RegExp(
    r'\s+(on|at|by|for|with|to|in|and|the|this|next|from|every)$',
    caseSensitive: false,
  );
  final leading = RegExp(r'^(on|at|by|for|and|the|to)\s+', caseSensitive: false);
  for (var i = 0; i < 4; i++) {
    final next = out.replaceAll(dangling, '').replaceAll(leading, '');
    if (next == out) break;
    out = next;
  }
  return out.trim();
}

typedef Currency = String;

const defaultCurrency = '₹';

Currency detectCurrency(String text) {
  if (RegExp(r'\$|\busd\b|dollars?\b', caseSensitive: false).hasMatch(text)) {
    return '\$';
  }
  if (RegExp(r'€|\beur(os?)?\b', caseSensitive: false).hasMatch(text)) {
    return '€';
  }
  if (RegExp(r'£|\bgbp\b|pounds? sterling', caseSensitive: false).hasMatch(text)) {
    return '£';
  }
  if (RegExp(r'₫|\bvnd\b|đồng|\bdong\b', caseSensitive: false).hasMatch(text)) {
    return '₫';
  }
  return defaultCurrency;
}

final amountRe = RegExp(
  r'(?:₹|rs\.?|inr|\$|€|£)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k\b)?',
  caseSensitive: false,
);

double toNumber(String raw) => double.parse(raw.replaceAll(',', ''));

class AmountHit {
  AmountHit({required this.value, required this.index, required this.length});
  final double value;
  final int index;
  final int length;
}

AmountHit? findAmount(String text) {
  for (final m in amountRe.allMatches(text)) {
    final n = toNumber(m.group(1)!);
    if (n.isNaN || n.isInfinite) continue;
    final k = m.group(2);
    return AmountHit(
      value: k != null ? n * 1000 : n,
      index: m.start,
      length: m.group(0)!.length,
    );
  }
  return null;
}
