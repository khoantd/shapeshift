import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../api/api_core.dart';
import '../../providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

class NewsScreen extends ConsumerStatefulWidget {
  const NewsScreen({super.key});

  @override
  ConsumerState<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends ConsumerState<NewsScreen> {
  static const categories = ['Top', 'Tech', 'World', 'Science'];
  var cat = 'Top';
  var items = <NewsFeedItem>[];
  var loading = true;
  String? error;
  var searchOpen = false;
  final queryCtrl = TextEditingController();

  @override
  void dispose() {
    queryCtrl.dispose();
    super.dispose();
  }

  Future<void> load({bool soft = false}) async {
    if (!soft) setState(() => loading = true);
    setState(() => error = null);
    try {
      final client = ref.read(meanboxClientProvider);
      final res = await client.fetchNews(
        q: queryCtrl.text.trim().isEmpty ? null : queryCtrl.text.trim(),
      );
      if (res['success'] != true) {
        setState(() {
          items = [];
          error = '${res['error'] ?? 'Could not load news'}';
        });
        return;
      }
      final raw = res['items'];
      final list = <NewsFeedItem>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is Map) {
            list.add(NewsFeedItem.fromJson(Map<String, dynamic>.from(e)));
          }
        }
      }
      setState(() => items = list);
    } catch (e) {
      setState(() {
        items = [];
        error = e.toString();
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
    final filtered =
        items.where((item) => newsCategoryMatch(item, cat)).toList();

    return MbScreen(
      child: RefreshIndicator(
        color: MeanboxColor.brand,
        onRefresh: () => load(soft: true),
        child: ListView(
          children: [
            MbScreenHeader(
              title: 'News',
              action: Icon(
                searchOpen ? LucideIcons.x : LucideIcons.search,
                size: 18,
                color: MeanboxColor.ink2,
              ),
              onAction: () => setState(() => searchOpen = !searchOpen),
            ),
            if (searchOpen)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: queryCtrl,
                  decoration: const InputDecoration(hintText: 'Search news…'),
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => load(),
                ),
              ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final c in categories)
                    MbChip(
                      label: c,
                      selected: cat == c,
                      onTap: () => setState(() => cat = c),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: CircularProgressIndicator(color: MeanboxColor.brand),
                ),
              )
            else if (error != null)
              Text(
                error!,
                style: MeanboxType.body.copyWith(color: MeanboxColor.destructive),
              )
            else if (filtered.isEmpty)
              Text(
                'No stories yet. Pull to refresh or check API / IC env.',
                style: MeanboxType.caption,
              )
            else
              ...filtered.map((item) {
                return InkWell(
                  onTap: () {
                    final q = {
                      'title': item.title,
                      'excerpt': item.excerpt,
                      'canonicalUrl': item.canonicalUrl,
                      'source': item.sourceDisplayName ?? '',
                      'publishedAt': item.publishedAt,
                    };
                    final qs = q.entries
                        .where((e) => e.value.isNotEmpty)
                        .map(
                          (e) =>
                              '${e.key}=${Uri.encodeComponent(e.value)}',
                        )
                        .join('&');
                    context.push('/news/${Uri.encodeComponent(item.id)}?$qs');
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title, style: MeanboxType.callout),
                        const SizedBox(height: 4),
                        Text(
                          [
                            if ((item.sourceDisplayName ?? '').isNotEmpty)
                              item.sourceDisplayName!,
                            if (item.publishedAt.isNotEmpty)
                              formatRelativeTime(item.publishedAt),
                          ].join(' · '),
                          style: MeanboxType.caption,
                        ),
                        if (item.excerpt.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            item.excerpt,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: MeanboxType.caption.copyWith(
                              color: MeanboxColor.ink2,
                            ),
                          ),
                        ],
                        const Divider(height: 24, color: MeanboxColor.border),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
