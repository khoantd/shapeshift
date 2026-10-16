import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_core.dart';
import '../../auth/session.dart';
import '../../providers.dart';
import '../../settings/settings_core.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

class MoreScreen extends ConsumerStatefulWidget {
  const MoreScreen({super.key});

  @override
  ConsumerState<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends ConsumerState<MoreScreen> {
  var editingBase = false;
  late final baseCtrl = TextEditingController();
  String? accountEmail;
  var authBusy = false;
  AppLinks? _appLinks;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final settings = ref.read(settingsProvider).value;
      if (settings != null) baseCtrl.text = settings.apiBase;
      refreshAccount();
      _listenOauth();
    });
  }

  Future<void> _listenOauth() async {
    _appLinks = AppLinks();
    final initial = await _appLinks!.getInitialLink();
    if (initial != null) await _handleOauthUri(initial);
    _appLinks!.uriLinkStream.listen(_handleOauthUri);
  }

  Future<void> _handleOauthUri(Uri uri) async {
    if (uri.scheme != 'meanbox') return;
    await _applyOauthRedirect(uri.toString());
  }

  Future<bool> _applyOauthRedirect(String url) async {
    final parsed = parseMobileOAuthRedirect(url);
    if (parsed is OAuthRedirectOk) {
      await ref.read(sessionProvider.notifier).save(parsed.session);
      setState(() => accountEmail = parsed.session.email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              parsed.session.email != null
                  ? 'Connected as ${parsed.session.email}'
                  : 'Google account connected.',
            ),
          ),
        );
      }
      await refreshAccount();
      return true;
    }
    if (parsed is OAuthRedirectErr && mounted) {
      final msg = parsed.error == 'not_connected'
          ? 'Google did not return a Meanbox session. Try again.'
          : 'OAuth error: ${parsed.error}';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg)),
      );
    }
    return false;
  }

  Future<void> refreshAccount() async {
    final session = await loadSession();
    if (!mounted) return;
    setState(() {
      accountEmail = session?.email;
    });
    if (session?.bridge == null) return;
    try {
      final client = ref.read(meanboxClientProvider);
      final status = await client.fetchOAuthSession();
      if (status['connected'] == true) {
        setState(() {
          accountEmail = (status['email'] as String?) ?? session?.email;
        });
      }
    } catch (_) {
      // keep local email
    }
  }

  Future<void> signIn() async {
    setState(() => authBusy = true);
    try {
      final settings = ref.read(settingsProvider).value ??
          const MeanboxSettings();
      final startUrl = oauthStartUrl(
        settings.apiBase,
        returnTo: mobileOauthReturnTo,
      );
      // ASWebAuthenticationSession / Chrome Custom Tabs — same pattern as Expo
      // WebBrowser.openAuthSessionAsync(startUrl, "meanbox://oauth").
      final resultUrl = await FlutterWebAuth2.authenticate(
        url: startUrl,
        callbackUrlScheme: 'meanbox',
      );
      await _applyOauthRedirect(resultUrl);
    } on Exception catch (e) {
      final msg = e.toString();
      if (msg.contains('CANCELED') || msg.contains('canceled')) {
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sign-in failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => authBusy = false);
    }
  }

  Future<void> signOut() async {
    await ref.read(sessionProvider.notifier).clear();
    setState(() => accountEmail = null);
  }

  Future<void> saveBase() async {
    try {
      await ref.read(settingsProvider.notifier).setApiBase(baseCtrl.text);
      setState(() => editingBase = false);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invalid API base: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    baseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(settingsProvider);
    final sessionAsync = ref.watch(sessionProvider);
    final settings = settingsAsync.value ?? const MeanboxSettings();
    final session = sessionAsync.value;
    final signedIn = session?.bridge != null && session!.bridge.isNotEmpty;

    return MbScreen(
      child: ListView(
        children: [
          const MbScreenHeader(title: 'More'),
          const SizedBox(height: 16),
          const Center(
            child: MeanboxLogo(
              variant: MeanboxLogoVariant.lockup,
              height: 40,
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              'Account, locale, and API settings',
              style: MeanboxType.caption,
            ),
          ),
          const SizedBox(height: 16),
          if (signedIn) ...[
            MbListRow(
              title: 'Account',
              meta: accountEmail ?? 'Google connected',
              leading: const MbIconTile(
                brand: true,
                child: Icon(
                  LucideIcons.logIn,
                  size: 18,
                  color: MeanboxColor.brand,
                ),
              ),
            ),
            MbListRow(
              title: 'Sign out',
              meta: 'Clear Meanbox session on this device',
              onTap: signOut,
              leading: const MbIconTile(
                child: Icon(
                  LucideIcons.logOut,
                  size: 18,
                  color: MeanboxColor.ink2,
                ),
              ),
            ),
          ] else
            MbListRow(
              title: authBusy ? 'Signing in…' : 'Sign in',
              meta: 'Google via Meanbox (session stays in the app)',
              onTap: authBusy ? null : signIn,
              leading: MbIconTile(
                brand: true,
                child: authBusy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(
                        LucideIcons.logIn,
                        size: 18,
                        color: MeanboxColor.brand,
                      ),
              ),
            ),
          MbListRow(
            title: 'Language',
            meta: settings.locale == 'vi' ? 'Tiếng Việt' : 'English',
            onTap: () {
              final next = settings.locale == 'en' ? 'vi' : 'en';
              ref.read(settingsProvider.notifier).setLocale(next);
            },
            leading: const MbIconTile(
              child: Icon(
                LucideIcons.globe,
                size: 18,
                color: MeanboxColor.ink2,
              ),
            ),
          ),
          MbListRow(
            title: 'API base',
            meta: settings.apiBase,
            onTap: () {
              baseCtrl.text = settings.apiBase;
              setState(() => editingBase = !editingBase);
            },
            leading: const MbIconTile(
              child: Icon(
                LucideIcons.server,
                size: 18,
                color: MeanboxColor.ink2,
              ),
            ),
          ),
          if (editingBase) ...[
            TextField(
              controller: baseCtrl,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: const InputDecoration(
                hintText: 'https://meanbox.vercel.app',
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton(
                onPressed: saveBase,
                style: FilledButton.styleFrom(
                  backgroundColor: MeanboxColor.primary,
                  foregroundColor: MeanboxColor.primaryForeground,
                ),
                child: const Text('Save API base'),
              ),
            ),
          ],
          MbListRow(
            title: 'About',
            meta: 'v0.1.0 · Meanbox Flutter',
            bordered: false,
            onTap: () {
              final u = Uri.tryParse(settings.apiBase);
              if (u != null) {
                launchUrl(u, mode: LaunchMode.externalApplication);
              }
            },
            leading: const MbIconTile(
              child: Icon(
                LucideIcons.info,
                size: 18,
                color: MeanboxColor.ink2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
