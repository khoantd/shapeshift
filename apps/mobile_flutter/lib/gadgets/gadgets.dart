import 'convert.dart';
import 'rtcfc.dart';
import 'split.dart';
import 'timer.dart';
import 'tip.dart';

enum QuickGadgetIntent { tip, split, convert, timer, rtcfc }

const quickGadgetIntents = QuickGadgetIntent.values;

class GadgetRow {
  const GadgetRow({
    required this.label,
    required this.value,
    this.bold = false,
  });
  final String label;
  final String value;
  final bool bold;
}

class GadgetResult {
  const GadgetResult({
    required this.intent,
    required this.query,
    required this.title,
    this.badge,
    this.amount,
    required this.meta,
    required this.rows,
    required this.lines,
    required this.ready,
    required this.copyText,
    this.timerSeconds,
    this.timerLabel,
    this.rtcfc,
    this.needsStructure = false,
  });

  final QuickGadgetIntent intent;
  final String query;
  final String title;
  final String? badge;
  final String? amount;
  final String meta;
  final List<GadgetRow> rows;
  final List<String> lines;
  final bool ready;
  final String copyText;
  final int? timerSeconds;
  final String? timerLabel;
  final RtcfcData? rtcfc;
  final bool needsStructure;
}

const _exampleSeeds = {
  QuickGadgetIntent.tip: 'tip 18% on \$70',
  QuickGadgetIntent.split: 'split \$40 for 3',
  QuickGadgetIntent.convert: '10 km to mi',
  QuickGadgetIntent.timer: '25 min focus',
  QuickGadgetIntent.rtcfc:
      'Role: staff engineer. Task: review this PR for correctness and security risks. Context: NestJS monorepo. Format: Markdown severity table P0–P3. Constraints: Skip style nits.',
};

String exampleSeed(QuickGadgetIntent intent) => _exampleSeeds[intent]!;

bool isQuickGadgetIntent(String v) =>
    QuickGadgetIntent.values.any((e) => e.name == v);

QuickGadgetIntent? parseQuickGadgetIntent(String v) {
  for (final e in QuickGadgetIntent.values) {
    if (e.name == v) return e;
  }
  return null;
}

GadgetResult? resolveQuickGadget(
  String text, [
  QuickGadgetIntent? preferredIntent,
]) {
  var query = text.trim();
  final preferred = preferredIntent;
  if (query.isEmpty && preferred != null) query = exampleSeed(preferred);
  if (query.isEmpty) return null;

  final intent = preferred ?? detectQuickIntent(query);
  if (intent == null) return null;

  switch (intent) {
    case QuickGadgetIntent.tip:
      return _buildTip(query);
    case QuickGadgetIntent.split:
      return _buildSplit(query);
    case QuickGadgetIntent.convert:
      return _buildConvert(query);
    case QuickGadgetIntent.timer:
      return _buildTimer(query);
    case QuickGadgetIntent.rtcfc:
      return _buildRtcfc(query);
  }
}

QuickGadgetIntent? detectQuickIntent(String text) {
  final t = text.toLowerCase();
  final scores = <QuickGadgetIntent, int>{};

  if (RegExp(r'\b(tip|gratuity|service\s*charge|%|percent)\b', caseSensitive: false)
      .hasMatch(text)) {
    scores[QuickGadgetIntent.tip] = (scores[QuickGadgetIntent.tip] ?? 0) + 6;
  }
  if (RegExp(r'\b(split|divide|share|ways)\b').hasMatch(t)) {
    scores[QuickGadgetIntent.split] = (scores[QuickGadgetIntent.split] ?? 0) + 6;
  }
  if (RegExp(r'\b(convert|km|mi|kg|lb|celsius|fahrenheit|°)\b').hasMatch(t)) {
    scores[QuickGadgetIntent.convert] =
        (scores[QuickGadgetIntent.convert] ?? 0) + 6;
  }
  if (RegExp(r'\b(timer|minute|min|pomodoro|countdown|hour)\b').hasMatch(t)) {
    scores[QuickGadgetIntent.timer] = (scores[QuickGadgetIntent.timer] ?? 0) + 6;
  }
  if (RegExp(r'\brtcfc\b').hasMatch(t) ||
      RegExp(r'\b(role|task|context|format|constraints)\s*:', caseSensitive: false)
          .hasMatch(text)) {
    scores[QuickGadgetIntent.rtcfc] =
        (scores[QuickGadgetIntent.rtcfc] ?? 0) + 8;
  }

  QuickGadgetIntent? best;
  var bestScore = 0;
  for (final e in scores.entries) {
    if (e.value > bestScore) {
      best = e.key;
      bestScore = e.value;
    }
  }
  return best;
}

