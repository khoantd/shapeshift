import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/tokens.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: MeanboxColor.card,
          border: Border(top: BorderSide(color: MeanboxColor.border)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            height: MeanboxSpacing.tabBarHeight + 8,
            backgroundColor: MeanboxColor.card,
            indicatorColor: MeanboxColor.brandSoft,
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: navigationShell.goBranch,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: const [
              NavigationDestination(
                icon: Icon(LucideIcons.search, size: 22),
                label: 'Ask',
              ),
              NavigationDestination(
                icon: Icon(LucideIcons.newspaper, size: 22),
                label: 'News',
              ),
              NavigationDestination(
                icon: Icon(LucideIcons.bookOpen, size: 22),
                label: 'Study',
              ),
              NavigationDestination(
                icon: Icon(LucideIcons.slidersHorizontal, size: 22),
                label: 'Tools',
              ),
              NavigationDestination(
                icon: Icon(LucideIcons.menu, size: 22),
                label: 'More',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
