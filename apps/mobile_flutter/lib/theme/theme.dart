import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';

ThemeData buildMeanboxTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    fontFamily: null, // system; Geist optional later
    scaffoldBackgroundColor: MeanboxColor.background,
    colorScheme: const ColorScheme.light(
      primary: MeanboxColor.primary,
      onPrimary: MeanboxColor.primaryForeground,
      secondary: MeanboxColor.brand,
      onSecondary: MeanboxColor.primaryForeground,
      surface: MeanboxColor.card,
      onSurface: MeanboxColor.foreground,
      error: MeanboxColor.destructive,
      outline: MeanboxColor.border,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: MeanboxColor.background,
      foregroundColor: MeanboxColor.foreground,
      elevation: 0,
      scrolledUnderElevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
    ),
    dividerColor: MeanboxColor.border,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: MeanboxColor.card,
      hintStyle: MeanboxType.body.copyWith(color: MeanboxColor.mutedForeground),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MeanboxRadius.md),
        borderSide: const BorderSide(color: MeanboxColor.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MeanboxRadius.md),
        borderSide: const BorderSide(color: MeanboxColor.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(MeanboxRadius.md),
        borderSide: const BorderSide(color: MeanboxColor.ring, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: MeanboxColor.card,
      selectedItemColor: MeanboxColor.brand,
      unselectedItemColor: MeanboxColor.mutedForeground,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: MeanboxColor.foreground,
      displayColor: MeanboxColor.foreground,
    ),
  );
}
