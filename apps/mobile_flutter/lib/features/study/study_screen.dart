import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../api/api_core.dart';
import '../../providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

class StudyScreen extends ConsumerStatefulWidget {
  const StudyScreen({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends ConsumerState<StudyScreen> {
  late final queryCtrl = TextEditingController(text: widget.initialQuery ?? '');
  var videos = <YouTubeVideo>[];
  var loading = false;
  String? error;

  @override
  void initState() {
    super.initState();
    final seeded = (widget.initialQuery ?? '').trim();
    if (seeded.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => runSearch(seeded));
    }
  }

  @override
  void didUpdateWidget(covariant StudyScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = (widget.initialQuery ?? '').trim();
    if (next.isNotEmpty && next != (oldWidget.initialQuery ?? '').trim()) {
      queryCtrl.text = next;
      runSearch(next);
    }
  }

  @override
  void dispose() {
    queryCtrl.dispose();
    super.dispose();
  }

  Future<void> runSearch([String? override]) async {
    final query = (override ?? queryCtrl.text).trim();
    if (query.isEmpty) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final client = ref.read(meanboxClientProvider);
      final res = await client.searchYouTube(query);
      if (res['success'] != true) {
        setState(() {
          videos = [];
          error = '${res['error'] ?? 'Search failed'}';
        });
        return;
      }
      final list = <YouTubeVideo>[];
      final raw = res['videos'];
      if (raw is List) {
        for (final e in raw) {
          if (e is Map) {
            list.add(YouTubeVideo.fromJson(Map<String, dynamic>.from(e)));
          }
        }
      }
      setState(() => videos = list);
    } catch (e) {
      setState(() {
        videos = [];
        error = e.toString();
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MbScreen(
      child: ListView(
        children: [
          const MbScreenHeader(title: 'Study'),
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
            padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: queryCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Search a lecture or paste a video URL…',
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => runSearch(),
                  ),
                ),
                IconButton.filled(
                  onPressed: () => runSearch(),
                  style: IconButton.styleFrom(
                    backgroundColor: MeanboxColor.primary,
                    foregroundColor: MeanboxColor.primaryForeground,
                  ),
                  icon: const Icon(LucideIcons.search, size: 18),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (loading)
            const Center(
              child: CircularProgressIndicator(color: MeanboxColor.brand),
            )
          else if (error != null)
            Text(
              error!,
              style: MeanboxType.body.copyWith(color: MeanboxColor.destructive),
            )
          else if (videos.isEmpty)
            Text(
              'Search YouTube to open a study companion and generate a learning pack.',
              style: MeanboxType.caption,
            )
          else
            ...videos.map((v) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Material(
                  color: MeanboxColor.card,
                  borderRadius: BorderRadius.circular(MeanboxRadius.lg),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(MeanboxRadius.lg),
                    onTap: () => context.push(
                      '/study/${Uri.encodeComponent(v.videoId)}'
                      '?title=${Uri.encodeComponent(v.title)}'
                      '&channelTitle=${Uri.encodeComponent(v.channelTitle ?? '')}',
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: MeanboxColor.brandSoft,
                              borderRadius:
                                  BorderRadius.circular(MeanboxRadius.md),
                            ),
                            child: const Icon(
                              LucideIcons.play,
                              color: MeanboxColor.brand,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(v.title, style: MeanboxType.callout),
                                if ((v.channelTitle ?? '').isNotEmpty)
                                  Text(
                                    v.channelTitle!,
                                    style: MeanboxType.caption,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
