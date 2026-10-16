import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_core.dart';
import '../../lib_utils.dart';
import '../../providers.dart';
import '../../settings/settings_core.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

class NewsDetailScreen extends ConsumerStatefulWidget {
  const NewsDetailScreen({
    super.key,
    required this.id,
    this.title = 'Story',
    this.excerpt = '',
    this.canonicalUrl = '',
    this.source = '',
    this.publishedAt = '',
  });

  final String id;
  final String title;
  final String excerpt;
  final String canonicalUrl;
  final String source;
  final String publishedAt;

  @override
  ConsumerState<NewsDetailScreen> createState() => _NewsDetailScreenState();
}

class _NewsDetailScreenState extends ConsumerState<NewsDetailScreen> {
  var body = '';
  var loading = true;
  String? error;
  var citeSources = <Map<String, dynamic>>[];

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final settings = ref.read(settingsProvider).value ??
          const MeanboxSettings();
      final client = ref.read(meanboxClientProvider);
      final res = await client.generateNewsDeepDive(
        id: widget.id.isEmpty ? null : widget.id,
        title: widget.title,
        excerpt: widget.excerpt,
        canonicalUrl:
            widget.canonicalUrl.isEmpty ? null : widget.canonicalUrl,
        language: deepDiveLanguage(settings.locale),
      );
      if (res['success'] != true || res['text'] == null) {
        setState(() {
          error = '${res['error'] ?? 'Deep dive failed'}';
          body = widget.excerpt;
          citeSources = [];
        });
        return;
      }
      final sources = <Map<String, dynamic>>[];
      final raw = res['sources'];
      if (raw is List) {
        for (final s in raw) {
          if (s is Map && s['title'] != null && s['url'] != null) {
            sources.add(Map<String, dynamic>.from(s));
          }
        }
      }
      setState(() {
        body = '${res['text']}';
        citeSources = sources;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        body = widget.excerpt;
        citeSources = [];
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  @override
  Widget build(BuildContext context) {
    final meta = [
      if (widget.source.isNotEmpty) widget.source,
      if (widget.publishedAt.isNotEmpty)
        formatRelativeTime(widget.publishedAt),
    ].join(' · ');
    final paragraphs = splitProseParagraphs(body);

    return MbScreen(
      padTabBar: false,
      child: ListView(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => context.pop(),
                style: IconButton.styleFrom(
                  backgroundColor: MeanboxColor.muted,
                  minimumSize: const Size(
                    MeanboxSpacing.touchMin,
                    MeanboxSpacing.touchMin,
                  ),
                ),
                icon: const Icon(LucideIcons.chevronLeft, size: 20),
              ),
              const Spacer(),
              if (widget.canonicalUrl.isNotEmpty)
                TextButton(
                  onPressed: () {
                    final u = Uri.tryParse(widget.canonicalUrl);
                    if (u != null) {
                      launchUrl(u, mode: LaunchMode.externalApplication);
                    }
                  },
                  child: const Text('Open source'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(widget.title, style: MeanboxType.title),
          if (meta.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(meta, style: MeanboxType.caption),
            ),
          const SizedBox(height: 16),
          if (loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: MeanboxColor.brand),
              ),
            )
          else ...[
            if (error != null)
              Text(
                error!,
                style:
                    MeanboxType.caption.copyWith(color: MeanboxColor.destructive),
              ),
            for (final p in paragraphs)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(p, style: MeanboxType.bodyReader),
              ),
            if (citeSources.isNotEmpty) ...[
              const MbSectionLabel('Sources'),
              for (final s in citeSources.take(5))
                MbListRow(
                  title: '${s['title']}',
                  meta: '${s['url']}',
                  onTap: () {
                    final u = Uri.tryParse('${s['url']}');
                    if (u != null) {
                      launchUrl(u, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
            ],
          ],
        ],
      ),
    );
  }
}