String _money(num n, String currency) {
  final fixed = n == n.roundToDouble() ? '${n.round()}' : n.toStringAsFixed(2);
  return '$currency$fixed';
}

GadgetResult _buildTip(String query) {
  final d = parseTip(query);
  final pct = d.tipPercent ?? 15;
  final assumed = d.tipPercent == null;
  final amounts = tipAmounts(
    total: d.total ?? 0,
    tipPercent: pct,
    people: d.people,
  );
  final cur = d.currency;
  final rows = <GadgetRow>[
    GadgetRow(label: 'Bill', value: _money(d.total ?? 0, cur)),
    GadgetRow(
      label: assumed ? 'Tip ($pct% assumed)' : 'Tip ($pct%)',
      value: _money(amounts.tip, cur),
    ),
    GadgetRow(label: 'Total', value: _money(amounts.grand, cur), bold: true),
  ];
  if (amounts.each != null) {
    rows.add(GadgetRow(label: 'Each', value: _money(amounts.each!, cur)));
  }
  final copyText = rows.map((r) => '${r.label}: ${r.value}').join('\n');
  return GadgetResult(
    intent: QuickGadgetIntent.tip,
    query: query,
    title: 'Tip calculator',
    badge: '$pct%',
    amount: _money(amounts.tip, cur),
    meta: d.total != null ? 'Ready' : 'Add a bill amount',
    rows: rows,
    lines: rows.map((r) => '${r.label}: ${r.value}').toList(),
    ready: d.total != null && d.total! > 0,
    copyText: copyText,
  );
}

GadgetResult _buildSplit(String query) {
  final d = parseSplit(query);
  final people = d.people != null && d.people! > 0 ? d.people : null;
  final each = d.total != null && people != null
      ? ((d.total! / people) * 100).roundToDouble() / 100
      : null;
  final cur = d.currency;
  final rows = [
    GadgetRow(label: 'Total', value: _money(d.total ?? 0, cur)),
    GadgetRow(label: 'People', value: people != null ? '$people' : '—'),
    GadgetRow(
      label: 'Each',
      value: each != null ? _money(each, cur) : '—',
      bold: true,
    ),
  ];
  return GadgetResult(
    intent: QuickGadgetIntent.split,
    query: query,
    title: 'Split bill',
    badge: people != null ? '$people ways' : null,
    amount: each != null ? _money(each, cur) : null,
    meta: each != null ? 'Ready' : 'Add total and people',
    rows: rows,
    lines: rows.map((r) => '${r.label}: ${r.value}').toList(),
    ready: each != null,
    copyText: rows.map((r) => '${r.label}: ${r.value}').join('\n'),
  );
}

