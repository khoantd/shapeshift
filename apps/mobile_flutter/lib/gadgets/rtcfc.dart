import 'dart:math';

import 'common.dart';

class RtcfcData {
  const RtcfcData({
    this.role = '',
    this.task = '',
    this.context = '',
    this.format = '',
    this.constraints = '',
  });

  final String role;
  final String task;
  final String context;
  final String format;
  final String constraints;

  String operator [](String key) {
    switch (key) {
      case 'role':
        return role;
      case 'task':
        return task;
      case 'context':
        return context;
      case 'format':
        return format;
      case 'constraints':
        return constraints;
      default:
        return '';
    }
  }

  RtcfcData copyWith({
    String? role,
    String? task,
    String? context,
    String? format,
    String? constraints,
  }) {
    return RtcfcData(
      role: role ?? this.role,
      task: task ?? this.task,
      context: context ?? this.context,
      format: format ?? this.format,
      constraints: constraints ?? this.constraints,
    );
  }

  RtcfcData copy() => copyWith();
}

const rtcfcFields = ['role', 'task', 'context', 'format', 'constraints'];

final _labelRe = RegExp(
  r'(?:\*\*)?(Role|Task|Context|Format|Constraints)(?:\*\*)?\s*:\s*',
  caseSensitive: false,
);

String rtcfcSourceBody(String text) => text
    .replaceAll(RegExp(r'\brtcfc\b', caseSensitive: false), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

RtcfcData parseRtcfc(String text) {
  var data = const RtcfcData();
  final raw = rtcfcSourceBody(text);
  if (raw.isEmpty) return data;

  final matches = _labelRe.allMatches(raw).toList();
  if (matches.isEmpty) return data;

  for (var i = 0; i < matches.length; i++) {
    final m = matches[i];
    final field = m.group(1)!.toLowerCase();
    final start = m.end;
    final end = i + 1 < matches.length ? matches[i + 1].start : raw.length;
    var value = collapse(raw.substring(start, end));
    value = value
        .replaceFirst(RegExp(r'^[.;]\s*'), '')
        .replaceFirst(RegExp(r'\s*[.;]\s*$'), '');
    switch (field) {
      case 'role':
        data = data.copyWith(role: value);
      case 'task':
        data = data.copyWith(task: value);
      case 'context':
        data = data.copyWith(context: value);
      case 'format':
        data = data.copyWith(format: value);
      case 'constraints':
        data = data.copyWith(constraints: value);
    }
  }
  return data;
}

String composeRtcfc(RtcfcData d) => rtcfcFields
    .map((k) => '${k[0].toUpperCase()}${k.substring(1)}: ${d[k]}')
    .join('\n');

const rtcfcSamples = [
  RtcfcData(
    role: 'staff engineer',
    task: 'review this PR for correctness and security risks',
    context: 'NestJS monorepo with apps/api and packages/shared',
    format: 'Markdown severity table P0–P3, max 15 findings',
    constraints: 'Skip style nits. Prefer concrete file:line references',
  ),
  RtcfcData(
    role: 'senior marketer',
    task: 'write 3 Zalo outreach messages for a free CRM trial',
    context: 'SME owners in Ho Chi Minh City, busy founders',
    format: '≤400 characters each, Vietnamese, numbered list',
    constraints: 'No emojis in the first line. Soft CTA only',
  ),
  RtcfcData(
    role: 'product designer',
    task: 'critique this onboarding flow and propose 3 fixes',
    context: 'B2B SaaS, first-run empty state after signup',
    format: 'Bullet list: problem → why → suggested fix',
    constraints: 'Stay within existing component library. No new pages',
  ),
  RtcfcData(
    role: 'technical writer',
    task: 'draft a README quickstart for a TypeScript CLI',
    context: 'Open-source tool published on npm, Node 20+',
    format: 'Markdown: Install, Usage, Flags, Example',
    constraints: 'Assume zero prior context. No marketing fluff',
  ),
  RtcfcData(
    role: 'QA lead',
    task: 'generate regression test cases for the checkout path',
    context: 'E-commerce web app with Stripe and guest checkout',
    format: 'Table: ID, Steps, Expected, Priority',
    constraints: 'Include at least 2 negative paths. No UI copy changes',
  ),
  RtcfcData(
    role: 'executive coach',
    task: 'turn raw notes into a 5-bullet CEO brief',
    context: 'Mid-market expansion decision for a SaaS company',
    format: 'Exactly 5 bullets, one sentence each',
    constraints: 'No jargon. Flag unknowns explicitly',
  ),
];

bool _sameRtcfc(RtcfcData a, RtcfcData b) =>
    rtcfcFields.every((k) => a[k] == b[k]);

RtcfcData rollRtcfc([Random? rand, RtcfcData? exclude]) {
  final r = rand ?? Random();
  final pool = exclude != null && rtcfcSamples.length > 1
      ? rtcfcSamples.where((s) => !_sameRtcfc(s, exclude)).toList()
      : List<RtcfcData>.from(rtcfcSamples);
  return pool[r.nextInt(pool.length)].copy();
}
