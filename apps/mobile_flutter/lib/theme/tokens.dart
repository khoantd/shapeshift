import 'package:flutter/material.dart';

/// Meanbox mobile design tokens — keep in sync with
/// design-system/mobile/tokens.json and apps/mobile/theme/tokens.ts.
class MeanboxColor {
  static const background = Color(0xFFFAFAF9);
  static const foreground = Color(0xFF1A1A19);
  static const card = Color(0xFFFFFFFF);
  static const cardForeground = Color(0xFF1A1A19);
  static const primary = Color(0xFF1A1A19);
  static const primaryForeground = Color(0xFFFAFAF9);
  static const secondary = Color(0xFFF4F4F2);
  static const secondaryForeground = Color(0xFF1A1A19);
  static const muted = Color(0xFFF4F4F2);
  static const mutedForeground = Color(0xFF706E68);
  static const accent = Color(0xFFECFDF8);
  static const accentForeground = Color(0xFF0F766E);
  static const destructive = Color(0xFFE03131);
  static const border = Color(0xFFE8E7E4);
  static const input = Color(0xFFE8E7E4);
  static const ring = Color(0xFF0F766E);
  static const brand = Color(0xFF0F766E);
  static const brandSoft = Color(0xFFECFDF8);
  static const ink2 = Color(0xFF57564F);
  static const lineStrong = Color(0xFFD6D4CF);
  static const positive = Color(0xFF2F9E44);
  static const caution = Color(0xFFE8590C);
  static const cautionText = Color(0xFFBB4C19);
}

class MeanboxRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 28.0;
  static const shell = 28.0;
  static const pill = 9999.0;
}

class MeanboxSpacing {
  static const unit = 4.0;
  static const gutterPhone = 16.0;
  static const gutterLarge = 20.0;
  static const sectionGap = 12.0;
  static const sectionGapLg = 16.0;
  static const tabBarHeight = 56.0;
  static const headerHeight = 48.0;
  static const touchMin = 44.0;
}

class MeanboxType {
  static const display = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w600,
    height: 1.2,
    letterSpacing: -0.56,
    color: MeanboxColor.foreground,
  );
  static const title = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    height: 1.25,
    letterSpacing: -0.4,
    color: MeanboxColor.foreground,
  );
  static const body = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.5,
    color: MeanboxColor.foreground,
  );
  static const bodyReader = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.65,
    color: MeanboxColor.foreground,
  );
  static const callout = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    height: 1.45,
    color: MeanboxColor.foreground,
  );
  static const caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.4,
    color: MeanboxColor.mutedForeground,
  );
  static const micro = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    height: 1.3,
    color: MeanboxColor.mutedForeground,
  );
}

const meanboxTabs = ['Ask', 'News', 'Study', 'Tools', 'More'];
