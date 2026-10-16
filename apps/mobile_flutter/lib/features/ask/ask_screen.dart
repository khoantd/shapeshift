import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_core.dart';
import '../../gadgets/gadgets.dart';
import '../../providers.dart';
import '../../recent/recent_core.dart';
import '../../recent/recent_store.dart';
import '../../settings/settings_core.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

class AskScreen extends ConsumerStatefulWidget {
  const AskScreen({super.key});

  @override
  ConsumerState<AskScreen> createState() => _AskScreenState();
}

class _AskScreenState extends ConsumerState<AskScreen> {
  static const chips = ['Ask', 'Summarize', 'Translate'];
  var chip = 'Ask';
  final queryCtrl = TextEditingController();
  var busy = false;
  String? status;
  var recent = <RecentItem>[];
  final recentQCtrl = TextEditingController();
  var page = 1;

  @override
  void initState() {
    super.initState();
    loadRecent().then((items) {
      if (mounted) setState(() => recent = items);
    });
  }

  @override
  void dispose() {
    queryCtrl.dispose();
    recentQCtrl.dispose();
    super.dispose();
  }

  String get placeholder {
    switch (chip) {
      case 'Summarize':
        return 'Paste a link or article to summarize…';
      case 'Translate':
        return 'Text to translate…';
      default:
        return 'Ask anything or paste a link...';
    }
  }

  String seedText(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return '';
    if (chip == 'Summarize' && !RegExp(r'^summar', caseSensitive: false).hasMatch(t)) {
      return 'Summarize: $t';
    }
    if (chip == 'Translate' && !RegExp(r'^translat', caseSensitive: false).hasMatch(t)) {
      return 'Translate: $t';
    }
    return t;
  }

  Future<void> routeIntent(String text, String top) async {
    final settings = ref.read(settingsProvider).value ??
        const MeanboxSettings();
    final hrefOpen = meanboxHref('/?q=${Uri.encodeComponent(text)}', settings);

    if (top == 'news' || top == 'link') {
      recent = await appendRecent(
        title: text,
        meta: 'News · just now',
        kind: RecentKind.news,
      );
      setState(() {});
      if (mounted) context.go('/news');
      return;
    }
    if (top == 'youtube' || top == 'video') {
      recent = await appendRecent(
        title: text,
        meta: 'Study · just now',
        kind: RecentKind.study,
      );
      setState(() {});
      if (mounted) context.go('/study?q=${Uri.encodeComponent(text)}');
      return;
    }
    if (isQuickGadgetIntent(top) ||
        const {'tip', 'split', 'convert', 'timer', 'rtcfc'}.contains(top)) {
      final intent = isQuickGadgetIntent(top) ? top : 'tip';
      recent = await appendRecent(
        title: text,
        meta: 'Gadget · $intent',
        kind: intent == 'split' ? RecentKind.split : RecentKind.gadget,
      );
      setState(() {});
      if (mounted) {
        context.go(
          '/tools?gadget=$intent&q=${Uri.encodeComponent(text)}',
        );
      }
      return;
    }

    recent = await appendRecent(
      title: text,
      meta: 'Ask · $top',
      kind: RecentKind.ask,
      href: hrefOpen,
    );
    setState(() {});
    final uri = Uri.tryParse(hrefOpen);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> submit() async {
    final text = seedText(queryCtrl.text);
    if (text.isEmpty || busy) return;
    setState(() {
      busy = true;
      status = null;
    });
    try {
      final client = ref.read(meanboxClientProvider);
      final result = await client.classifyIntent(text);
      final top = intentTopKey(result);
      setState(() => status = 'Routed · $top');
      await routeIntent(text, top);
    } catch (e) {
      setState(() => status = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = pageRecentItems(
      filterRecentItems(recent, recentQCtrl.text),
      page,
    );
    final filteredTotal =
        filterRecentItems(recent, recentQCtrl.text).length;

    return MbScreen(
      child: ListView(
        children: [
          const SizedBox(height: 8),
          const MeanboxLogo(
            variant: MeanboxLogoVariant.lockup,
            height: 28,
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final c in chips)
                  MbChip(
                    label: c,
                    selected: chip == c,
                    onTap: () => setState(() => chip = c),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: MeanboxColor.card,
              borderRadius: BorderRadius.circular(MeanboxRadius.shell),
              boxShadow: [
                BoxShadow(
                  color: MeanboxColor.foreground.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: queryCtrl,
                    minLines: 1,
                    maxLines: 4,
                    style: MeanboxType.body,
                    decoration: InputDecoration(
                      hintText: placeholder,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                    ),
                    onSubmitted: (_) => submit(),
                  ),
                ),
                IconButton.filled(
                  onPressed: busy ? null : submit,
                  style: IconButton.styleFrom(
                    backgroundColor: MeanboxColor.primary,
                    foregroundColor: MeanboxColor.primaryForeground,
                    minimumSize: const Size(
                      MeanboxSpacing.touchMin,
                      MeanboxSpacing.touchMin,
                    ),
                  ),
                  icon: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: MeanboxColor.primaryForeground,
                          ),
                        )
                      : const Icon(LucideIcons.arrowRight, size: 18),
                ),
              ],
            ),
          ),
          if (status != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(status!, style: MeanboxType.caption),
            ),
          const MbSectionLabel('Recent'),
          TextField(
            controller: recentQCtrl,
            decoration: const InputDecoration(
              hintText: 'Search recent…',
              prefixIcon: Icon(LucideIcons.search, size: 18),
            ),
            onChanged: (_) => setState(() => page = 1),
          ),
          const SizedBox(height: 8),
          if (filtered.isEmpty)
            Text(
              'Your Ask / News / Study / Tools history shows up here.',
              style: MeanboxType.caption,
            )
          else
            ...filtered.map(
              (item) => MbListRow(
                title: item.title,
                meta: item.meta,
                leading: MbIconTile(
                  child: Icon(
                    switch (item.kind) {
                      RecentKind.news => LucideIcons.newspaper,
                      RecentKind.study => LucideIcons.bookOpen,
                      RecentKind.split || RecentKind.gadget =>
                        LucideIcons.slidersHorizontal,
                      _ => LucideIcons.search,
                    },
                    size: 18,
                    color: MeanboxColor.ink2,
                  ),
                ),
                onTap: item.href != null
                    ? () {
                        final u = Uri.tryParse(item.href!);
                        if (u != null) {
                          launchUrl(u, mode: LaunchMode.externalApplication);
                        }
                      }
                    : null,
              ),
            ),
          if (filteredTotal > filtered.length)
            TextButton(
              onPressed: () => setState(() => page += 1),
              child: const Text('Load more'),
            ),
        ],
      ),
    );
  }
}
