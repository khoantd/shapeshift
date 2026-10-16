import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../gadgets/gadgets.dart';
import '../../gadgets/rtcfc.dart';
import '../../gadgets/timer.dart' show formatClock;
import '../../providers.dart';
import '../../settings/settings_core.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

class ToolsScreen extends ConsumerStatefulWidget {
  const ToolsScreen({super.key, this.gadget, this.q});

  final String? gadget;
  final String? q;

  @override
  ConsumerState<ToolsScreen> createState() => _ToolsScreenState();
}

class _ToolsScreenState extends ConsumerState<ToolsScreen> {
  late QuickGadgetIntent active;
  late final inputCtrl = TextEditingController();
  GadgetResult? result;
  var structuring = false;
  var copied = false;
  int? timerLeft;
  var timerRunning = false;
  Timer? _tick;

  static const gadgets = [
    (QuickGadgetIntent.tip, 'Tip'),
    (QuickGadgetIntent.split, 'Split'),
    (QuickGadgetIntent.convert, 'Convert'),
    (QuickGadgetIntent.timer, 'Timer'),
    (QuickGadgetIntent.rtcfc, 'RTCFC'),
  ];

  @override
  void initState() {
    super.initState();
    active = parseQuickGadgetIntent(widget.gadget ?? '') ?? QuickGadgetIntent.tip;
    final text = (widget.q ?? '').trim().isNotEmpty
        ? widget.q!.trim()
        : exampleSeed(active);
    inputCtrl.text = text;
    result = resolveQuickGadget(text, active);
  }

  @override
  void didUpdateWidget(covariant ToolsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final g = parseQuickGadgetIntent(widget.gadget ?? '');
    final q = (widget.q ?? '').trim();
    if (g != null &&
        (g != parseQuickGadgetIntent(oldWidget.gadget ?? '') ||
            q != (oldWidget.q ?? '').trim())) {
      setState(() {
        active = g;
        final text = q.isNotEmpty ? q : exampleSeed(g);
        inputCtrl.text = text;
        result = resolveQuickGadget(text, g);
      });
    } else if (q.isNotEmpty && q != (oldWidget.q ?? '').trim()) {
      setState(() {
        inputCtrl.text = q;
        result = resolveQuickGadget(q, active);
      });
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    inputCtrl.dispose();
    super.dispose();
  }

  void onChangeInput(String text) {
    setState(() {
      result = resolveQuickGadget(text, active);
      copied = false;
    });
  }

  void onSelect(QuickGadgetIntent id) {
    final text = exampleSeed(id);
    setState(() {
      active = id;
      inputCtrl.text = text;
      result = resolveQuickGadget(text, id);
      copied = false;
      timerRunning = false;
      timerLeft = null;
      _tick?.cancel();
    });
  }

  Future<void> onCopy() async {
    final text = result?.copyText;
    if (text == null || text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    setState(() => copied = true);
  }

  Future<void> onStructure() async {
    if (result?.intent != QuickGadgetIntent.rtcfc) return;
    setState(() => structuring = true);
    try {
      final client = ref.read(meanboxClientProvider);
      final res = await client.structureRtcfc(text: inputCtrl.text);
      if (res['success'] == true && res['data'] is Map) {
        final d = Map<String, dynamic>.from(res['data'] as Map);
        setState(() {
          result = gadgetFromRtcfc(
            RtcfcData(
              role: '${d['role'] ?? ''}',
              task: '${d['task'] ?? ''}',
              context: '${d['context'] ?? ''}',
              format: '${d['format'] ?? ''}',
              constraints: '${d['constraints'] ?? ''}',
            ),
            inputCtrl.text,
          );
        });
      }
    } finally {
      if (mounted) setState(() => structuring = false);
    }
  }

  void startTimer() {
    final secs = result?.timerSeconds;
    if (secs == null || secs <= 0) return;
    _tick?.cancel();
    setState(() {
      timerLeft = secs;
      timerRunning = true;
    });
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (timerLeft == null || timerLeft! <= 1) {
          timerLeft = 0;
          timerRunning = false;
          _tick?.cancel();
        } else {
          timerLeft = timerLeft! - 1;
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider).value ??
        const MeanboxSettings();
    final r = result;

    return MbScreen(
      child: ListView(
        children: [
          const MbScreenHeader(title: 'Tools'),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final (id, label) in gadgets)
                  MbChip(
                    label: label,
                    selected: active == id,
                    onTap: () => onSelect(id),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: inputCtrl,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(hintText: 'Describe what to do…'),
            onChanged: onChangeInput,
          ),
          const SizedBox(height: 12),
          if (r != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: MeanboxColor.card,
                borderRadius: BorderRadius.circular(MeanboxRadius.lg),
                border: Border.all(color: MeanboxColor.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(r.title, style: MeanboxType.callout),
                      const Spacer(),
                      if (r.badge != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: MeanboxColor.brandSoft,
                            borderRadius:
                                BorderRadius.circular(MeanboxRadius.pill),
                          ),
                          child: Text(
                            r.badge!,
                            style: MeanboxType.micro
                                .copyWith(color: MeanboxColor.brand),
                          ),
                        ),
                    ],
                  ),
                  Text(r.meta, style: MeanboxType.caption),
                  const SizedBox(height: 8),
                  for (final row in r.rows)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              row.label,
                              style: MeanboxType.caption,
                            ),
                          ),
                          Text(
                            row.value,
                            style: MeanboxType.callout.copyWith(
                              fontWeight:
                                  row.bold ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (r.intent == QuickGadgetIntent.timer && r.ready) ...[
                    const SizedBox(height: 8),
                    Text(
                      formatClock(timerLeft ?? r.timerSeconds ?? 0),
                      style: MeanboxType.display,
                    ),
                    Row(
                      children: [
                        TextButton(
                          onPressed: timerRunning
                              ? () {
                                  _tick?.cancel();
                                  setState(() => timerRunning = false);
                                }
                              : startTimer,
                          child: Text(timerRunning ? 'Pause' : 'Start'),
                        ),
                        TextButton(
                          onPressed: () {
                            _tick?.cancel();
                            setState(() {
                              timerRunning = false;
                              timerLeft = r.timerSeconds;
                            });
                          },
                          child: const Text('Reset'),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: onCopy,
                        icon: const Icon(LucideIcons.copy, size: 16),
                        label: Text(copied ? 'Copied' : 'Copy'),
                      ),
                      if (r.intent == QuickGadgetIntent.rtcfc) ...[
                        OutlinedButton(
                          onPressed: () {
                            final rolled = rollRtcfcGadget(r.rtcfc);
                            setState(() {
                              result = rolled;
                              inputCtrl.text = rolled.copyText;
                            });
                          },
                          child: const Text('Roll again'),
                        ),
                        FilledButton(
                          onPressed: structuring ? null : onStructure,
                          style: FilledButton.styleFrom(
                            backgroundColor: MeanboxColor.primary,
                          ),
                          child: Text(structuring ? '…' : 'Structure'),
                        ),
                      ],
                      TextButton(
                        onPressed: () {
                          final href = meanboxHref(
                            '/gadgets?q=${Uri.encodeComponent(inputCtrl.text)}',
                            settings,
                          );
                          final u = Uri.tryParse(href);
                          if (u != null) {
                            launchUrl(u, mode: LaunchMode.externalApplication);
                          }
                        },
                        child: const Text('Open in Meanbox'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