GadgetResult _buildConvert(String query) {
  final d = parseConvert(query);
  final fromLabel = d.from != null ? (unitLabels[d.from!] ?? d.from!) : '?';
  final toLabel = d.to != null ? (unitLabels[d.to!] ?? d.to!) : '?';
  String resultStr = '—';
  if (d.result != null) {
    final r = d.result!;
    resultStr = r == r.roundToDouble()
        ? '${r.round()}'
        : r.toStringAsFixed(4).replaceAll(RegExp(r'\.?0+$'), '');
  }
  final rows = [
    GadgetRow(
      label: 'From',
      value: d.value != null ? '${d.value} $fromLabel' : '—',
    ),
    GadgetRow(label: 'To', value: '$resultStr $toLabel', bold: true),
  ];
  return GadgetResult(
    intent: QuickGadgetIntent.convert,
    query: query,
    title: 'Unit convert',
    badge: d.from != null && d.to != null ? '$fromLabel→$toLabel' : null,
    amount: d.result != null ? '$resultStr $toLabel' : null,
    meta: d.result != null ? 'Ready' : 'Try “10 km to mi”',
    rows: rows,
    lines: rows.map((r) => '${r.label}: ${r.value}').toList(),
    ready: d.result != null,
    copyText: d.value != null && d.result != null
        ? '${d.value} $fromLabel = $resultStr $toLabel'
        : rows.map((r) => '${r.label}: ${r.value}').join('\n'),
  );
}

GadgetResult _buildTimer(String query) {
  final d = parseTimer(query);
  final clock = d.seconds != null ? formatClock(d.seconds!) : '—';
  final rows = [
    GadgetRow(label: 'Duration', value: clock, bold: true),
    GadgetRow(label: 'Label', value: d.label.isEmpty ? 'Timer' : d.label),
  ];
  return GadgetResult(
    intent: QuickGadgetIntent.timer,
    query: query,
    title: 'Timer',
    badge: d.seconds != null ? clock : null,
    amount: clock,
    meta: d.seconds != null ? 'Ready' : 'Try “25 min focus”',
    rows: rows,
    lines: rows.map((r) => '${r.label}: ${r.value}').toList(),
    ready: d.seconds != null && d.seconds! > 0,
    copyText: '${d.label.isEmpty ? 'Timer' : d.label} $clock'.trim(),
    timerSeconds: d.seconds,
    timerLabel: d.label.isEmpty ? 'Timer' : d.label,
  );
}

GadgetResult gadgetFromRtcfc(RtcfcData data, [String query = '']) {
  final filled = rtcfcFields.where((k) => data[k].trim().isNotEmpty).length;
  final composed = composeRtcfc(data);
  final q = (query.isNotEmpty ? query : composed).trim();
  return GadgetResult(
    intent: QuickGadgetIntent.rtcfc,
    query: q.isEmpty ? composed : q,
    title: 'RTCFC',
    badge: filled > 0 ? '$filled/5' : null,
    meta: filled > 0 ? '$filled/5 fields' : 'Needs structure',
    rows: rtcfcFields
        .map(
          (k) => GadgetRow(
            label: '${k[0].toUpperCase()}${k.substring(1)}',
            value: data[k].isEmpty ? '—' : data[k],
            bold: k == 'task',
          ),
        )
        .toList(),
    lines: composed.split('\n'),
    ready: filled > 0,
    copyText: composed,
    needsStructure: filled == 0 && rtcfcSourceBody(q).isNotEmpty,
    rtcfc: data.copy(),
  );
}

GadgetResult _buildRtcfc(String query) {
  final data = parseRtcfc(query);
  final filled = rtcfcFields.where((k) => data[k].trim().isNotEmpty).length;
  if (filled > 0) return gadgetFromRtcfc(data, query);
  final body = rtcfcSourceBody(query);
  if (body.isNotEmpty) {
    final empty = gadgetFromRtcfc(RtcfcData(), query);
    return GadgetResult(
      intent: empty.intent,
      query: empty.query,
      title: empty.title,
      badge: empty.badge,
      meta: 'Needs structure',
      rows: empty.rows,
      lines: [
        'Freeform prompt — Structure to fill Role / Task / Context / Format / Constraints.',
        '',
        body.length > 400 ? body.substring(0, 400) : body,
      ],
      ready: false,
      copyText: body,
      needsStructure: true,
      rtcfc: empty.rtcfc,
    );
  }
  final rolled = rollRtcfc();
  return gadgetFromRtcfc(rolled, composeRtcfc(rolled));
}

GadgetResult rollRtcfcGadget([RtcfcData? exclude]) {
  final rolled = rollRtcfc(null, exclude);
  return gadgetFromRtcfc(rolled, composeRtcfc(rolled));
}
