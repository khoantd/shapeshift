import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/tokens.dart';

class MbScreen extends StatelessWidget {
  const MbScreen({
    super.key,
    required this.child,
    this.padTabBar = true,
  });

  final Widget child;
  final bool padTabBar;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: MeanboxColor.background,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            MeanboxSpacing.gutterPhone,
            0,
            MeanboxSpacing.gutterPhone,
            padTabBar ? MeanboxSpacing.tabBarHeight + 16 : 8,
          ),
          child: child,
        ),
      ),
    );
  }
}

class MbScreenHeader extends StatelessWidget {
  const MbScreenHeader({
    super.key,
    required this.title,
    this.action,
    this.onAction,
  });

  final String title;
  final Widget? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MeanboxSpacing.headerHeight + 8,
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: MeanboxType.title),
          ),
          if (action != null)
            IconButton(
              onPressed: onAction,
              icon: action!,
              style: IconButton.styleFrom(
                minimumSize: const Size(
                  MeanboxSpacing.touchMin,
                  MeanboxSpacing.touchMin,
                ),
                backgroundColor: MeanboxColor.muted,
              ),
            ),
        ],
      ),
    );
  }
}

class MbChip extends StatelessWidget {
  const MbChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(
          label,
          style: MeanboxType.caption.copyWith(
            color: selected ? MeanboxColor.brand : MeanboxColor.ink2,
            fontWeight: FontWeight.w500,
          ),
        ),
        selected: selected,
        onSelected: onTap == null ? null : (_) => onTap!(),
        selectedColor: MeanboxColor.brandSoft,
        backgroundColor: MeanboxColor.muted,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MeanboxRadius.pill),
        ),
        showCheckmark: false,
        padding: const EdgeInsets.symmetric(horizontal: 4),
      ),
    );
  }
}

class MbIconTile extends StatelessWidget {
  const MbIconTile({
    super.key,
    required this.child,
    this.brand = false,
  });

  final Widget child;
  final bool brand;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: brand ? MeanboxColor.brandSoft : MeanboxColor.muted,
        borderRadius: BorderRadius.circular(MeanboxRadius.md),
      ),
      child: child,
    );
  }
}

class MbListRow extends StatelessWidget {
  const MbListRow({
    super.key,
    required this.title,
    this.meta,
    this.leading,
    this.onTap,
    this.bordered = true,
  });

  final String title;
  final String? meta;
  final Widget? leading;
  final VoidCallback? onTap;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(MeanboxRadius.md),
        child: Container(
          constraints: const BoxConstraints(minHeight: MeanboxSpacing.touchMin),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: bordered
              ? const BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: MeanboxColor.border),
                  ),
                )
              : null,
          child: Row(
            children: [
              if (leading != null) ...[
                leading!,
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: MeanboxType.callout),
                    if (meta != null && meta!.isNotEmpty)
                      Text(meta!, style: MeanboxType.caption),
                  ],
                ),
              ),
              if (onTap != null)
                const Icon(
                  LucideIcons.chevronRight,
                  size: 18,
                  color: MeanboxColor.mutedForeground,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class MbSectionLabel extends StatelessWidget {
  const MbSectionLabel(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: MeanboxType.micro.copyWith(
          letterSpacing: 0.6,
          color: MeanboxColor.ink2,
        ),
      ),
    );
  }
}

/// Meanbox brand mark — same PNGs as Expo `apps/mobile/assets/brand/*`.
enum MeanboxLogoVariant { mark, wordmark, lockup }

class MeanboxLogo extends StatelessWidget {
  const MeanboxLogo({
    super.key,
    this.variant = MeanboxLogoVariant.lockup,
    this.height,
  });

  final MeanboxLogoVariant variant;

  /// Display height in logical pixels; width follows intrinsic aspect ratio.
  final double? height;

  static const _assets = {
    MeanboxLogoVariant.mark: (
      path: 'assets/brand/icon.png',
      aspectRatio: 112 / 106,
      defaultHeight: 28.0,
    ),
    MeanboxLogoVariant.wordmark: (
      path: 'assets/brand/wordmark.png',
      aspectRatio: 720 / 184,
      defaultHeight: 28.0,
    ),
    MeanboxLogoVariant.lockup: (
      path: 'assets/brand/lockup.png',
      aspectRatio: 923 / 184,
      defaultHeight: 28.0,
    ),
  };

  @override
  Widget build(BuildContext context) {
    final asset = _assets[variant]!;
    final h = height ?? asset.defaultHeight;
    return Semantics(
      label: 'Meanbox',
      image: true,
      child: Image.asset(
        asset.path,
        height: h,
        width: h * asset.aspectRatio,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
      ),
    );
  }
}
