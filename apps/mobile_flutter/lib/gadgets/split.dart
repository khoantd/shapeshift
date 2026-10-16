import 'common.dart';

class SplitData {
  SplitData({
    required this.total,
    required this.people,
    required this.currency,
  });

  final double? total;
  final int? people;
  final Currency currency;
}

const _wordNum = {
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
};

SplitData parseSplit(String text) {
  var rest = text;
  int? people;

  final n = RegExp(
        r'\b(?:between|among|amongst|with|by|for|into)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*(?:people|persons|friends|of us|ways))?',
        caseSensitive: false,
      ).firstMatch(rest) ??
      RegExp(
        r'\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*(?:ways|people|persons|friends|of us)\b',
        caseSensitive: false,
      ).firstMatch(rest);

  if (n != null) {
    final token = n.group(1)!.toLowerCase();
    people = _wordNum[token] ?? int.tryParse(token);
    rest = rest.replaceFirst(n.group(0)!, ' ');
  } else {
    final names = RegExp(
      r'\b(?:between|among|with)\s+(.+)$',
      caseSensitive: false,
    ).firstMatch(rest);
    if (names != null) {
      final parts = names
          .group(1)!
          .split(RegExp(r'\s*(?:,|&|\band\b)\s*', caseSensitive: false))
          .where((p) => RegExp(r'[a-z]', caseSensitive: false).hasMatch(p))
          .toList();
      if (parts.length >= 2) {
        people = parts.length;
      } else if (parts.length == 1 && !RegExp(r'\d').hasMatch(parts[0])) {
        people = 2;
      }
      rest = rest.replaceFirst(names.group(0)!, ' ');
    }
  }

  final amount = findAmount(rest);
  return SplitData(
    total: amount?.value,
    people: people != null && people > 0 ? people : null,
    currency: detectCurrency(text),
  );
}
