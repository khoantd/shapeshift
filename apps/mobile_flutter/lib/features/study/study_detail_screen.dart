import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../api/api_core.dart';
import '../../lib_utils.dart';
import '../../providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';
import '../../widgets/youtube_player.dart';

class StudyDetailScreen extends ConsumerStatefulWidget {
  const StudyDetailScreen({
    super.key,
    required this.videoId,
    this.title = 'Video',
    this.channelTitle = '',
  });

  final String videoId;
  final String title;
  final String channelTitle;

  @override
  ConsumerState<StudyDetailScreen> createState() => _StudyDetailScreenState();
}

class _StudyDetailScreenState extends ConsumerState<StudyDetailScreen> {
  late var title = widget.title;
  late var channel = widget.channelTitle;
  var seg = 'Overview';
  var markdown = '';
  String? saveHint;
  var loading = true;
  var generating = false;
  String? error;
  var related = <YouTubeVideo>[];

  Future<void> loadContext() async {
    if (widget.videoId.isEmpty) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final client = ref.read(meanboxClientProvider);
      final details = await client.fetchVideoDetails(widget.videoId);
      final video = details['video'];
      if (video is Map) {
        final v = YouTubeVideo.fromJson(Map<String, dynamic>.from(video));
        if (v.title.isNotEmpty) title = v.title;
        if ((v.channelTitle ?? '').isNotEmpty) channel = v.channelTitle!;
      }
      final saved = await client.fetchSavedLearningPack(widget.videoId);
      final pack = saved['pack'];
      if (pack is Map && pack['markdown'] is String) {
        markdown = pack['markdown'] as String;
        saveHint = null;
      } else if (saved['unauthorized'] == true) {
        saveHint = 'Sign in on Meanbox to sync saved packs.';
      }
    } catch (e) {
      error = e.toString();
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> generate() async {
    if (widget.videoId.isEmpty) return;
    setState(() {
      generating = true;
      error = null;
    });
    try {
      final client = ref.read(meanboxClientProvider);
      final tr = await client.fetchTranscript(widget.videoId);
      if (tr['success'] != true ||
          (tr['text'] as String?)?.trim().isEmpty != false) {
        setState(() {
          error =
              '${tr['error'] ?? 'No transcript available — open Meanbox on the web to paste captions.'}';
        });
        return;
      }
      final pack = await client.generateLearningPack(
        videoId: widget.videoId,
        title: title,
        channelTitle: channel.isEmpty ? null : channel,
        transcript: '${tr['text']}',
      );
      if (pack['success'] != true || pack['text'] == null) {
        setState(() => error = '${pack['error'] ?? 'Pack generation failed'}');
        return;
      }
      setState(() {
        markdown = '${pack['text']}';
        saveHint = pack['saved'] == true
            ? null
            : '${pack['saveError'] ?? 'Generated but not saved — sign in on Meanbox to sync.'}';
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => generating = false);
    }
  }

  Future<void> loadRelated() async {
    final q = title.split(RegExp(r'\s+')).take(6).join(' ');
    if (q.isEmpty) return;
    try {
      final client = ref.read(meanboxClientProvider);
      final res = await client.searchYouTube(q);
      final list = <YouTubeVideo>[];
      final raw = res['videos'];
      if (raw is List) {
        for (final e in raw) {
          if (e is Map) {
            final v = YouTubeVideo.fromJson(Map<String, dynamic>.from(e));
            if (v.videoId != widget.videoId) list.add(v);
          }
        }
      }
      setState(() => related = list.take(5).toList());
    } catch (_) {
      setState(() => related = []);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => loadContext());
  }

  @override
  Widget build(BuildContext context) {
    final keyPoints = extractKeyPoints(markdown);
    final chapters = extractChapters(markdown);

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
                ),
                icon: const Icon(LucideIcons.chevronLeft, size: 20),
              ),
              const Spacer(),
              IconButton(
                onPressed: generating ? null : generate,
                style: IconButton.styleFrom(
                  backgroundColor: MeanboxColor.muted,
                ),
                icon: generating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(LucideIcons.refreshCw, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 8),
          YoutubePlayer(videoId: widget.videoId),
          const SizedBox(height: 12),
          Text(title, style: MeanboxType.title),
          if (channel.isNotEmpty)
            Text(channel, style: MeanboxType.caption),
          if (saveHint != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(saveHint!, style: MeanboxType.caption),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (final s in ['Overview', 'Related'])
                MbChip(
                  label: s,
                  selected: seg == s,
                  onTap: () {
                    setState(() => seg = s);
                    if (s == 'Related') loadRelated();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (loading)
            const Center(
              child: CircularProgressIndicator(color: MeanboxColor.brand),
            )
          else if (error != null)
            Text(
              error!,
              style: MeanboxType.body.copyWith(color: MeanboxColor.destructive),
            )
          else if (seg == 'Related')
            ...related.map(
              (v) => MbListRow(
                title: v.title,
                meta: v.channelTitle,
                onTap: () => context.push(
                  '/study/${Uri.encodeComponent(v.videoId)}'
                  '?title=${Uri.encodeComponent(v.title)}'
                  '&channelTitle=${Uri.encodeComponent(v.channelTitle ?? '')}',
                ),
              ),
            )
          else ...[
            if (markdown.isEmpty)
              FilledButton(
                onPressed: generating ? null : generate,
                style: FilledButton.styleFrom(
                  backgroundColor: MeanboxColor.primary,
                  foregroundColor: MeanboxColor.primaryForeground,
                  minimumSize: const Size.fromHeight(MeanboxSpacing.touchMin),
                ),
                child: Text(generating ? 'Generating…' : 'Generate learning pack'),
              )
            else ...[
              if (keyPoints.isNotEmpty) ...[
                const MbSectionLabel('Key points'),
                for (final p in keyPoints)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          LucideIcons.check,
                          size: 16,
                          color: MeanboxColor.brand,
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(p, style: MeanboxType.body)),
                      ],
                    ),
                  ),
              ],
              if (chapters.isNotEmpty) ...[
                const MbSectionLabel('Chapters'),
                for (final c in chapters)
                  MbListRow(
                    title: c.title,
                    meta: c.time,
                    bordered: true,
                  ),
              ],
              const MbSectionLabel('Pack'),
              MarkdownBody(
                data: markdown,
                styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
