// Subset of Expo convert gadgets (km/mi, kg/lb, °C/°F) without JS convert-units.

class ConvertData {
  ConvertData({
    required this.value,
    required this.from,
    required this.to,
    required this.result,
  });

  final double? value;
  final String? from;
  final String? to;
  final double? result;
}

const unitAliases = {
  'km': 'km',
  'kms': 'km',
  'kilometer': 'km',
  'kilometers': 'km',
  'kilometre': 'km',
  'kilometres': 'km',
  'mi': 'mi',
  'mile': 'mi',
  'miles': 'mi',
  'kg': 'kg',
  'kgs': 'kg',
  'kilo': 'kg',
  'kilos': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'lb': 'lb',
  'lbs': 'lb',
  'pound': 'lb',
  'pounds': 'lb',
  'c': 'C',
  '°c': 'C',
  'celsius': 'C',
  'centigrade': 'C',
  'f': 'F',
  '°f': 'F',
  'fahrenheit': 'F',
};

const defaultTarget = {
  'km': 'mi',
  'mi': 'km',
  'kg': 'lb',
  'lb': 'kg',
  'C': 'F',
  'F': 'C',
};

const unitLabels = {
  'km': 'km',
  'mi': 'mi',
  'kg': 'kg',
  'lb': 'lb',
  'C': '°C',
  'F': '°F',
};

double? convertValue(double value, String from, String to) {
  if (from == to) return value;
  switch ('$from->$to') {
    case 'km->mi':
      return value * 0.621371;
    case 'mi->km':
      return value / 0.621371;
    case 'kg->lb':
      return value * 2.20462;
    case 'lb->kg':
      return value / 2.20462;
    case 'C->F':
      return value * 9 / 5 + 32;
    case 'F->C':
      return (value - 32) * 5 / 9;
    default:
      return null;
  }
}

String get _unitAlt {
  final keys = unitAliases.keys.toList()
    ..sort((a, b) => b.length.compareTo(a.length));
  return keys.map(RegExp.escape).join('|');
}

ConvertData parseConvert(String text) {
  final t = text
      .toLowerCase()
      .replaceAll(RegExp(r'degrees?\s+'), '°')
      .replaceAll(RegExp(r'°\s+'), '°');
  final fullRe = RegExp(
    '(-?\\d+(?:\\.\\d+)?)\\s*($_unitAlt)\\s+(?:to|in|into|as|=|->)\\s*($_unitAlt)(?![a-z])',
    caseSensitive: false,
  );
  final partRe = RegExp(
    '(-?\\d+(?:\\.\\d+)?)\\s*($_unitAlt)(?![a-z])',
    caseSensitive: false,
  );
  final full = fullRe.firstMatch(t);
  if (full != null) {
    final value = double.parse(full.group(1)!);
    final from = unitAliases[full.group(2)!]!;
    final to = unitAliases[full.group(3)!]!;
    final result = convertValue(value, from, to);
    if (result != null) {
      return ConvertData(value: value, from: from, to: to, result: result);
    }
  }
  final part = partRe.firstMatch(t);
  if (part != null) {
    final value = double.parse(part.group(1)!);
    final from = unitAliases[part.group(2)!]!;
    final to = defaultTarget[from];
    return ConvertData(
      value: value,
      from: from,
      to: to,
      result: to != null ? convertValue(value, from, to) : null,
    );
  }
  return ConvertData(value: null, from: null, to: null, result: null);
}
