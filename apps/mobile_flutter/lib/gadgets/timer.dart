import 'common.dart';

class TimerData {
  TimerData({required this.seconds, required this.label});
  final int? seconds;
  final String label;
}

const _unit = {'h': 3600, 'm': 60, 's': 1};

TimerData parseTimer(String text) {
  var rest = ' ${collapse(text).toLowerCase()} ';
  var seconds = 0;
  var found = false;

  final special = <(RegExp, int)>[
    (RegExp(r'\bpomodoro\b'), 25 * 60),
    (RegExp(r'\bhalf an? hour\b'), 30 * 60),
    (RegExp(r'\ban? hour\b'), 60 * 60),
    (RegExp(r'\ba minute\b'), 60),
  ];
  for (final (re, s) in special) {
    if (re.hasMatch(rest)) {
      seconds += s;
      found = true;
      if (re.pattern != r'\bpomodoro\b') {
        rest = rest.replaceAll(re, ' ');
      }
    }
  }

  rest = rest.replaceAllMapped(
    RegExp(
      r'(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b',
    ),
    (m) {
      final n = double.parse(m.group(1)!);
      final u = m.group(2)![0];
      seconds += (n * (_unit[u] ?? 0)).round();
      found = true;
      return ' ';
    },
  );

  rest = rest.replaceAllMapped(RegExp(r'\b(\d{1,2}):(\d{2})\b'), (m) {
    seconds += int.parse(m.group(1)!) * 60 + int.parse(m.group(2)!);
    found = true;
    return ' ';
  });

  final label = tidy(
    rest.replaceAll(
      RegExp(r'\b(?:timer|set|start|a|for|countdown|of)\b'),
      ' ',
    ),
  );
  return TimerData(
    seconds: found ? seconds.round() : null,
    label: capitalize(label),
  );
}

String formatClock(num total) {
  final s = total.round().clamp(0, 1 << 30);
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = s % 60;
  final mm = m.toString().padLeft(2, '0');
  final ss = sec.toString().padLeft(2, '0');
  return h > 0 ? '$h:$mm:$ss' : '$mm:$ss';
}
