import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'features/ask/ask_screen.dart';
import 'features/more/more_screen.dart';
import 'features/news/news_detail_screen.dart';
import 'features/news/news_screen.dart';
import 'features/shell.dart';
import 'features/study/study_detail_screen.dart';
import 'features/study/study_screen.dart';
import 'features/tools/tools_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();

GoRouter buildRouter() {
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/ask',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/ask',
                builder: (context, state) => const AskScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/news',
                builder: (context, state) => const NewsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (context, state) {
                      final q = state.uri.queryParameters;
                      return NewsDetailScreen(
                        id: state.pathParameters['id'] ?? '',
                        title: q['title'] ?? 'Story',
                        excerpt: q['excerpt'] ?? '',
                        canonicalUrl: q['canonicalUrl'] ?? '',
                        source: q['source'] ?? '',
                        publishedAt: q['publishedAt'] ?? '',
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/study',
                builder: (context, state) => StudyScreen(
                  initialQuery: state.uri.queryParameters['q'],
                ),
                routes: [
                  GoRoute(
                    path: ':videoId',
                    builder: (context, state) {
                      final q = state.uri.queryParameters;
                      return StudyDetailScreen(
                        videoId: state.pathParameters['videoId'] ?? '',
                        title: q['title'] ?? 'Video',
                        channelTitle: q['channelTitle'] ?? '',
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tools',
                builder: (context, state) {
                  final q = state.uri.queryParameters;
                  return ToolsScreen(
                    gadget: q['gadget'],
                    q: q['q'],
                  );
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/more',
                builder: (context, state) => const MoreScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
