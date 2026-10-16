import 'common.dart';

class TipData {
  TipData({
    required this.total,
    required this.tipPercent,
    required this.people,
    required this.currency,
  });

  final double? total;
  final double? tipPercent;
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

final _pctRe = RegExp(
  r'\b(\d+(?:\.\d+)?)\s*(?:%|percent|pct)\s*(?:tip|gratuity)?\b|\b(?:tip|gratuity|service\s*charge)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:%|percent|pct)?\b',
  caseSensitive: false,
);

TipData parseTip(String text) {
  var rest = text;
  double? tipPercent;
  int? people;

  final pct = _pctRe.firstMatch(rest);
  if (pct != null) {
    tipPercent = double.tryParse(pct.group(1) ?? pct.group(2) ?? '');
    rest = rest.replaceFirst(pct.group(0)!, ' ');
  }

  final n = RegExp(
        r'\b(?:for|between|among|amongst|with|by|into)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*(?:people|persons|friends|of us|ways))?',
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
  }

  rest = rest.replaceAll(
    RegExp(
      r'\b(?:tip|gratuity|service\s*charge|add|a|an|the|on|to|bill|check)\b',
      caseSensitive: false,
    ),
    ' ',
  );
  final amount = findAmount(rest);

  return TipData(
    total: amount?.value,
    tipPercent: tipPercent != null && tipPercent >= 0 ? tipPercent : null,
    people: people != null && people > 0 ? people : null,
    currency: detectCurrency(text),
  );
}

class TipAmounts {
  TipAmounts({required this.tip, required this.grand, this.each});
  final double tip;
  final double grand;
  final double? each;
}

TipAmounts tipAmounts({
  required double total,
  required double tipPercent,
  int? people,
}) {
  final tip = (total * tipPercent).roundToDouble() / 100;
  final grand = ((total + tip) * 100).roundToDouble() / 100;
  final p = people != null && people > 0 ? people : null;
  final each = p != null ? ((grand / p) * 100).roundToDouble() / 100 : null;
  return TipAmounts(tip: tip, grand: grand, each: each);
}
