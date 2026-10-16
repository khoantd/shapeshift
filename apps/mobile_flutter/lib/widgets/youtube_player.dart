import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../lib_utils.dart';
import '../theme/tokens.dart';

class YoutubePlayer extends StatefulWidget {
  const YoutubePlayer({super.key, required this.videoId});
  final String videoId;

  @override
  State<YoutubePlayer> createState() => _YoutubePlayerState();
}

class _YoutubePlayerState extends State<YoutubePlayer> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    final html = youtubeEmbedHtml(widget.videoId);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..loadHtmlString(html, baseUrl: youtubeEmbedOrigin);
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(MeanboxRadius.lg),
        child: WebViewWidget(controller: _controller),
      ),
    );
  }
}
