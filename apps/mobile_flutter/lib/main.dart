import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'theme/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: MeanboxApp()));
}

class MeanboxApp extends StatelessWidget {
  const MeanboxApp({super.key});

  @override
  Widget build(BuildContext context) {
    final router = buildRouter();
    return MaterialApp.router(
      title: 'Meanbox',
      debugShowCheckedModeBanner: false,
      theme: buildMeanboxTheme(),
      routerConfig: router,
    );
  }
}
